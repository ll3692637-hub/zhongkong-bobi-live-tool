# 构建环境与实际依赖版本（v1.6.4）

本文记录 2026-11-17 在 Windows 台式机上实际打出 `中控啵比直播助手_1.6.4_windows_x64.exe`
的那次构建所用的环境与依赖解析版本。换一台机器复现时，以 `pnpm-lock.yaml` 为准；
本文件只作核对参考。

## 构建机

- 机器：Windows 台式机 `desktop-tdet6lt`（公司电脑），经 Tailscale 隧道 SSH 连接
- 构建目录：`C:\temp\zhongkong-bobi-live-tool-trial`
- 构建脚本：`C:\temp\build-trial.bat`（`pnpm install` → `pnpm run build`）
- 构建时间：2026-11-17 约 11:52（Asia/Shanghai）

## 工具链（便携安装，不动系统）

| 工具 | 版本 | 位置 |
| --- | --- | --- |
| Node.js | v26.13.1 | `C:\tools\node-v26.13.1-win-x64` |
| npm | 11.20.0 | 随 Node |
| pnpm | 10.34.9 | `npm install -g pnpm@10` |
| MinGit | 2.56.1 | `C:\tools\git`（SSH 会话里用 `C:\tools\git\cmd\git.exe` 全路径） |

## electron-builder 外部工具缓存

`%LOCALAPPDATA%\electron-builder\Cache\` 下已就绪（首次构建时从网络下载，
后续重打包不再受下载影响）：

- winCodeSign-2.6.0
- nsis-3.0.4.1
- nsis-resources-3.4.1

## 关键依赖实际解析版本（以 pnpm-lock.yaml 为准）

| 依赖 | package.json 声明 | 实际解析版本 |
| --- | --- | --- |
| electron | ^36.3.2 | 36.9.5 |
| electron-builder | 26.0.12 | 26.0.12 |
| vite | ^6.0.11 | 6.4.6 |
| vitest | ^3.2.7 | 3.2.7 |
| playwright | （见锁文件） | 1.65.1 |
| react | 19.2.3 | 19.2.3 |
| zustand | ^5.0.3 | 5.1.0 |

## 锁文件

- `pnpm-lock.yaml`（lockfileVersion 9.0），与本次构建所用的文件逐字节一致。
- SHA-256：`8d9ad28daf6c5ecf2ef5cbaacfb3aa0bb04c8372c925dc6dd6057f1618288104`

## 本次构建产物

- 文件：`release\1.6.4\中控啵比直播助手_1.6.4_windows_x64.exe`
- 大小：82,570,680 字节
- SHA-256：`67332294a1610cc4fd826eb9d41740f851bea517ab0344301137f9cd0a06b97d`

## 注意事项

- 构建机的 Chrome / Edge：该机装有 Edge，未装系统级 Chrome；Chrome 137 装在用户目录
  `%USERPROFILE%\AppData\Local\Google\Chrome\Application`。软件运行时需要系统 Chrome
  或 Edge（二者其一），见 `docs/first-use.md`。
- Playwright 自带 Chromium 未下载（`pnpm.onlyBuiltDependencies: ["electron"]` 使其
  postinstall 不执行），不要指望它作回落。
- `pnpm test` 的 pretest 会跑 `vite build --mode=test`（test 模式构建会覆盖
  `dist-electron`）；跑完测试后如需出正式包，务必再跑一次 `pnpm run build`。
