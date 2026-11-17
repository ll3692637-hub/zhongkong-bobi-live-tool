import { describe, expect, it } from 'vitest'
import {
  clampGroupInterval,
  countMessages,
  intraGroupWaitSeconds,
  parseMessageGroups,
  pickAccountForGroup,
  randomInt,
} from './danmu'

describe('parseMessageGroups', () => {
  it('按空行分组，一组由同一个号发完', () => {
    const groups = parseMessageGroups('你好\n在吗\n\n这个颜色适合吗\n显不显黑')
    expect(groups).toEqual([
      ['你好', '在吗'],
      ['这个颜色适合吗', '显不显黑'],
    ])
  })

  it('多空行、首尾空白行不产生空组', () => {
    const groups = parseMessageGroups('\n\n第一句\n\n\n第二句\n\n')
    expect(groups).toEqual([['第一句'], ['第二句']])
  })

  it('行内首尾空白被去掉，纯空白行不计入', () => {
    const groups = parseMessageGroups('  第一句  \n   \n第二句')
    expect(groups).toEqual([['第一句'], ['第二句']])
  })

  it('空文本分 0 组', () => {
    expect(parseMessageGroups('')).toEqual([])
    expect(parseMessageGroups('\n\n   \n')).toEqual([])
  })

  it('单组不含空行时整段为一组', () => {
    expect(parseMessageGroups('a\nb\nc')).toEqual([['a', 'b', 'c']])
  })
})

describe('countMessages', () => {
  it('组数与总条数', () => {
    expect(
      countMessages([
        ['a', 'b'],
        ['c'],
        ['d', 'e', 'f'],
      ]),
    ).toEqual({ groups: 3, total: 6 })
  })

  it('空分组为 0 组 0 条', () => {
    expect(countMessages([])).toEqual({ groups: 0, total: 0 })
  })
})

describe('intraGroupWaitSeconds', () => {
  it('第 1→2 句取 50–70 秒区间', () => {
    expect(intraGroupWaitSeconds(0, (min, max) => min)).toBe(50)
    expect(intraGroupWaitSeconds(0, (min, max) => max)).toBe(70)
  })

  it('第 2 句之后取 105–135 秒区间', () => {
    expect(intraGroupWaitSeconds(1, (min, max) => min)).toBe(105)
    expect(intraGroupWaitSeconds(2, (min, max) => max)).toBe(135)
  })
})

describe('pickAccountForGroup', () => {
  it('按组序号轮换选号', () => {
    const available = ['shuijun1', 'shuijun2', 'shuijun3']
    expect(pickAccountForGroup(available, 0)).toBe('shuijun1')
    expect(pickAccountForGroup(available, 1)).toBe('shuijun2')
    expect(pickAccountForGroup(available, 2)).toBe('shuijun3')
    expect(pickAccountForGroup(available, 3)).toBe('shuijun1')
    expect(pickAccountForGroup(available, 4)).toBe('shuijun2')
  })

  it('无可用账号返回 null', () => {
    expect(pickAccountForGroup([], 0)).toBeNull()
  })

  it('只剩一个可用账号时每组都由它发', () => {
    expect(pickAccountForGroup(['shuijun5'], 7)).toBe('shuijun5')
  })
})

describe('clampGroupInterval', () => {
  it('正常值原样通过', () => {
    expect(clampGroupInterval(60, 120)).toEqual([60, 120])
  })

  it('下限低于 5 秒时夹到 5 秒', () => {
    expect(clampGroupInterval(1, 120)).toEqual([5, 120])
    expect(clampGroupInterval(0, 30)).toEqual([5, 30])
  })

  it('上限小于下限时上限抬到与下限相等', () => {
    expect(clampGroupInterval(90, 30)).toEqual([90, 90])
  })

  it('非法输入回落到默认 60–120', () => {
    expect(clampGroupInterval(Number.NaN, Number.NaN)).toEqual([60, 120])
  })
})

describe('randomInt', () => {
  it('返回值落在闭区间内', () => {
    for (let i = 0; i < 200; i++) {
      const v = randomInt(50, 70)
      expect(v).toBeGreaterThanOrEqual(50)
      expect(v).toBeLessThanOrEqual(70)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('min === max 时返回该值', () => {
    expect(randomInt(15, 15)).toBe(15)
  })
})
