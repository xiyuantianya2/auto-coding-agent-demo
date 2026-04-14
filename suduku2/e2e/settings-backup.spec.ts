import path from "node:path";

import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

test("主题切换：html 上出现 dark class", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-settings-section")).toBeVisible();
  await page.getByTestId("settings-theme-select").selectOption("light");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByTestId("settings-theme-select").selectOption("dark");
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("候选数高对比：html 上出现 hc-candidates class", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("settings-hc-candidates").setChecked(true);
  await expect(page.locator("html")).toHaveClass(/hc-candidates/);
  await page.getByTestId("settings-hc-candidates").setChecked(false);
  await expect(page.locator("html")).not.toHaveClass(/hc-candidates/);
});

test("已登录：导出 JSON 与从文件导入各一轮冒烟", async ({ page }) => {
  const username = uniqueUsername();
  const password = "secret12";

  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://127.0.0.1:3003/");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("progress-export-button").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/i);
  const tmpPath = path.join("test-results", `e2e-export-${Date.now()}.json`);
  await download.saveAs(tmpPath);

  page.once("dialog", (d) => d.accept());
  await page.getByTestId("progress-import-file").setInputFiles(
    path.join(process.cwd(), "e2e/fixtures/valid-progress-backup.json"),
  );
  await expect(page.getByTestId("progress-backup-message")).toContainText("导入成功", {
    timeout: 15_000,
  });
});

test("导入无效 JSON 时显示中文错误", async ({ page }) => {
  const username = uniqueUsername();
  const password = "secret12";

  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://127.0.0.1:3003/");

  const badPath = path.join(process.cwd(), "e2e/fixtures/invalid-progress.json");

  page.once("dialog", (d) => d.accept());
  await page.getByTestId("progress-import-file").setInputFiles(badPath);
  await expect(page.getByTestId("progress-backup-message")).toContainText("JSON 格式无效", {
    timeout: 10_000,
  });
});
