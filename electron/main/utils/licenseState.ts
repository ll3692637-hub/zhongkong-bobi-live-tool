/**
 * 主进程授权复核（最小化实现，不做复杂反破解）。
 *
 * 背景：此前只有渲染进程里的守卫（useLicenseGuard）拦任务启动，
 * 改一下前端显示状态（localStorage 的 status 字段）就能绕过。
 * 现在主进程在每个受限任务启动时自己再验一次：
 * 卡密优先（验 Ed25519 签名 + 过期时间），其次是试用（共享的 shared/trial.ts 逻辑）。
 *
 * 状态来源：渲染进程启动时、激活 / 清除卡密后，通过 app:license:sync 同步过来，
 * 主进程只保存在内存里（不另外落盘；渲染进程的 localStorage 仍是唯一持久化来源）。
 * 同步规则（防篡改的底线，不是防专业破解）：
 * - 卡密：只有验签通过的新卡密才覆盖已存值；空串表示清除；验签失败的忽略，
 *   这样输错卡密也不会把主进程里已存的有效卡密顶掉。
 * - 试用开始时间：先到先得，收到后永不覆盖，重启试用只能靠删应用数据（MVP 已接受的限制）。
 * - 最大时间：只增不减。
 * - everActivated：只从 false 变 true，不回落。
 * 若渲染进程从未同步过（或同步内容为空），复核返回 false，任务拒绝启动（fail-closed）。
 */
import { advanceMaxSeenAt, isTrialActive, type TrialState } from 'shared/trial'
import { verifyLicenseKey } from './license'

interface MainLicenseState extends TrialState {
  key: string | null
}

let state: MainLicenseState = {
  key: null,
  trialStartedAt: null,
  trialMaxSeenAt: null,
  everActivated: false,
}

/** 接收渲染进程同步的授权状态（合并规则见文件头注释）。 */
export function syncLicenseState(patch: LicenseSyncPatch): void {
  if (patch.key !== undefined) {
    if (patch.key) {
      // 只有验签通过的卡密才进主进程；验签失败的忽略，保护已存有效卡密
      if (verifyLicenseKey(patch.key).valid) state.key = patch.key
    } else {
      state.key = null
    }
  }
  if (patch.trialStartedAt != null && state.trialStartedAt == null) {
    state.trialStartedAt = patch.trialStartedAt
  }
  if (patch.trialMaxSeenAt != null) {
    state.trialMaxSeenAt = advanceMaxSeenAt(state.trialMaxSeenAt, patch.trialMaxSeenAt)
  }
  if (patch.everActivated) {
    state.everActivated = true
  }
}

/**
 * 主进程授权复核：卡密优先，其次试用。
 * 每次判断时先推进主进程自己的时间观测（只增不减），
 * 这样任务启动那一刻的时钟回拨也延长不了试用。
 */
export function isAuthorized(): boolean {
  const now = Date.now()
  state.trialMaxSeenAt = advanceMaxSeenAt(state.trialMaxSeenAt, now)
  if (state.key && verifyLicenseKey(state.key).valid) return true
  return isTrialActive(state, now)
}

/** 仅供测试：重置主进程内存状态。 */
export function __resetLicenseStateForTest(): void {
  state = { key: null, trialStartedAt: null, trialMaxSeenAt: null, everActivated: false }
}
