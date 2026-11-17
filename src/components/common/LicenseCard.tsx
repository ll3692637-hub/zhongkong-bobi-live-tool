import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLicenseStore, getTrialRemainingText } from '@/hooks/useLicense'
import { useNow } from '@/hooks/useNow'
import { isTrialActive, isTrialEnded, trialEndsAt } from 'shared/trial'

/**
 * 卡密授权卡片。放在设置页最上面。
 * 只显示三个核心状态：试用中 / 试用结束 / 已激活。
 * 卡密输入入口一直保留：试用期内也可以提前激活。
 * 试用剩余时间每 30 秒刷新一次，不是只在启动时算一次。
 */
export function LicenseCard() {
  const key = useLicenseStore(s => s.key)
  const status = useLicenseStore(s => s.status)
  const expiresAt = useLicenseStore(s => s.expiresAt)
  const daysLeft = useLicenseStore(s => s.daysLeft)
  const activating = useLicenseStore(s => s.activating)
  const activationError = useLicenseStore(s => s.activationError)
  const trialStartedAt = useLicenseStore(s => s.trialStartedAt)
  const trialMaxSeenAt = useLicenseStore(s => s.trialMaxSeenAt)
  const everActivated = useLicenseStore(s => s.everActivated)
  const trialState = { trialStartedAt, trialMaxSeenAt, everActivated }
  const activate = useLicenseStore(s => s.activate)
  const clear = useLicenseStore(s => s.clear)

  const [input, setInput] = useState('')
  const now = useNow()

  const handleActivate = async () => {
    if (!input.trim()) return
    await activate(input)
  }

  const trialActive = status !== 'valid' && isTrialActive(trialState, now)
  const trialEnded = status !== 'valid' && isTrialEnded(trialState, now)

  return (
    <Card>
      <CardHeader>
        <CardTitle>卡密授权</CardTitle>
        <CardDescription>
          输入购买时拿到的卡密，激活后才能用自动弹窗、自动发言、自动回复、一键发红包
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>卡密</Label>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="粘贴卡密，如 BOBI1.xxx.yyy"
              className="font-mono"
              onKeyDown={e => {
                if (e.key === 'Enter') void handleActivate()
              }}
            />
            <Button onClick={() => void handleActivate()} disabled={activating || !input.trim()}>
              {activating ? '校验中...' : '激活'}
            </Button>
            {key && (
              <Button variant="outline" onClick={clear}>
                清除
              </Button>
            )}
          </div>
        </div>

        {status === 'valid' && expiresAt && (
          <div className="space-y-1">
            <p className="text-sm text-green-600">
              已激活，有效期至 {new Date(expiresAt).toLocaleDateString('zh-CN')}，还剩{' '}
              {daysLeft} 天
            </p>
            {daysLeft !== null && daysLeft <= 7 && (
              <p className="text-sm text-amber-600">
                快到期了（还剩 {daysLeft} 天），记得找客服续费，不然到期就用不了了
              </p>
            )}
          </div>
        )}

        {trialActive && trialState.trialStartedAt != null && (
          <p className="text-sm text-green-600">
            正在免费试用，剩余 {getTrialRemainingText(trialState, now)}（至{' '}
            {new Date(trialEndsAt(trialState.trialStartedAt)).toLocaleString('zh-CN')}）。
            试用期内四个功能都能用，也可以现在就输卡密提前激活。
          </p>
        )}

        {trialEnded && (
          <p className="text-sm text-amber-600">免费体验已结束，输入卡密即可继续使用。</p>
        )}

        {activationError === 'invalid' && (
          <p className="text-sm text-red-500">
            卡密不对，请检查一下：是不是多复制了空格、是不是输错了字符，确认后重新输入
          </p>
        )}

        {activationError === 'unavailable' && (
          <p className="text-sm text-red-500">
            校验服务暂时不可用，请稍后再试一次（已激活的卡密不受影响）
          </p>
        )}

        {status === 'invalid' && activationError !== 'invalid' && (
          <p className="text-sm text-red-500">
            卡密不对，请检查一下：是不是多复制了空格、是不是输错了字符，确认后重新输入
          </p>
        )}

        {status === 'expired' && (
          <p className="text-sm text-red-500">这张卡密已过期，请续费后重新输入新的卡密</p>
        )}

        {status === 'unknown' && !trialActive && !trialEnded && (
          <p className="text-sm text-muted-foreground">
            还没激活。自动弹窗、自动发言、自动回复、发红包这四个功能要输了卡密才能用
          </p>
        )}
      </CardContent>
    </Card>
  )
}
