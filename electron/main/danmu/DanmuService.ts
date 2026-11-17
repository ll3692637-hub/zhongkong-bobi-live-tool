/**
 * 批量弹幕服务（主进程单例）。
 *
 * 移植自 ~/workspace/shuijun-deploy/server.js，行为与之保持一致：
 * - 5 个账号槽位 shuijun1~5，扫码登录，二维码 55 秒过期，票据约 1 小时过期；
 * - 登录全局锁：一次只允许一个号登录（共享二维码文件会被互相覆盖）；
 * - 发送按文案分组，一组由同一个号发完；组内间隔第 1→2 句 50–70 秒、
 *   之后 105–135 秒；组间间隔用配置 intervalMin/intervalMax；
 * - 风控处理：输出含 AUTH_EXPIRED → 标记过期并自动重登录；
 *   含 RISK → 停用该号、其余继续；连续 3 次失败 → 按过期处理。
 *
 * 与原启动器的不同：不再起本地 HTTP 服务，状态经 IPC 事件推给渲染进程；
 * 日志走应用统一的 logger，会自动进界面底部的运行日志。
 */
import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import {
  DANMU_ACCOUNTS,
  countMessages,
  intraGroupWaitSeconds,
  parseMessageGroups,
  pickAccountForGroup,
  randomInt,
  type DanmuAccountId,
} from 'shared/danmu'
import { createLogger } from '#/logger'
import windowManager from '#/windowManager'
import {
  checkAuthStatus,
  deleteAccountCredentials,
  getCachedQrPath,
  getDanmuTempDir,
  getMfaCodePath,
  getMfaMarkerPath,
  getQrCopyPath,
  sendDanmu,
  spawnCatbus,
} from './catbus'

const logger = createLogger('批量弹幕')
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const QR_EXPIRE_MS = 50000
const QR_FRESH_MS = 15000

interface AccountRuntime {
  id: DanmuAccountId
  status: DanmuAccountStatus
  userName: string
  qrReady: boolean
  qrAt: number
  failCount: number
}

class DanmuService {
  private accounts: Record<DanmuAccountId, AccountRuntime> = Object.fromEntries(
    DANMU_ACCOUNTS.map(id => [
      id,
      { id, status: 'logged-out', userName: '', qrReady: false, qrAt: 0, failCount: 0 } as AccountRuntime,
    ]),
  ) as Record<DanmuAccountId, AccountRuntime>

  private loginBusy = false
  private loggingInAccount: DanmuAccountId | null = null
  private loginChild: ChildProcess | null = null

  private sending = false
  private paused = false
  private sendLoopRunning = false
  private progress: DanmuProgress = { sent: 0, total: 0, groupIndex: 0, groupCount: 0 }
  private groups: string[][] = []
  private sendConfig: Omit<DanmuSendConfig, 'messagesText'> = {
    roomId: '',
    intervalMin: 60,
    intervalMax: 120,
  }

  /** 当前状态快照（推给界面）。 */
  getSnapshot(): DanmuSnapshot {
    return {
      accounts: DANMU_ACCOUNTS.map(id => {
        const a = this.accounts[id]
        return {
          id: a.id,
          status: a.status,
          userName: a.userName,
          qrReady: a.qrReady,
          failCount: a.failCount,
        }
      }),
      sending: this.sending,
      paused: this.paused,
      progress: { ...this.progress },
      loginBusy: this.loginBusy,
    }
  }

  private emitStatus(): void {
    windowManager.send(IPC_CHANNELS.tasks.danmu.statusChanged, this.getSnapshot())
  }

  private emitStopped(): void {
    windowManager.send(IPC_CHANNELS.tasks.danmu.stoppedEvent)
  }

  /** 登录态刷新：逐个查 `auth status`，只把已登录的置为已登录（解析失败不改状态）。 */
  async refreshLogins(): Promise<void> {
    for (const id of DANMU_ACCOUNTS) {
      const st = this.accounts[id]
      if (st.status === 'logging-in' || st.status === 'need-sms') continue
      const { loggedIn, userName } = await checkAuthStatus(id)
      if (loggedIn) {
        st.status = 'logged-in'
        st.userName = userName
      }
      this.emitStatus()
    }
  }

  /** 开始登录（后台跑）。全局锁被占时直接拒绝，不排队。 */
  startLogin(account: DanmuAccountId): { ok: boolean; reason?: string } {
    if (this.loginBusy) {
      logger.warn(`${account} 登录被拦截：已有其他账号正在登录，请等它完成后再扫`)
      return { ok: false, reason: 'busy' }
    }
    if (this.accounts[account].status === 'logging-in') {
      return { ok: false, reason: 'already' }
    }
    void this.runLogin(account)
    return { ok: true }
  }

