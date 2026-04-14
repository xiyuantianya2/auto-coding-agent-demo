import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  /* 本地多 worker 并发易压垮单实例 `next dev`，导致偶发 net::ERR_CONNECTION_REFUSED */
  workers: process.env.CI ? 1 : 4,
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
