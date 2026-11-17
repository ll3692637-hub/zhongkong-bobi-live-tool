import { describe, expect, it } from 'vitest'
import {
  __resetLicenseStateForTest,
  isAuthorized,
  syncLicenseState,
} from './licenseState'

const HOUR = 3600_000

describe('主进程授权复核 licenseState', () => {
  it('没有任何同步状态时拒绝（fail-closed）', () => {
    __resetLicenseStateForTest()
    expect(isAuthorized()).toBe(false)
  })

  it('试用期内同步后放行，过期后拒绝', () => {
    __resetLicenseStateForTest()
    // 同步了刚开始的试用（以当前时间为起点）时放行
    const now = Date.now()
    syncLicenseState({ trialStartedAt: now, trialMaxSeenAt: now, everActivated: false })
    expect(isAuthorized()).toBe(true)
    // 试用开始时间是 72 小时前 → 拒绝
    __resetLicenseStateForTest()
    syncLicenseState({
      trialStartedAt: now - 72 * HOUR,
      trialMaxSeenAt: now - 72 * HOUR,
      everActivated: false,
    })
    expect(isAuthorized()).toBe(false)
  })

  it('试用开始时间先到先得：后同步的更晚时间不覆盖', () => {
    __resetLicenseStateForTest()
    const now = Date.now()
    syncLicenseState({ trialStartedAt: now, trialMaxSeenAt: now, everActivated: false })
    // 渲染进程谎称试用刚开始（更晚的 startedAt），主进程不接受；
    // 再同步一个 73 小时前开始的试用，主进程也不接受覆盖。
    // 若 first-seen 被覆盖，存下的 startedAt 会变成 now-73h，复核会拒绝；
    // 正确行为是仍以第一次同步的 now 为准，试用有效。
    syncLicenseState({
      trialStartedAt: now + HOUR,
      trialMaxSeenAt: now + HOUR,
      everActivated: false,
    })
    syncLicenseState({
      trialStartedAt: now - 73 * HOUR,
      trialMaxSeenAt: now - 73 * HOUR,
      everActivated: false,
    })
    expect(isAuthorized()).toBe(true) // 仍以第一次同步的 now 为准，试用有效
  })

  it('验签失败的卡密不覆盖主进程状态；空串清除卡密', () => {
    __resetLicenseStateForTest()
    syncLicenseState({ key: 'not-a-real-key' })
    expect(isAuthorized()).toBe(false)
    // 之后再同步一个无效卡密，仍拒绝（且不影响试用同步）
    const now = Date.now()
    syncLicenseState({ trialStartedAt: now, trialMaxSeenAt: now, everActivated: false })
    syncLicenseState({ key: 'BOBI1.aaaa.bbbb' })
    expect(isAuthorized()).toBe(true) // 试用仍在，不受无效卡密影响
  })

  it('曾经激活过卡密，试用不再放行', () => {
    __resetLicenseStateForTest()
    const now = Date.now()
    syncLicenseState({
      trialStartedAt: now,
      trialMaxSeenAt: now,
      everActivated: true,
    })
    expect(isAuthorized()).toBe(false)
  })

  it('最大时间只增不减：时钟回拨后复核仍按历史最大值判断', () => {
    __resetLicenseStateForTest()
    const now = Date.now()
    // 试用在 71 小时前开始，最大时间已到 71h：只剩 1h
    syncLicenseState({
      trialStartedAt: now - 71 * HOUR,
      trialMaxSeenAt: now,
      everActivated: false,
    })
    // 渲染进程同步一个回拨后的最大时间（更小），主进程不接受回退
    syncLicenseState({ trialMaxSeenAt: now - 70 * HOUR })
    expect(isAuthorized()).toBe(true) // 仍在 72h 内
    // 但把“当前时间”推到 72h 后（通过同步更大的最大时间）→ 拒绝
    syncLicenseState({ trialMaxSeenAt: now + 2 * HOUR })
    expect(isAuthorized()).toBe(false)
  })
})
