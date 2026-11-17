import { useEffect, useState } from 'react'
import { countMessages, parseMessageGroups } from 'shared/danmu'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useDanmuStore } from '@/hooks/useDanmu'

// 文案库：多行文本编辑，一行一条，空行分组；失焦时保存
export default function MessageLibraryCard() {
  const messagesText = useDanmuStore(s => s.messagesText)
  const setMessagesText = useDanmuStore(s => s.setMessagesText)
  const [draft, setDraft] = useState(messagesText)

  // 外部变化（如切换账号后恢复）时同步回编辑框
  useEffect(() => {
    setDraft(messagesText)
  }, [messagesText])

  const { groups, total } = countMessages(parseMessageGroups(draft))

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>文案库</Label>
            <p className="text-sm text-muted-foreground">
              一行一条，空行分组：一组由同一个号发完。共 {groups} 组 / {total} 条
            </p>
          </div>
        </div>

        <Textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => setMessagesText(draft)}
          placeholder={'这个颜色适合55岁老太太吗\n我妈皮肤有点黄，戴这个会不会显黑啊\n\n戴着扎脖子吗，我妈脖子皮肤特别敏感'}
          className="min-h-48 font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          修改后点编辑框外面自动保存；开始发送前会再让你确认一遍全文分组。
        </p>
      </CardContent>
    </Card>
  )
}
