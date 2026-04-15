import path from "node:path";

import { defineConfig } from "@playwright/test";

/** Playwright 专用数据目录，避免与开发时 `data/` 或外部进程争用导致 Windows 下 rename EPERM */
const PLAYWRIGHT_DATA_DIR = path.join(process.cwd(), "e2e", ".playwright-data");

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  /* Vitest 单测使用 `*.test.ts`，与 Playwright `*.spec.ts` 分流，避免被 test runner 误跑 */
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  /* CI 仅 1 次 retry：workers=1 时 2 次 retry 会让单个 flaky 用例耗时 3x */
  retries: isCI ? 1 : 0,
  /* Windows 下并发登录/注册会争用 `data/sessions.json` 原子写入（EPERM），单 worker 更稳 */
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3003",
    trace: "on-first-retry",
    launchOptions: {
      args: ["--disable-gpu"],
    },
  },
  webServer: {
    /**
     * CI 使用生产构建 (next build + next start)：
     * - 页面预编译，加载速度远快于 dev 模式的按需编译
     * - 无文件监听 / HMR 开销，进程启停更快（尤其 Windows）
     *
     * `reuseExistingServer` 在 CI 与本地均开启：若 `url` 已可访问（例如本机已跑
     * `next dev -p 3003`），则不再启动第二进程，避免「端口已被占用」导致失败。
     * 干净环境（含典型 CI）下仍会执行 `command` 启动新服务。
     */
    command: isCI ? "npm run start:e2e" : "npm run dev",
    url: "http://127.0.0.1:3003",
    reuseExistingServer: true,
    timeout: isCI ? 180_000 : 120_000,
    env: {
      ...process.env,
      SUDUKU2_DATA_DIR: PLAYWRIGHT_DATA_DIR,
    },
  },
});
