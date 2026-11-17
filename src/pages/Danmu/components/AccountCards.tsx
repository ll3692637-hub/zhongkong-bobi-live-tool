import { useEffect, useState } from 'react'
import { DANMU_ACCOUNTS } from 'shared/danmu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDanmuActions, useDanmuStore } from '@/hooks/useDanmu'

const STATUS_TEXT: Record<DanmuAccountStatus, string> = {
  'logged-out': '未登录',
  'logging-in': '登录中',
  'need-sms': '等验证码',
  'logged-in': '已登录',
  expired: '已过期',
  'risk-disabled': '风控停用',
}

const STATUS_BADGE_VARIANT: Record<
  DanmuAccountStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  'logged-out': 'outline',
  'logging-in': 'secondary',
  'need-sms': 'secondary',
  'logged-in': 'default',
  expired: 'destructive',
  'risk-disabled': 'destructive',
}

function AccountCard({ account }: { account: DanmuAccountState }) {
  const { login, logout, submitSmsCode, getQrImage } = useDanmuActions()
  const loginBusy = useDanmuStore(s => s.snapshot?.loginBusy ?? false)
  const [smsCode, setSmsCode] = useState('')
  const [qrImage, setQrImage] = useState<string | null>(null)

  // 二维码就绪后取图；登录态变化时清掉旧图
  useEffect(() => {
    if (!account.qrReady) {
      setQrImage(null)
      return
    }
    let alive = true
    getQrImage(account.id).then(img => {
      if (alive) setQrImage(img)
    })
    const timer = setInterval(() => {
      getQrImage(account.id).then(img => {
        if (alive) setQrImage(img)
      })
    }, 5000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [account.qrReady, account.id, getQrImage])

  const isLogging = account.status === 'logging-in' || account.status === 'need-sms'
  const canLogin =
    account.status === 'logged-out' || account.status === 'expired' || account.status === 'risk-disabled'

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{account.id}</span>
          <Badge variant={STATUS_BADGE_VARIANT[account.status]}>
            {STATUS_TEXT[account.status]}
          </Badge>
        </div>

        {account.status === 'logged-in' && account.userName && (
          <p className="text-sm text-muted-foreground truncate" title={account.userName}>
            {account.userName}
          </p>
        )}

        {account.status === 'risk-disabled' && (
          <p className="text-xs text-destructive">触发风控已停用，换号或重新登录</p>
        )}
        {account.status === 'expired' && (
          <p className="text-xs text-muted-foreground">票据过期，请重新扫码</p>
        )}

        {account.qrReady && qrImage && (
          <div className="space-y-1">
            <img src={qrImage} alt={`${account.id} 登录二维码`} className="w-full rounded-md border" />
            <p className="text-xs text-muted-foreground">请用对应小号扫码，55 秒内有效</p>
          </div>
        )}
        {isLogging && !qrImage && (
          <p className="text-xs text-muted-foreground">二维码生成中…</p>
        )}

        {account.status === 'need-sms' && (
          <div className="flex gap-2">
            <Input
              value={smsCode}
              onChange={e => setSmsCode(e.target.value)}
              placeholder="6 位短信验证码"
              inputMode="numeric"
              maxLength={6}
            />
            <Button
              size="sm"
              onClick={() => {
                void submitSmsCode(account.id, smsCode)
                setSmsCode('')
              }}
            >
              提交
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          {canLogin && (
            <Button
              size="sm"
              variant="outline"
              disabled={loginBusy}
              onClick={() => void login(account.id)}
            >
              {account.status === 'logged-out' ? '扫码登录' : '重新扫码'}
            </Button>
          )}
          {isLogging && (
            <Button size="sm" variant="outline" disabled>
              登录中…
            </Button>
          )}
          {account.status === 'logged-in' && (
            <Button size="sm" variant="ghost" onClick={() => void logout(account.id)}>
              强制退出
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// 账号卡片：5 个槽位，扫码登录，二维码直接在应用里显示
export default function AccountCards() {
  const accounts = useDanmuStore(s => s.snapshot?.accounts ?? null)
  const { refreshLogins } = useDanmuActions()

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>小号账号</Label>
            <p className="text-sm text-muted-foreground">
              每个号扫码登录一次；票据约 1 小时过期，过期后重新扫码
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void refreshLogins()}>
            刷新状态
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {accounts
            ? accounts.map(a => <AccountCard key={a.id} account={a} />)
            : DANMU_ACCOUNTS.map(id => (
                <AccountCard
                  key={id}
                  account={{ id, status: 'logged-out', userName: '', qrReady: false, failCount: 0 }}
                />
              ))}
        </div>
      </CardContent>
    </Card>
  )
}
