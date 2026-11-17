import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

/**
 * 单元测试专用配置（不复用 vite.config.ts）。
 *
 * 原因：vite.config.ts 里挂了 vite-plugin-electron，
 * 其 renderer 插件会把 `node:crypto` 之类的 Node 内置模块重写成
 * 浏览器端 polyfill（内部用 `require`），主进程的测试文件一 import
 * 就报 `require is not defined`。测试只测纯逻辑，不需要 Electron 插件，
 * 所以这里只保留路径别名。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      '#': path.join(root, 'electron/main'),
      shared: path.join(root, 'shared'),
    },
  },
  test: {
    include: ['shared/**/*.test.ts', 'electron/**/*.test.ts'],
  },
})
