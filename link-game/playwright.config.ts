import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: false,
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      slowMo: 150,
    },
    screenshot: "on",
    video: "on",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    // First `next dev` compile can exceed 30s on cold CI / slow disks; keep E2E stable after board-gen work.
    timeout: 120_000,
  },
});
