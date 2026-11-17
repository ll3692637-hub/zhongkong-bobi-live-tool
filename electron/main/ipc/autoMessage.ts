import { Result } from '@praha/byethrow'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '#/logger'
import { accountManager } from '#/managers/AccountManager'
import { typedIpcMainHandle } from '#/utils'
import { isAuthorized } from '#/utils/licenseState'

const TASK_NAME = '自动发言'
const TASK_TYPE = 'auto-comment'

// IPC 处理程序
function setupIpcHandlers() {
  typedIpcMainHandle(IPC_CHANNELS.tasks.autoMessage.start, async (_, accountId, config) => {
    // 主进程授权复核：只改前端显示状态启动不了任务
    if (!isAuthorized()) {
      createLogger(`@${accountManager.getAccountName(accountId)}`)
        .scope(TASK_NAME)
        .error('主进程授权复核未通过，拒绝启动任务')
      return false
    }
    return Result.pipe(
      accountManager.getSession(accountId),
      Result.andThen(accountSession => accountSession.startTask({ type: TASK_TYPE, config })),
      Result.inspectError(error => {
        const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
        logger.error('启动任务失败：', error)
      }),
      r => r.then(Result.isSuccess),
    )
  })

  typedIpcMainHandle(IPC_CHANNELS.tasks.autoMessage.stop, async (_, accountId) => {
    return Result.pipe(
      accountManager.getSession(accountId),
      Result.inspect(accountSession => accountSession.stopTask(TASK_TYPE)),
      Result.inspectError(error => {
        const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
        logger.error('停止任务失败：', error)
      }),
      r => Result.isSuccess(r),
    )
  })

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.autoMessage.sendBatchMessages,
    async (_, accountId, messages, count) => {
      // 主进程授权复核：只改前端显示状态启动不了任务
      if (!isAuthorized()) {
        createLogger(`@${accountManager.getAccountName(accountId)}`)
          .scope('一键评论')
          .error('主进程授权复核未通过，拒绝启动任务')
        return false
      }
      return Result.pipe(
        accountManager.getSession(accountId),
        Result.andThen(accountSession =>
          accountSession.startTask({ type: 'send-batch-messages', config: { messages, count } }),
        ),
        Result.inspectError(error => {
          const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(
            '一键评论',
          )
          logger.error('启动任务失败：', error)
        }),
        r => r.then(Result.isSuccess),
      )
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.autoMessage.updateConfig,
    async (_, accountId, newConfig) => {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      Result.pipe(
        accountManager.getSession(accountId),
        Result.andThen(accountSession => accountSession.updateTaskConfig(TASK_TYPE, newConfig)),
        Result.inspect(_ => logger.info('更新配置成功')),
        Result.inspectError(error => logger.error('更新配置失败：', error)),
      )
    },
  )
}

export function setupAutoMessageIpcHandlers() {
  setupIpcHandlers()
}
