import { useCallback } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useToast } from './useToast'

export type LicenseStatus = 'unknown' | 'valid' | 'invalid' | 'expired'

interface LicenseState {
  /** 买家输入的卡密原文 */
  key: string
  status: LicenseStatus
  /** 过期时间（unix 毫秒），仅有效时有值 */
  expiresAt: number | null
  /** 剩余整天数，仅有效时有值 */
  daysLeft: number | null
  lastCheckedAt: number | null
  /** 正在向主进程请求校验 */
  activating: boolean
  /** 输入卡密并校验，返回校验后的状态 */
  activate: (key: string) => Promise<LicenseStatus>
  /** 启动时用已存的卡密重新校验一次 */
  recheck: () => Promise<void>
  /** 清除已存卡密 */
  clear: () => void
}

function mapResult(result: LicenseVerifyResult): Pick<
  LicenseState,
  'status' | 'expiresAt' | 'daysLeft'
> {
  if (result.valid) {
    return {
      status: 'valid',
      expiresAt: result.expiresAt ?? null,
      daysLeft: result.daysLeft ?? null,
    }
  }
  return {
    status: result.reason === 'expired' ? 'expired' : 'invalid',
    expiresAt: null,
    daysLeft: null,
  }
}

export const useLicenseStore = create<LicenseState>()(
  persist(
    (set, get) => ({
      key: '',
      status: 'unknown',
      expiresAt: null,
      daysLeft: null,
      lastCheckedAt: null,
      activating: false,
      activate: async (rawKey: string) => {
        const key = rawKey.trim()
        set({ activating: true })
        try {
          const result = await window.ipcRenderer.invoke(IPC_CHANNELS.app.licenseVerify, key)
          const mapped = mapResult(result)
          set({ key, ...mapped, lastCheckedAt: Date.now(), activating: false })
          return mapped.status
        } catch {
          set({
            key,
            status: 'invalid',
            expiresAt: null,
            daysLeft: null,
            lastCheckedAt: Date.now(),
            activating: false,
          })
          return 'invalid'
        }
      },
      recheck: async () => {
        const { key } = get()
        if (!key) return
        try {
          const result = await window.ipcRenderer.invoke(IPC_CHANNELS.app.licenseVerify, key)
          set({ ...mapResult(result), lastCheckedAt: Date.now() })
        } catch {
          // 校验通道暂时不可用时不改状态，下次启动再验
        }
      },
      clear: () =>
        set({
          key: '',
          status: 'unknown',
          expiresAt: null,
          daysLeft: null,
          lastCheckedAt: null,
        }),
    }),
    {
      name: 'license-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        key: state.key,
        status: state.status,
        expiresAt: state.expiresAt,
        daysLeft: state.daysLeft,
        lastCheckedAt: state.lastCheckedAt,
      }),
    },
  ),
)

/**
 * 在启动自动化功能前调用：卡密有效返回 true，否则弹提示并返回 false。
 * 拦住的是自动弹窗、自动发言、自动回复、一键发红包这四项。
 */
export function useLicenseGuard() {
  const { toast } = useToast()
  return useCallback(() => {
    const { status } = useLicenseStore.getState()
    if (status === 'valid') return true
    if (status === 'expired') {
      toast.error('卡密已过期，请续费后在设置里重新输入')
    } else {
      toast.error('请先在设置里输入卡密激活，才能用这个功能')
    }
    return false
  }, [toast])
}
