import { app, BrowserWindow, shell } from 'electron'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { accountManager } from '#/managers/AccountManager'
import { providerService } from '#/services/ProviderService'
import { typedIpcMainHandle } from '#/utils'
import { verifyLicenseKey } from '#/utils/license'
import { syncLicenseState } from '#/utils/licenseState'

function setupIpcHandlers() {
  typedIpcMainHandle(IPC_CHANNELS.chrome.toggleDevTools, event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools()
      } else {
        win.webContents.openDevTools()
      }
    }
  })

  typedIpcMainHandle(IPC_CHANNELS.app.openLogFolder, () => {
    shell.openPath(app.getPath('logs'))
  })

  typedIpcMainHandle(IPC_CHANNELS.app.openExternal, (_, url: string) => {
    shell.openExternal(url)
  })

  typedIpcMainHandle(IPC_CHANNELS.app.getProviders, () => {
    return providerService.providers
  })

  typedIpcMainHandle(IPC_CHANNELS.account.switch, (_, { account }) => {
    accountManager.setAccountName(account.id, account.name)
  })

  typedIpcMainHandle(IPC_CHANNELS.app.licenseVerify, (_, key: string) => {
    return verifyLicenseKey(key)
  })

  // 渲染进程同步授权状态，供主进程在任务启动时复核。
  // 同步本身不决定授权：主进程收到后按 syncLicenseState 的合并规则处理，
  // 真正的放行判断只在 isAuthorized() 里做。
  typedIpcMainHandle(IPC_CHANNELS.app.licenseSync, (_, patch: LicenseSyncPatch) => {
    syncLicenseState(patch)
  })
}

export function setupAppIpcHandlers() {
  setupIpcHandlers()
}
