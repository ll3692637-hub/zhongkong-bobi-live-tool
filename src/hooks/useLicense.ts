import { useCallback } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import {
  advanceMaxSeenAt,
  formatTrialRemaining,
  isTrialActive,
  isTrialEnded,
  trialRemainingMs,
  type TrialState,
} from 'shared/trial'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useToast } from './useToast'

export type LicenseStatus = 'unknown' | 'valid' | 'invalid' | 'expired'

/** 激活失败时的瞬时错误（不持久化，只用来在界面上区分“卡密不对”和“校验服务不可用”） */
export type ActivationError = 'invalid' | 'unavailable' | null

interface LicenseState extends TrialState {
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
  /** 最近一次激活失败的原因（瞬时状态，不持久化） */
  activationError: ActivationError
  /** 输入卡密并校验，返回校验后的状态 */
  activate: (key: string) => Promise<LicenseStatus>
  /** 启动时用已存的卡密重新校验一次 */
  recheck: () => Promise<void>
  /** 清除已存卡密 */
  clear: () => void
  /**
   * 启动时初始化试用（幂等，可安全重复调用）：
   * 只有“没有存过卡密、没激活过卡密、没开始过试用”时才创建 72 小时试用；
   * 其余情况只推进最大时间观测，不动已有授权。
   * 创建后同步给主进程，供主进程授权复核用。
   */
  ensureTrial: () => void
  /** 推进最大时间观测（只增不减），供启动时、守卫、倒计时刷新时调用 */
  observeTrialClock: () => void
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

/** 把当前授权状态同步给主进程（fire-and-forget，主进程用它做任务启动时的复核）。 */
function syncLicenseToMain() {
  const s = useLicenseStore.getState()
  window.ipcRenderer
    .invoke(IPC_CHANNELS.app.licenseSync, {
      key: s.key || null,
      trialStartedAt: s.trialStartedAt,
      trialMaxSeenAt: s.trialMaxSeenAt,
      everActivated: s.everActivated,
    })
    .catch(() => {
      // 同步失败不影响界面；主进程收不到同步时复核默认拒绝，任务启动会失败并提示
    })
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
      activationError: null,
      trialStartedAt: null,
      trialMaxSeenAt: null,
      everActivated: false,
      activate: async (rawKey: string) => {
        const key = rawKey.trim()
        set({ activating: true, activationError: null })
        try {
          const result = await window.ipcRenderer.invoke(IPC_CHANNELS.app.licenseVerify, key)
          const mapped = mapResult(result)
          if (result.valid) {
            // 只有验签通过才写入：成功激活即视为试用已消费（everActivated），
            // 卡密到期后不再回落到试用。
            set({
              key,
              ...mapped,
              lastCheckedAt: Date.now(),
              activating: false,
              activationError: null,
              everActivated: true,
            })
            syncLicenseToMain()
            return mapped.status
          }
          // 卡密校验失败：不碰已存的 key/status——输错卡密不清除仍然有效的既有授权。
          // 错误只记在瞬时的 activationError 里，由界面显示，不持久化。
          set({ activating: false, activationError: 'invalid' })
          return 'invalid'
        } catch {
          // 主进程校验通道异常：与“卡密错误”区分，同样不碰已存状态。
          set({ activating: false, activationError: 'unavailable' })
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
      clear: () => {
        // 注意：everActivated 不清除——激活过一次，试用即视为已消费，
        // 清除卡密后也不会重新获得试用。
        set({
          key: '',
          status: 'unknown',
          expiresAt: null,
          daysLeft: null,
          lastCheckedAt: null,
          activationError: null,
        })
        syncLicenseToMain()
      },
      ensureTrial: () => {
        const now = Date.now()
        // 用 set 的 updater 做原子判断：即使被重复调用（例如 StrictMode 双 effect），
        // 试用也只会创建一次；已有卡密或已激活过的用户不会创建试用。
        set(s => {
          const patch: {
            everActivated?: boolean
            trialMaxSeenAt?: number
            trialStartedAt?: number
          } = {}
          // 迁移口径：存过卡密即视为激活过（老版本没有 everActivated 字段）。
          // 这样老用户卡密到期或清除后，不会错误地重新获得 72 小时试用。
          if (s.key && !s.everActivated) patch.everActivated = true
          if (s.trialStartedAt != null) {
            patch.trialMaxSeenAt = advanceMaxSeenAt(s.trialMaxSeenAt, now)
            return patch
          }
          // 只有“没存过卡密、没激活过、没开始过试用”才创建试用
          if (s.key || s.everActivated || patch.everActivated) return patch
          patch.trialStartedAt = now
          patch.trialMaxSeenAt = now
          return patch
        })
        syncLicenseToMain()
      },
      observeTrialClock: () => {
        const now = Date.now()
        set(s =>
          s.trialStartedAt == null
            ? s
            : { trialMaxSeenAt: advanceMaxSeenAt(s.trialMaxSeenAt, now) },
        )
      },
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
        trialStartedAt: state.trialStartedAt,
        trialMaxSeenAt: state.trialMaxSeenAt,
        everActivated: state.everActivated,
      }),
    },
  ),
)

/** 试用剩余时间的显示文案（未开始过试用返回 null）。 */
export function getTrialRemainingText(state: TrialState, now: number): string | null {
  const remaining = trialRemainingMs(state, now)
  if (remaining == null) return null
  return formatTrialRemaining(remaining)
}

/**
 * 在启动自动化功能前调用：卡密有效或试用期内返回 true，否则弹提示并返回 false。
 * 拦住的是自动弹窗、自动发言、自动回复、一键发红包这四项。
 * （主进程在任务启动时还会再复核一次，这里只是第一道关、负责给用户看得懂的提示。）
 */
export function useLicenseGuard() {
  const { toast } = useToast()
  return useCallback(() => {
    // 先推进一次时间观测，再判断，避免会话中回拨时钟延长试用
    useLicenseStore.getState().observeTrialClock()
    const s = useLicenseStore.getState()
    const now = Date.now()
    if (s.status === 'valid') return true
    if (isTrialActive(s, now)) return true
    if (s.status === 'expired') {
      toast.error('卡密已过期，请续费后在设置里重新输入')
    } else if (isTrialEnded(s, now)) {
      toast.error('免费体验已结束，输入卡密即可继续使用')
    } else {
      toast.error('请先在设置里输入卡密激活，才能用这个功能')
    }
    return false
  }, [toast])
}
