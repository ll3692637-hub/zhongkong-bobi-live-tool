import { useNavigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Title } from '@/components/common/Title'
import { useLicenseStore } from '@/hooks/useLicense'
import InstructionsCard from './components/InstructionsCard'
import StatusCard from './components/StatusCard'

export default function BrowserControl() {
  const licenseStatus = useLicenseStore(s => s.status)
  const navigate = useNavigate()

  return (
    <div className="container py-8 space-y-4">
      <div>
        <Title title="直播控制台" description="连接并管理您的直播控制台" />
      </div>

      <div className="space-y-8">
        {licenseStatus !== 'valid' && (
          <Alert>
            <AlertTitle>还没输卡密</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>
                自动弹窗、自动发言、自动回复、发红包要输了卡密才能用，先去设置里激活。
              </span>
              <Button size="sm" onClick={() => navigate('/settings')}>
                去设置输卡密
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <StatusCard />
        <InstructionsCard />
      </div>
    </div>
  )
}
