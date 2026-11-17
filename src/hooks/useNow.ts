import { useEffect, useState } from 'react'

/**
 * 返回当前时间，每 intervalMs 毫秒刷新一次。
 * 用于试用剩余时间这类需要随时间更新的显示（不是只在启动时算一次）。
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
