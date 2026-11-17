import { describe, expect, it } from 'vitest'
import {
  advanceMaxSeenAt,
  effectiveNow,
  formatTrialRemaining,
  isTrialActive,
  isTrialEnded,
  TRIAL_DURATION_MS,
  trialEndsAt,
  trialRemainingMs,
  type TrialState,
} from './trial'

const HOUR = 3600_000
const T0 = 1794000000000 // 固定起点（2026-11-17 左右），避免依赖真实当前时间

function freshTrial(startedAt: number = T0): TrialState {
  return { trialStartedAt: startedAt, trialMaxSeenAt: startedAt, everActivated: false }
}

describe('72 小时试用时间逻辑', () => {
  it('试用从首次启动起算 72 小时（墙钟制）', () => {
    const s = freshTrial()
    expect(trialEndsAt(T0)).toBe(T0 + TRIAL_DURATION_MS)
    expect(TRIAL_DURATION_MS).toBe(72 * HOUR)
    expect(isTrialActive(s, T0 + 71 * HOUR)).toBe(true)
    expect(isTrialActive(s, T0 + 72 * HOUR)).toBe(false)
    expect(isTrialActive(s, T0 + 73 * HOUR)).toBe(false)
  })

  it('未开始过试用时一律不可用', () => {
    const s: TrialState = { trialStartedAt: null, trialMaxSeenAt: null, everActivated: false }
    expect(isTrialActive(s, T0)).toBe(false)
    expect(isTrialEnded(s, T0)).toBe(false)
    expect(trialRemainingMs(s, T0)).toBeNull()
  })

  it('剩余时间随时间减少', () => {
    const s = freshTrial()
    expect(trialRemainingMs(s, T0)).toBe(72 * HOUR)
    expect(trialRemainingMs(s, T0 + 24 * HOUR)).toBe(48 * HOUR)
    expect(trialRemainingMs(s, T0 + 72 * HOUR)).toBe(0)
  })

  it('时钟回拨不能延长试用：有效时间停在历史最大值', () => {
    const s = freshTrial()
    // 先观测到 T0+10h，再把时钟拨回 T0+1h：有效时间仍是 T0+10h
    const seen = advanceMaxSeenAt(s.trialMaxSeenAt, T0 + 10 * HOUR)
    const rolledBack = { ...s, trialMaxSeenAt: seen }
    expect(effectiveNow(T0 + 1 * HOUR, seen)).toBe(T0 + 10 * HOUR)
    expect(trialRemainingMs(rolledBack, T0 + 1 * HOUR)).toBe(62 * HOUR)
  })

  it('一次回拨不永久处罚用户：时间调回来后试用继续走', () => {
    const s = freshTrial()
    const seen = advanceMaxSeenAt(s.trialMaxSeenAt, T0 + 10 * HOUR)
    const rolledBack = { ...s, trialMaxSeenAt: seen }
    // 时钟拨回 T0+1h 时试用仍有效（剩余 62h）；时钟恢复到 T0+11h 时剩余 61h，继续走
    expect(isTrialActive(rolledBack, T0 + 1 * HOUR)).toBe(true)
    expect(isTrialActive(rolledBack, T0 + 11 * HOUR)).toBe(true)
    expect(trialRemainingMs(rolledBack, T0 + 11 * HOUR)).toBe(61 * HOUR)
  })

  it('长期回拨也无法延长：有效时间永远不低于历史最大值', () => {
    const s = freshTrial()
    const seen = advanceMaxSeenAt(s.trialMaxSeenAt, T0 + 71 * HOUR)
    const rolledBack = { ...s, trialMaxSeenAt: seen }
    // 试用到 T0+71h 时只剩 1h；把时钟拨回 T0，剩余仍是 1h
    expect(trialRemainingMs(rolledBack, T0)).toBe(1 * HOUR)
    // 再往前走 1h（按有效时间）就到期
    expect(isTrialActive(rolledBack, T0 + 72 * HOUR)).toBe(false)
    expect(isTrialEnded(rolledBack, T0 + 72 * HOUR)).toBe(true)
  })

  it('advanceMaxSeenAt 只增不减', () => {
    expect(advanceMaxSeenAt(null, T0)).toBe(T0)
    expect(advanceMaxSeenAt(T0 + 5 * HOUR, T0 + 1 * HOUR)).toBe(T0 + 5 * HOUR)
    expect(advanceMaxSeenAt(T0 + 5 * HOUR, T0 + 9 * HOUR)).toBe(T0 + 9 * HOUR)
  })

  it('曾经激活过卡密，试用即视为已消费，不再回落', () => {
    const s: TrialState = { ...freshTrial(), everActivated: true }
    expect(isTrialActive(s, T0 + 1 * HOUR)).toBe(false)
    expect(isTrialEnded(s, T0 + 1 * HOUR)).toBe(false)
  })

  it('剩余时间格式化', () => {
    expect(formatTrialRemaining(50 * HOUR)).toBe('2 天 2 小时')
    expect(formatTrialRemaining(72 * HOUR)).toBe('3 天 0 小时')
    expect(formatTrialRemaining(5 * HOUR)).toBe('5 小时')
    expect(formatTrialRemaining(30 * 60000)).toBe('30 分钟')
    expect(formatTrialRemaining(-1000)).toBe('0 分钟')
  })
})
