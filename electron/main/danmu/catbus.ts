/**
 * catbus CLI 调用层（批量弹幕）。
 *
 * 移植自 ~/workspace/shuijun-deploy/server.js 的 runCatbus：
 * 主进程 spawn node 跑 catbus CLI，命令形如
 *   catbus -a <账号> douyin live send <直播间号> <文案> -y
 *   catbus -a <账号> douyin auth login --method qrcode
 *   catbus -a <账号> douyin auth status
 *
 * 与原启动器的两点不同：
 * - 用 Electron 自身当 node 跑 CLI（ELECTRON_RUN_AS_NODE=1），
 *   不再另装一份 node；CLI 入口从依赖里解析，不写死路径。
 * - TEMP_DIR（短信验证码文件、2046 标记、二维码副本的落点）
 *   用系统临时目录下的 zhongkong-bobi-danmu，不占应用 userData。
 *
 * 凭证一律保持原路径 ~/.catbus/…，绝不挪进应用 userData。
 */
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { createLogger } from '#/logger'

const logger = createLogger('批量弹幕').scope('catbus')

const CATBUS_CLI_ENTRY = 'catbus-cli/dist/cli/main.js'

let cliPathCache: string | null | undefined

/** 解析 catbus CLI 入口路径（打包后在 app.asar/node_modules 里）。 */
export function getCatbusCliPath(): string | null {
  if (cliPathCache !== undefined) return cliPathCache
  try {
    const require = createRequire(import.meta.url)
    const resolved = require.resolve(CATBUS_CLI_ENTRY)
    cliPathCache = fs.existsSync(resolved) ? resolved : null
  } catch {
    cliPathCache = null
  }
  if (!cliPathCache) {
    logger.error(`找不到 catbus CLI 入口：${CATBUS_CLI_ENTRY}，请检查依赖是否安装`)
  }
  return cliPathCache
}

/** 仅供测试：清除 CLI 路径缓存。 */
export function __resetCatbusCliPathForTest(): void {
  cliPathCache = undefined
}

/** 批量弹幕的临时目录：短信验证码、2046 标记、二维码副本。 */
export function getDanmuTempDir(): string {
  const dir = path.join(app.getPath('temp'), 'zhongkong-bobi-danmu')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** catbus 家目录（凭证所在处，保持原路径）。 */
export function getCatbusHome(): string {
  return path.join(os.homedir(), '.catbus')
}

/** 该账号的凭证文件：~/.catbus/auth/douyin/web/<账号>.json */
export function getAuthFilePath(account: string): string {
  return path.join(getCatbusHome(), 'auth', 'douyin', 'web', `${account}.json`)
}

/** 旧版 sessions 目录：~/.catbus/sessions/douyin */
export function getSessionsDir(): string {
  return path.join(getCatbusHome(), 'sessions', 'douyin')
}

/** catbus 缓存的二维码：~/.catbus/cache/douyin/qrcode.png */
export function getCachedQrPath(): string {
  return path.join(getCatbusHome(), 'cache', 'douyin', 'qrcode.png')
}

/** 短信验证标记：TEMP_DIR/douyin_2046.json（出现即表示触发短信验证）。 */
export function getMfaMarkerPath(): string {
  return path.join(getDanmuTempDir(), 'douyin_2046.json')
}

/** 短信验证码落点：TEMP_DIR/mfa_code.txt（catbus CLI 会读它）。 */
export function getMfaCodePath(): string {
  return path.join(getDanmuTempDir(), 'mfa_code.txt')
}

/** 本账号二维码副本：TEMP_DIR/qr_<账号>.png（供界面显示）。 */
export function getQrCopyPath(account: string): string {
  return path.join(getDanmuTempDir(), `qr_${account}.png`)
}

export interface CatbusResult {
  code: number | null
  out: string
  err: string
}

/**
 * 跑一次 catbus CLI（一次性命令：发弹幕、查登录态等），等进程退出后返回输出。
 * 超时则杀掉进程，code 为 -1。
 */
export function runCatbus(args: string[], opts?: { timeoutMs?: number }): Promise<CatbusResult> {
  return new Promise(resolve => {
    const cliPath = getCatbusCliPath()
    if (!cliPath) {
      resolve({ code: -1, out: '', err: 'catbus CLI 未找到' })
      return
    }
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: {
        ...process.env,
        TEMP_DIR: getDanmuTempDir(),
        ELECTRON_RUN_AS_NODE: '1',
      },
      windowsHide: true,
    })
    let out = ''
    let err = ''
    let done = false
    const finish = (code: number | null, timeout = false) => {
      if (done) return
      done = true
      resolve({ code, out, err: timeout ? 'timeout' : err })
    }
    child.stdout?.on('data', d => {
      out += d.toString()
    })
    child.stderr?.on('data', d => {
      err += d.toString()
    })
    child.on('error', e => {
      logger.error('catbus 启动失败：', e)
      finish(-1)
    })
    child.on('close', code => finish(code))
    if (opts?.timeoutMs) {
      setTimeout(() => {
        if (!done) {
          try {
            child.kill()
          } catch {}
          finish(-1, true)
        }
      }, opts.timeoutMs)
    }
  })
}

/**
 * 启动一个长期运行的 catbus 进程（扫码登录用，调用方负责监听退出与杀进程）。
 * 返回子进程；CLI 不可用时返回 null。
 */
export function spawnCatbus(args: string[]): ChildProcess | null {
  const cliPath = getCatbusCliPath()
  if (!cliPath) return null
  return spawn(process.execPath, [cliPath, ...args], {
    env: {
      ...process.env,
      TEMP_DIR: getDanmuTempDir(),
      ELECTRON_RUN_AS_NODE: '1',
    },
    windowsHide: true,
  })
}

/** 查登录态：解析 `catbus -a <账号> douyin auth status` 的 JSON 输出。 */
export async function checkAuthStatus(account: string): Promise<{
  loggedIn: boolean
  userName: string
}> {
  const { out } = await runCatbus(['-a', account, 'douyin', 'auth', 'status'], {
    timeoutMs: 30000,
  })
  try {
    const j = JSON.parse(out)
    if (j?.data?.logged_in) {
      return { loggedIn: true, userName: j.data.user?.name || '' }
    }
  } catch {}
  return { loggedIn: false, userName: '' }
}

/** 发一条弹幕。返回合并后的输出，供调用方判断 ok / AUTH_EXPIRED / RISK。 */
export async function sendDanmu(
  account: string,
  roomId: string,
  message: string,
): Promise<string> {
  const { out, err } = await runCatbus(
    ['-a', account, 'douyin', 'live', 'send', roomId, message, '-y'],
    { timeoutMs: 60000 },
  )
  return out + err
}

/** 删掉该账号的凭证文件（登录 / 强制退出时用，与原启动器一致）。 */
export function deleteAccountCredentials(account: string): void {
  try {
    const authFile = getAuthFilePath(account)
    if (fs.existsSync(authFile)) fs.unlinkSync(authFile)
  } catch {}
  try {
    const dir = getSessionsDir()
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.includes(account)) {
          try {
            fs.unlinkSync(path.join(dir, f))
          } catch {}
        }
      }
    }
  } catch {}
}
