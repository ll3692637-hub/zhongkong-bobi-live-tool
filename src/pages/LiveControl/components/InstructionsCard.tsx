import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const steps = [
  {
    title: '第一步：连上中控台',
    text: '上面点「连接直播控制台」，在弹出的浏览器里登录你的中控台账号，看到绿点就是连上了。第一次用要点一下登录，以后会自动记住。',
  },
  {
    title: '第二步：把东西准备好',
    text: '去「自动弹窗」里挑好商品、设好什么时候弹；去「自动发言」「自动回复」里把要说的话填好。AI 回复默认是关的，不填 key 也能用关键词回复。',
  },
  {
    title: '第三步：开始任务',
    text: '开播后，到「自动弹窗」「自动发言」「自动回复」里点「开始任务」，直播时它就自己干活了，你只管看。注意：这几项要先在设置里输卡密激活。',
  },
]

const InstructionsCard = React.memo(() => (
  <Card>
    <CardHeader>
      <CardTitle>三步上手</CardTitle>
      <CardDescription>第一次用，照着这三步走就行</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-4">
        {steps.map((step, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 下标无妨
          <div className="flex gap-3" key={index}>
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-primary">{index + 1}</span>
            </div>
            <div>
              <p className="text-sm font-medium leading-6">{step.title}</p>
              <p className="text-sm text-muted-foreground leading-6">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
))

export default InstructionsCard
