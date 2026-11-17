import { useMemoizedFn } from 'ahooks'
import { useMemo } from 'react'
import { DANMU_DEFAULT_INTERVAL, countMessages, parseMessageGroups } from 'shared/danmu'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { useLicenseGuard } from './useLicense'
import { useToast } from './useToast'

/**
 * 批量弹幕的渲染态。
 *
 * 持久化（danmu-storage）：文案库全文、直播间号、组间间隔。
 * 不持久化：账号与发送状态快照（主进程持有，启动 / 状态变化时推过来）。
 * 注意：批量弹幕不依赖直播控制台连接（走 catbus CLI 直发），
 * 所以不走 useTaskControl（它的 TaskButton 要求先连中控台）。
 */
interface DanmuStore {
  messagesText: string
  roomId: string
  intervalMin: number
  intervalMax: number
  snapshot: DanmuSnapshot | null
  setMessagesText: (text: string) => void
  setRoomId: (roomId: string) => void
  setInterval: (min: number, max: number) => void
  setSnapshot: (snapshot: DanmuSnapshot) => void
}

export const useDanmuStore = create<DanmuStore>()(
  persist(
    immer(set => ({
      messagesText: '',
      roomId: '',
      intervalMin: DANMU_DEFAULT_INTERVAL[0],
      intervalMax: DANMU_DEFAULT_INTERVAL[1],
      snapshot: null,
      setMessagesText: text =>
        set(state => {
          state.messagesText = text
        }),
      setRoomId: roomId =>
        set(state => {
          state.roomId = roomId
        }),
      setInterval: (min, max) =>
        set(state => {
          state.intervalMin = min
          state.intervalMax = max
        }),
      setSnapshot: snapshot =>
        set(state => {
          state.snapshot = snapshot
        }),
    })),
    {
      name: 'danmu-storage',
      version: 1,
      partialize: state => ({
        messagesText: state.messagesText,
        roomId: state.roomId,
        intervalMin: state.intervalMin,
        intervalMax: state.intervalMax,
      }),
    },
  ),
)

/** 文案分组统计（组数、总条数），供确认弹窗与文案库展示用。 */
export function useDanmuCounts() {
  const messagesText = useDanmuStore(s => s.messagesText)
  return useMemo(() => countMessages(parseMessageGroups(messagesText)), [messagesText])
}

export const useDanmuActions = () => {
  const { toast } = useToast()
  const ensureLicensed = useLicenseGuard()

  const start = useMemoizedFn(async () => {
    if (!ensureLicensed()) return false
    const s = useDanmuStore.getState()
    const { groups, total } = countMessages(parseMessageGroups(s.messagesText))
    if (groups === 0) {
      toast.error('文案库为空，请先填写文案')
      return false
    }
    if (!s.roomId.trim()) {
      toast.error('请先填写直播间号')
      return false
    }
    const loggedIn = (s.snapshot?.accounts ?? []).filter(a => a.status === 'logged-in').length
    if (loggedIn === 0) {
      toast.error('请先登录至少一个小号')
      return false
    }
    const ok = await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.start, {
      roomId: s.roomId.trim(),
      intervalMin: s.intervalMin,
      intervalMax: s.intervalMax,
      messagesText: s.messagesText,
    })
    if (ok) {
      toast.success(`批量弹幕已启动，共 ${groups} 组 / ${total} 条`)
    } else {
      toast.error('批量弹幕启动失败（可能未授权或正在发送）')
    }
    return ok
  })

  const stop = useMemoizedFn(async () => {
    await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.stop)
  })

  const pause = useMemoizedFn(async () => {
    await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.pause)
  })

  const resume = useMemoizedFn(async () => {
    await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.resume)
  })

  const login = useMemoizedFn(async (account: string) => {
    const r = await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.login, account)
    if (!r.ok && r.reason === 'busy') {
      toast.error('已有其他账号正在登录，请等它完成后再扫')
    }
    return r.ok
  })

  const logout = useMemoizedFn(async (account: string) => {
    await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.logout, account)
  })

  const submitSmsCode = useMemoizedFn(async (account: string, code: string) => {
    if (!code.trim()) {
      toast.error('请先输入 6 位验证码')
      return
    }
    await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.submitSmsCode, account, code.trim())
    toast.success('验证码已提交')
  })

  const refreshLogins = useMemoizedFn(async () => {
    await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.refreshLogins)
  })

  const getQrImage = useMemoizedFn(async (account: string) => {
    return await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.getQrImage, account)
  })

  const fetchStatus = useMemoizedFn(async () => {
    const snapshot = await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.danmu.getStatus)
    useDanmuStore.getState().setSnapshot(snapshot)
  })

  return useMemo(
    () => ({
      start,
      stop,
      pause,
      resume,
      login,
      logout,
      submitSmsCode,
      refreshLogins,
      getQrImage,
      fetchStatus,
    }),
    [start, stop, pause, resume, login, logout, submitSmsCode, refreshLogins, getQrImage, fetchStatus],
  )
}
