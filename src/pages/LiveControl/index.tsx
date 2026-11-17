import { useNavigate } from 'react-router'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Title } from '@/components/common/Title'
import { getTrialRemainingText, useLicenseStore } from '@/hooks/useLicense'
import { useNow } from '@/hooks/useNow'
import { isTrialActive, isTrialEnded } from 'shared/trial'
import InstructionsCard from './components/InstructionsCard'
import StatusCard from './components/StatusCard'

export default function BrowserControl() {
  const licenseStatus = useLicenseStore(s => s.status)
  const trialStartedAt = useLicenseStore(s => s.trialStartedAt)
  const trialMaxSeenAt = useLicenseStore(s => s.trialMaxSeenAt)
  const everActivated = useLicenseStore(s => s.everActivated)
  const navigate = useNavigate()
  const now = useNow()

  const trialState = { trialStartedAt, trialMaxSeenAt, everActivated }
  const trialActive = licenseStatus !== 'valid' && isTrialActive(trialState, now)
  const trialEnded = licenseStatus !== 'valid' && isTrialEnded(trialState, now)

  return (
    <div className="container py-8 space-y-4">
      <div>
        <Title title="直播控制台" description="连接并管理您的直播控制台" />
      </div>

      <div className="space-y-8">
        {trialActive && (
          <Alert>
            <AlertTitle>正在免费试用</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>
                剩余 {getTrialRemainingText(trialState, now)}
                ，试用期内自动弹窗、自动发言、自动回复、发红包都能用。
              </span>
              <Button size="sm" onClick={() => navigate('/settings')}>
                去设置输卡密
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {trialEnded && (
          <Alert>
            <AlertTitle>免费体验已结束</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>输入卡密即可继续使用自动弹窗、自动发言、自动回复、发红包。</span>
              <Button size="sm" onClick={() => navigate('/settings')}>
                去设置输卡密
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {licenseStatus === 'expired' && (
          <Alert>
            <AlertTitle>卡密已过期</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>请续费后在设置里重新输入新的卡密。</span>
              <Button size="sm" onClick={() => navigate('/settings')}>
                去设置输卡密
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {licenseStatus !== 'valid' &&
          licenseStatus !== 'expired' &&
          !trialActive &&
          !trialEnded && (
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
