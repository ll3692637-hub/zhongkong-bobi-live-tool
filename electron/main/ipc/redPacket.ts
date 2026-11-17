import { Result } from '@praha/byethrow'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '#/logger'
import { accountManager } from '#/managers/AccountManager'
import { typedIpcMainHandle } from '#/utils'
import { isAuthorized } from '#/utils/licenseState'

const TASK_NAME = '一键发红包'

function setupIpcHandlers() {
  typedIpcMainHandle(IPC_CHANNELS.tasks.redPacket.send, async (_, accountId, duration) => {
    const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
    // 主进程授权复核：只改前端显示状态发不了红包
    if (!isAuthorized()) {
      logger.error('主进程授权复核未通过，拒绝发红包')
      return false
    }
    logger.info(`限时领取时长：${duration}`)

    return await Result.pipe(
      accountManager.getSession(accountId),
      Result.andThen(session => session.sendRedPacket(duration)),
      Result.inspect(() => logger.success('一键发红包执行成功')),
      Result.inspectError(error => logger.error('一键发红包执行失败：', error)),
      r => r.then(Result.isSuccess),
    )
  })
}

export function setupRedPacketIpcHandlers() {
  setupIpcHandlers()
}
