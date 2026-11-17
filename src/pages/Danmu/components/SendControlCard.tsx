import { PauseIcon, PlayIcon, SquareIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useDanmuActions, useDanmuStore } from '@/hooks/useDanmu'

// 发送控制：直播间号、组间间隔、开始/暂停/停止、进度
export default function SendControlCard() {
  const roomId = useDanmuStore(s => s.roomId)
  const intervalMin = useDanmuStore(s => s.intervalMin)
  const intervalMax = useDanmuStore(s => s.intervalMax)
  const setRoomId = useDanmuStore(s => s.setRoomId)
  const setInterval = useDanmuStore(s => s.setInterval)
  const snapshot = useDanmuStore(s => s.snapshot)
  const { pause, resume, stop } = useDanmuActions()

  const sending = snapshot?.sending ?? false
  const paused = snapshot?.paused ?? false
  const progress = snapshot?.progress ?? { sent: 0, total: 0, groupIndex: 0, groupCount: 0 }
  const percent = progress.total > 0 ? Math.round((progress.sent / progress.total) * 100) : 0

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-1">
          <Label>发送控制</Label>
          <p className="text-sm text-muted-foreground">
            组内间隔固定：第 1→2 句 50–70 秒，之后 105–135 秒；组间间隔按下面设置
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>直播间号</Label>
            <Input
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              placeholder="直播间号（数字）"
              inputMode="numeric"
              disabled={sending}
            />
          </div>
          <div className="space-y-1">
            <Label>组间间隔（秒）</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={intervalMin}
                onChange={e =>
                  setInterval(Number(e.target.value) || 60, intervalMax)
                }
                className="w-24"
                min={5}
                placeholder="最小"
                disabled={sending}
              />
              <span className="text-sm text-muted-foreground">至</span>
              <Input
                type="number"
                value={intervalMax}
                onChange={e =>
                  setInterval(intervalMin, Number(e.target.value) || 120)
                }
                className="w-24"
                min={5}
                placeholder="最大"
                disabled={sending}
              />
              <span className="text-sm text-muted-foreground">秒</span>
            </div>
          </div>
        </div>

        {sending && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                已发 {progress.sent} / {progress.total} 条
                {progress.groupCount > 0 && `（第 ${progress.groupIndex} / ${progress.groupCount} 组）`}
              </span>
              <span className="text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} />
            <div className="flex gap-2">
              {paused ? (
                <Button size="sm" onClick={() => void resume()}>
                  <PlayIcon className="mr-2 h-4 w-4" />
                  继续
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void pause()}>
                  <PauseIcon className="mr-2 h-4 w-4" />
                  暂停
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => void stop()}>
                <SquareIcon className="mr-2 h-4 w-4" />
                停止
              </Button>
            </div>
          </div>
        )}
        {!sending && (
          <p className="text-xs text-muted-foreground">
            间隔下限至少 5 秒；修改配置在下次启动时生效。
          </p>
        )}
      </CardContent>
    </Card>
  )
}
