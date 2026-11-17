/**
 * 批量弹幕：纯逻辑（主进程、渲染进程、单元测试共用）。
 *
 * 移植自 ~/workspace/shuijun-deploy/server.js 的分组发送模式，
 * 行为与之一致：
 * - 文案按空行分组，一组 = 一个观众的心路历程，由同一个号发完；
 * - 组内间隔：第 1→2 句 50–70 秒，之后 105–135 秒；
 * - 组间间隔用配置的 intervalMin/intervalMax（默认 60–120 秒，下限至少 5 秒）；
 * - 每组轮换选号：第 groupIndex 组由 available[groupIndex % available.length] 发。
 */

/** 批量弹幕账号槽位（固定 5 个，与原启动器一致）。 */
export const DANMU_ACCOUNTS = ['shuijun1', 'shuijun2', 'shuijun3', 'shuijun4', 'shuijun5'] as const

export type DanmuAccountId = (typeof DANMU_ACCOUNTS)[number]

/** 组间间隔默认 60–120 秒；下限不得低于 5 秒。 */
export const DANMU_DEFAULT_INTERVAL: [number, number] = [60, 120]
export const DANMU_MIN_INTERVAL_SECONDS = 5

/** 文案按空行分组：每行去首尾空白，空行分隔，空组丢弃。 */
export function parseMessageGroups(text: string): string[][] {
  return text
    .split(/\n\s*\n/)
    .map(g =>
      g
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
    )
    .filter(g => g.length > 0)
}

/** 组数与总条数。 */
export function countMessages(groups: string[][]): { groups: number; total: number } {
  return {
    groups: groups.length,
    total: groups.reduce((sum, g) => sum + g.length, 0),
  }
}

/** [min, max] 闭区间随机整数。 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 组内等待秒数：第 1→2 句 50–70 秒，之后 105–135 秒。
 * rand 由调用方传入，便于单测用确定性随机数覆盖边界。
 */
export function intraGroupWaitSeconds(
  position: number,
  rand: (min: number, max: number) => number,
): number {
  return position === 0 ? rand(50, 70) : rand(105, 135)
}

/** 轮换选号：第 groupIndex 组由 available[groupIndex % available.length] 发；无可用账号返回 null。 */
export function pickAccountForGroup(available: string[], groupIndex: number): string | null {
  if (available.length === 0) return null
  return available[groupIndex % available.length]
}

/** 组间间隔夹取：下限至少 5 秒，上限不小于下限；非法输入回落到默认值。 */
export function clampGroupInterval(min: number, max: number): [number, number] {
  // 注意：不能用 `||` 做回落——0 是合法的下限输入（会被夹到 5），但 0 是 falsy
  const loRaw = Number.isNaN(min) ? DANMU_DEFAULT_INTERVAL[0] : Math.floor(min)
  const hiRaw = Number.isNaN(max) ? DANMU_DEFAULT_INTERVAL[1] : Math.floor(max)
  const lo = Math.max(DANMU_MIN_INTERVAL_SECONDS, loRaw)
  const hi = Math.max(lo, hiRaw)
  return [lo, hi]
}
