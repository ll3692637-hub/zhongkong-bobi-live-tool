import { useEffect, useMemo, useState } from 'react'
import { TriangleAlertIcon } from 'lucide-react'
import { countMessages, parseMessageGroups } from 'shared/danmu'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Title } from '@/components/common/Title'
import { useDanmuActions, useDanmuCounts, useDanmuStore } from '@/hooks/useDanmu'
import { useToast } from '@/hooks/useToast'
import AccountCards from './components/AccountCards'
import MessageLibraryCard from './components/MessageLibraryCard'
import SendControlCard from './components/SendControlCard'

export default function Danmu() {
  const snapshot = useDanmuStore(s => s.snapshot)
  const messagesText = useDanmuStore(s => s.messagesText)
  const roomId = useDanmuStore(s => s.roomId)
  const { start, stop, fetchStatus, refreshLogins } = useDanmuActions()
  const { groups, total } = useDanmuCounts()
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const sending = snapshot?.sending ?? false
  const preview = useMemo(() => {
    return parseMessageGroups(messagesText)
      .flat()
      .slice(0, 5)
  }, [messagesText])

  // 进页面先拉一次状态并刷新登录态
  useEffect(() => {
    void fetchStatus()
    void refreshLogins()
  }, [fetchStatus, refreshLogins])

  const handleStartClick = () => {
    if (groups === 0) {
      toast.error('文案库为空，请先填写文案')
      return
    }
    if (!roomId.trim()) {
      toast.error('请先填写直播间号')
      return
    }
    const loggedIn = (snapshot?.accounts ?? []).filter(a => a.status === 'logged-in').length
    if (loggedIn === 0) {
      toast.error('请先登录至少一个小号')
      return
    }
    setConfirmOpen(true)
  }

  return (
    <div className="container py-8 space-y-4">
      <div className="flex items-center justify-between">
        <Title title="批量弹幕" description="小号轮番发文案：先确认文案，再开始发送" />
        {sending ? (
          <Button variant="destructive" onClick={() => void stop()}>
            停止任务
          </Button>
        ) : (
          <Button onClick={handleStartClick}>开始任务</Button>
        )}
      </div>

      <Alert variant="destructive">
        <TriangleAlertIcon className="h-4 w-4" />
        <AlertTitle>只用小号，绝不用主力号 / 工作号</AlertTitle>
        <AlertDescription>
          封号风险自担，工具不保证送达；文案由你自己确认，开始发送前请再看一遍。
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        <AccountCards />
        <MessageLibraryCard />
        <SendControlCard />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认开始批量发送？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  直播间号：{roomId.trim()}，共 {groups} 组 / {total} 条，
                  {snapshot?.accounts.filter(a => a.status === 'logged-in').length ?? 0}{' '}
                  个小号在线轮换发送。
                </p>
                <div className="rounded-md border p-3 space-y-1">
                  {preview.map((line, i) => (
                    <p key={i} className="text-sm text-foreground truncate">
                      {i + 1}. {line}
                    </p>
                  ))}
                  {total > preview.length && (
                    <p className="text-xs text-muted-foreground">
                      …以及其余 {total - preview.length} 条（完整分组见文案库）
                    </p>
                  )}
                </div>
                <p>开始后按分组顺序发送，中途可暂停 / 停止；被风控的号会自动停用。</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void start()
                setConfirmOpen(false)
              }}
            >
              文案我看过了，确认开始
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