  /** 登录流程（与原启动器 doLogin 一致，不递归、不并发）。 */
  private async runLogin(account: DanmuAccountId): Promise<void> {
    this.loginBusy = true
    this.loggingInAccount = account
    const st = this.accounts[account]
    st.status = 'logging-in'
    st.userName = ''
    st.qrReady = false
    st.qrAt = 0
    st.failCount = 0
    this.emitStatus()

    // 删掉该号的旧凭证，确保扫新号能真正切换账号
    deleteAccountCredentials(account)
    // 清掉短信标记、验证码与旧二维码，避免读到过期状态
    for (const f of [getMfaMarkerPath(), getMfaCodePath(), getQrCopyPath(account)]) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f)
      } catch {}
    }
    try {
      const cached = getCachedQrPath()
      if (fs.existsSync(cached)) fs.unlinkSync(cached)
    } catch {}
    void getDanmuTempDir()

    logger.info(`${account} 开始登录，生成二维码...`)
    const child = spawnCatbus(['-a', account, 'douyin', 'auth', 'login', '--method', 'qrcode'])
    if (!child) {
      logger.error(`${account} 登录启动失败：catbus CLI 未找到`)
      this.finishLogin(account, st)
      return
    }
    this.loginChild = child
    child.stdout?.on('data', () => {})
    child.stderr?.on('data', () => {})
    let exited = false
    child.on('close', () => {
      exited = true
    })

    // 等二维码文件出现（最多 30 秒）
    for (let i = 0; i < 30; i++) {
      await sleep(1000)
      const candidates = [getCachedQrPath(), `${getDanmuTempDir()}/qrcode.png`]
      for (const c of candidates) {
        try {
          if (fs.existsSync(c) && Date.now() - fs.statSync(c).mtimeMs < QR_FRESH_MS) {
            fs.copyFileSync(c, getQrCopyPath(account))
            st.qrReady = true
            st.qrAt = Date.now()
            logger.info(`${account} 二维码已生成，请在 55 秒内扫码`)
            this.emitStatus()
            break
          }
        } catch {}
      }
      if (st.qrReady) break
      if (fs.existsSync(getMfaMarkerPath())) break
      if (exited) break
    }

    // 等 2046（短信验证）或进程结束；二维码 50 秒过期未扫则杀掉进程退出
    for (let i = 0; i < 120; i++) {
      await sleep(1000)
      if (fs.existsSync(getMfaMarkerPath()) && st.status !== 'need-sms') {
        st.status = 'need-sms'
        logger.info(`${account} 触发短信验证，已自动发送`)
        this.emitStatus()
      }
      if (exited) break
      if (st.qrReady && st.qrAt && Date.now() - st.qrAt > QR_EXPIRE_MS && st.status !== 'need-sms') {
        logger.warn(`${account} 二维码过期，请点“换一张”重试`)
        try {
          child.kill()
        } catch {}
        st.qrReady = false
        st.qrAt = 0
        this.emitStatus()
        break
      }
    }

    if (!exited) {
      await new Promise<void>(r => {
        child.on('close', () => r())
      })
    }
    this.finishLogin(account, st)
  }

  private finishLogin(account: DanmuAccountId, st: AccountRuntime): void {
    st.qrReady = false
    st.qrAt = 0
    if (st.status === 'logging-in' || st.status === 'need-sms') {
      st.status = 'logged-out'
    }
    this.loginBusy = false
    this.loggingInAccount = null
    this.loginChild = null
    void this.refreshLogins().then(() => {
      logger.info(`${account} 登录流程结束：${this.accounts[account].status === 'logged-in' ? '成功 ✅' : '未完成'}`)
      this.emitStatus()
    })
  }

  /** 强制退出：清状态、删凭证；正在登录的就是这个号时释放全局锁。 */
  logout(account: DanmuAccountId): void {
    const st = this.accounts[account]
    if (this.loggingInAccount === account && this.loginChild) {
      try {
        this.loginChild.kill()
      } catch {}
      this.loginBusy = false
      this.loggingInAccount = null
      this.loginChild = null
    }
    st.status = 'logged-out'
    st.userName = ''
    st.qrReady = false
    st.qrAt = 0
    st.failCount = 0
    deleteAccountCredentials(account)
    logger.info(`${account} 已强制退出，请重新扫码`)
    this.emitStatus()
  }

  /** 提交短信验证码：写 TEMP_DIR/mfa_code.txt，catbus CLI 会读它。 */
  submitSmsCode(_account: DanmuAccountId, code: string): void {
    try {
      fs.writeFileSync(getMfaCodePath(), code.trim())
      logger.info('验证码已提交')
    } catch (e) {
      logger.error('验证码写入失败：', e as Error)
    }
  }

  /** 二维码图片（base64 data URL），没有则返回 null。 */
  getQrImage(account: DanmuAccountId): string | null {
    try {
      const p = getQrCopyPath(account)
      if (!fs.existsSync(p)) return null
      return `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`
    } catch {
      return null
    }
  }

  /** 开始发送。返回 false 表示未启动（正在发送、文案为空、直播间号为空）。 */
  startSend(config: DanmuSendConfig): boolean {
    if (this.sending) return false
    const groups = parseMessageGroups(config.messagesText)
    if (groups.length === 0) {
      logger.error('开始发送失败：文案库为空')
      return false
    }
    if (!config.roomId.trim()) {
      logger.error('开始发送失败：直播间号为空')
      return false
    }
    this.groups = groups
    this.sendConfig = {
      roomId: config.roomId.trim(),
      intervalMin: config.intervalMin,
      intervalMax: config.intervalMax,
    }
    const { total } = countMessages(groups)
    this.progress = { sent: 0, total, groupIndex: 0, groupCount: groups.length }
    this.sending = true
    this.paused = false
    logger.info(`开始发送，共 ${groups.length} 组 / ${total} 条（分组模式）`)
    this.emitStatus()
    void this.sendLoop()
    return true
  }

  pause(): void {
    if (!this.sending) return
    this.paused = true
    logger.info('已暂停')
    this.emitStatus()
  }

  resume(): void {
    if (!this.sending) return
    this.paused = false
    logger.info('继续发送')
    this.emitStatus()
  }

  stop(): void {
    if (!this.sending && !this.sendLoopRunning) return
    this.sending = false
    this.paused = false
    logger.info('已停止')
    this.emitStatus()
  }

  /** 1 秒一 tick 的等待：暂停时原地等，停止时立即返回 false。 */
  private async waitSeconds(sec: number): Promise<boolean> {
    for (let s = 0; s < sec; s++) {
      if (!this.sending) return false
      while (this.paused && this.sending) await sleep(1000)
      if (!this.sending) return false
      await sleep(1000)
    }
    return this.sending
  }

  /** 发送循环（分组模式，与原启动器 sendLoop 一致）。 */
  private async sendLoop(): Promise<void> {
    if (this.sendLoopRunning) return
    this.sendLoopRunning = true
    let groupIdx = 0

    for (const group of this.groups) {
      if (!this.sending) break

      // 选一个可用账号发整组
      const active = DANMU_ACCOUNTS.filter(id => {
        const st = this.accounts[id]
        return st.status === 'logged-in'
      })
      if (active.length === 0) {
        logger.warn('所有账号都不可用，等待重新登录...')
        await sleep(10000)
        continue
      }
      const account = pickAccountForGroup(active, groupIdx) as DanmuAccountId
      groupIdx++
      const st = this.accounts[account]
      this.progress.groupIndex = groupIdx
      logger.info(`第 ${groupIdx} 组由 ${account} 发送（${group.length} 条）`)
      this.emitStatus()
      let groupAborted = false

      for (let i = 0; i < group.length; i++) {
        if (!this.sending) break
        while (this.paused && this.sending) await sleep(1000)
        if (!this.sending) break

        const msg = group[i]
        const combined = await sendDanmu(account, this.sendConfig.roomId, msg)

        if (combined.includes('AUTH_EXPIRED')) {
          logger.warn(`${account} 票据过期，等待重新扫码`)
          st.failCount = 0
          st.status = 'expired'
          this.emitStatus()
          this.startLogin(account)
          groupAborted = true
          break
        } else if (combined.includes('"ok":true')) {
          st.failCount = 0
          this.progress.sent++
          logger.info(`${account} ✅ ${msg.slice(0, 25)}... (${this.progress.sent}/${this.progress.total})`)
          this.emitStatus()
        } else if (combined.includes('RISK')) {
          logger.warn(`${account} ⚠️ 触发风控，已停用`)
          st.failCount = 0
          st.status = 'risk-disabled'
          this.emitStatus()
          groupAborted = true
          break
        } else {
          st.failCount += 1
          logger.warn(`${account} ❌ 发送失败（连续${st.failCount}次）`)
          if (st.failCount >= 3) {
            logger.warn(`${account} 连续 3 次发不出，判定票据失效，等待重新扫码`)
            st.failCount = 0
            st.status = 'expired'
            this.emitStatus()
            this.startLogin(account)
            groupAborted = true
            break
          }
        }

        // 组内间隔（最后一条后不等待）
        if (i < group.length - 1) {
          const wait = intraGroupWaitSeconds(i, randomInt)
          if (!(await this.waitSeconds(wait))) break
        }
      }

      if (groupAborted) {
        logger.info(`第 ${groupIdx} 组中断，跳过剩余未发部分`)
      }

      // 组间间隔（用配置的发送间隔）
      if (this.sending) {
        const wait = randomInt(this.sendConfig.intervalMin, this.sendConfig.intervalMax)
        await this.waitSeconds(wait)
      }
    }

    this.sending = false
    this.paused = false
    this.sendLoopRunning = false
    logger.info('发送结束')
    this.emitStatus()
    this.emitStopped()
  }
}

export const danmuService = new DanmuService()
