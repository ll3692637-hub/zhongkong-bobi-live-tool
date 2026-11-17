import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '#/logger'
import { typedIpcMainHandle } from '#/utils'
import { isAuthorized } from '#/utils/licenseState'
import { getCatbusCliPath } from '#/danmu/catbus'
import { danmuService } from '#/danmu/DanmuService'

const TASK_NAME = '批量弹幕'

function setupIpcHandlers() {
  const logger = createLogger(TASK_NAME)

  // 启动时记一行 CLI 解析结果：打包后能从 main.log 核对 CLI 是否打进包里
  const cliPath = getCatbusCliPath()
  if (cliPath) logger.info(`catbus CLI：${cliPath}`)
  else logger.error('catbus CLI 未找到，批量弹幕功能不可用')

  // 第 7 个受限入口：主进程授权复核，只改前端显示状态启动不了任务
  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.start, async (_, config) => {
    if (!isAuthorized()) {
      logger.error('主进程授权复核未通过，拒绝启动任务')
      return false
    }
    return danmuService.startSend(config)
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.stop, () => {
    danmuService.stop()
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.pause, () => {
    danmuService.pause()
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.resume, () => {
    danmuService.resume()
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.getStatus, () => {
    return danmuService.getSnapshot()
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.refreshLogins, () => {
    void danmuService.refreshLogins()
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.login, (_, account) => {
    return danmuService.startLogin(account)
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.logout, (_, account) => {
    danmuService.logout(account)
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.submitSmsCode, (_, account, code) => {
    danmuService.submitSmsCode(account, code)
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.danmu.getQrImage, (_, account) => {
    return danmuService.getQrImage(account)
  })
}

export function setupDanmuIpcHandlers() {
  setupIpcHandlers()
}
