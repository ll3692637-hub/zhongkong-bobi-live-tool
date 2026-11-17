/**
 * 72 小时免费试用：纯时间逻辑（主进程、渲染进程、单元测试共用）。
 *
 * 设计要点（见任务书）：
 * - 试用按墙钟算：从首次启动时间起 72 小时，不是累计使用 72 小时。
 * - 记录首次启动时间 trialStartedAt 与曾经观察到的最大时间 trialMaxSeenAt。
 * - 判断是否到期用“有效时间上界” effectiveNow = max(当前时间, trialMaxSeenAt)：
 *   时钟回拨时，有效时间停在历史最大值，试用不会被延长；
 *   也不因为一次回拨就永久处罚用户——时间调回来后试用继续走。
 * - 纯本地方案无法彻底抵御长期回拨或删除应用数据，接受这一 MVP 限制。
 */

export const TRIAL_DURATION_MS = 72 * 60 * 60 * 1000

export interface TrialState {
  /** 首次启动时间（unix 毫秒），null 表示从未开始过试用 */
  trialStartedAt: number | null
  /** 曾经观察到的最大本地时间（unix 毫秒），只增不减 */
  trialMaxSeenAt: number | null
  /** 是否曾经成功激活过卡密；一旦激活过，试用即视为已消费，到期后不再回落到试用 */
  everActivated: boolean
}

/** 有效时间上界：当前时间与历史最大时间的较大者。 */
export function effectiveNow(now: number, maxSeenAt: number | null): number {
  return maxSeenAt == null ? now : Math.max(now, maxSeenAt)
}

/** 试用结束时间（墙钟）。 */
export function trialEndsAt(startedAt: number): number {
  return startedAt + TRIAL_DURATION_MS
}

/**
 * 试用当前是否可用。
 * 未开始过试用、曾经激活过卡密、或已过 72 小时，均返回 false。
 */
export function isTrialActive(state: TrialState, now: number): boolean {
  if (state.trialStartedAt == null) return false
  if (state.everActivated) return false
  return effectiveNow(now, state.trialMaxSeenAt) < trialEndsAt(state.trialStartedAt)
}

/**
 * 试用是否已经结束（开始过、且不在有效期内；曾经激活过卡密的不算“试用结束”，
 * 那是卡密到期，走卡密那条提示）。
 */
export function isTrialEnded(state: TrialState, now: number): boolean {
  if (state.trialStartedAt == null) return false
  if (state.everActivated) return false
  return !isTrialActive(state, now)
}

/** 试用剩余毫秒；未开始过试用返回 null；已结束返回 <= 0 的数。 */
export function trialRemainingMs(state: TrialState, now: number): number | null {
  if (state.trialStartedAt == null) return null
  return trialEndsAt(state.trialStartedAt) - effectiveNow(now, state.trialMaxSeenAt)
}

/** 推进一次时间观测：只增不减。返回更新后的最大值。 */
export function advanceMaxSeenAt(maxSeenAt: number | null, now: number): number {
  return maxSeenAt == null ? now : Math.max(maxSeenAt, now)
}

/** 把剩余毫秒格式化成「X 天 X 小时」；不足 1 天显示小时，不足 1 小时显示分钟。 */
export function formatTrialRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} 天 ${hours} 小时`
  if (hours > 0) return `${hours} 小时`
  return `${minutes} 分钟`
}
