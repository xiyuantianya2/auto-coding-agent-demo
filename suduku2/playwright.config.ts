import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  /* Vitest 单测使用 `*.test.ts`，与 Playwright `*.spec.ts` 分流，避免被 test runner 误跑 */
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  /* Windows 下并发登录/注册会争用 `data/sessions.json` 原子写入（EPERM），单 worker 更稳 */
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3003",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3003",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
