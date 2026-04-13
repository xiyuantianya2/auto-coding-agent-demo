import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: "http://localhost:3001",
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
    url: "http://localhost:3001",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
