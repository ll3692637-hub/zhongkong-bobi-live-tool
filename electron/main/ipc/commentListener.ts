import { Result } from '@praha/byethrow'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '#/logger'
import { accountManager } from '#/managers/AccountManager'
import { typedIpcMainHandle } from '#/utils'
import { isAuthorized } from '#/utils/licenseState'

const TASK_NAME = '监听评论'
const TASK_TYPE = 'comment-listener'

function setupIpcHandlers() {
  typedIpcMainHandle(
    IPC_CHANNELS.tasks.autoReply.startCommentListener,
    async (_, accountId: string, config: CommentListenerConfig) => {
      // 主进程授权复核：只改前端显示状态启动不了任务
      if (!isAuthorized()) {
        createLogger(`@${accountManager.getAccountName(accountId)}`)
          .scope(TASK_NAME)
          .error('主进程授权复核未通过，拒绝启动评论监听')
        return false
      }
      return Result.pipe(
        accountManager.getSession(accountId),
        Result.andThen(accountSession =>
          accountSession.startTask({ type: TASK_TYPE, config: config }),
        ),
        Result.inspectError(error => {
          const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(
            TASK_NAME,
          )
          logger.error('启动评论监听失败：', error)
        }),
        r => r.then(Result.isSuccess),
      )
    },
  )

  typedIpcMainHandle(
    IPC_CHANNELS.tasks.autoReply.stopCommentListener,
    async (_, accountId: string) => {
      Result.pipe(
        accountManager.getSession(accountId),
        Result.inspect(accountSession => accountSession.stopTask(TASK_TYPE)),
        Result.inspectError(error => {
          const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(
            TASK_NAME,
          )
          logger.error('停止监听评论失败：', error)
        }),
      )
    },
  )

  typedIpcMainHandle(IPC_CHANNELS.tasks.autoReply.sendReply, async (_, accountId, message) => {
    // 主进程授权复核：只改前端显示状态发不出回复
    if (!isAuthorized()) {
      createLogger(`@${accountManager.getAccountName(accountId)}`)
        .scope(TASK_NAME)
        .error('主进程授权复核未通过，拒绝发送回复')
      return
    }
    await Result.pipe(
      accountManager.getSession(accountId),
      Result.andThen(accountSession =>
        accountSession.startTask({
          type: 'send-batch-messages',
          config: {
            messages: [message],
            count: 1,
            noSpace: true,
          },
        }),
      ),
      Result.inspectError(error => {
        const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
        logger.error('发送回复失败：', error)
      }),
    )
  })
}

export function setupAutoReplyIpcHandlers() {
  setupIpcHandlers()
}
