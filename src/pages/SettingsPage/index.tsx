import { ChevronDownIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { APIKeyDialog } from '@/components/ai-chat/APIKeyDialog'
import { LicenseCard } from '@/components/common/LicenseCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Title } from '@/components/common/Title'
import { AccountSetting } from '@/pages/SettingsPage/components/AccountSetting'
import { BrowserSetting } from '@/pages/SettingsPage/components/BrowserSetting'
import { DevSetting } from '@/pages/SettingsPage/components/DevSetting'
import { OtherSetting } from '@/pages/SettingsPage/components/OtherSetting'
import { UpdateSetting } from '@/pages/SettingsPage/components/UpdateSetting'

export default function Settings() {
  const location = useLocation()
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // 处理锚点定位（因为是路由是 Hash 模式，无法自动处理锚点定位）
  useEffect(() => {
    const hash = location.hash
    if (hash) {
      const el = document.querySelector(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  })
  return (
    <div className="container py-8">
      <div className="mb-6">
        <Title title="设置" description="管理您的应用程序设置和偏好" />
      </div>

      <div className="space-y-8">
        <LicenseCard />
        <UpdateSetting />
        <AccountSetting />
        <OtherSetting />

        {/* 进阶设置默认收起，小白不用管；要用再点开 */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>进阶设置</CardTitle>
                  <CardDescription>浏览器、AI 服务商这些一般用不上的设置</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm">
                    {advancedOpen ? '收起' : '展开'}
                    <ChevronDownIcon
                      className={`ml-2 h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-8">
                <BrowserSetting />
                <DevSetting />
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium leading-none">AI 服务商</h4>
                    <p className="text-sm text-muted-foreground">
                      AI 自动回复要用的 key。AI 回复默认是关的，想用再来这里填，按用量计费
                    </p>
                  </div>
                  <APIKeyDialog type="autoReply" />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  )
}
