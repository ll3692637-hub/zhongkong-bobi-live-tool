import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLicenseStore } from '@/hooks/useLicense'

/**
 * 卡密授权卡片。放在设置页最上面。
 * 卡密有效才能用自动弹窗、自动发言、自动回复、一键发红包这四项自动化功能。
 */
export function LicenseCard() {
  const key = useLicenseStore(s => s.key)
  const status = useLicenseStore(s => s.status)
  const expiresAt = useLicenseStore(s => s.expiresAt)
  const daysLeft = useLicenseStore(s => s.daysLeft)
  const activating = useLicenseStore(s => s.activating)
  const activate = useLicenseStore(s => s.activate)
  const clear = useLicenseStore(s => s.clear)

  const [input, setInput] = useState('')

  const handleActivate = async () => {
    if (!input.trim()) return
    await activate(input)
  }

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

        {status === 'invalid' && (
          <p className="text-sm text-red-500">
            卡密不对，请检查一下：是不是多复制了空格、是不是输错了字符，确认后重新输入
          </p>
        )}

        {status === 'expired' && (
          <p className="text-sm text-red-500">这张卡密已过期，请续费后重新输入新的卡密</p>
        )}

        {status === 'unknown' && (
          <p className="text-sm text-muted-foreground">
            还没激活。自动弹窗、自动发言、自动回复、发红包这四个功能要输了卡密才能用
          </p>
        )}
      </CardContent>
    </Card>
  )
}
