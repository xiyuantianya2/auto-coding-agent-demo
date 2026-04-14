import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

test("无尽（入门）：盘面提示数与题库一致，保存草稿后进度含草稿", async ({
  page,
  request,
}) => {
  const username = uniqueUsername();
  const password = "secret12";

  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://127.0.0.1:3003/");

  await page.goto("/game/endless/entry");
  await expect(page.getByTestId("endless-play-root")).toBeVisible();
  await expect(page.getByTestId("endless-board")).toBeVisible({ timeout: 60_000 });

  const metaText = await page.getByTestId("endless-meta").innerText();
  const m = metaText.match(/提示数：(\d+)/);
  expect(m).not.toBeNull();
  const givens = Number(m![1]);
  expect(givens).toBeGreaterThan(10);

  const filledCells = await page
    .locator('[data-testid^="sudoku-cell-"]')
    .filter({ hasText: /^[1-9]$/ })
    .count();
  expect(filledCells).toBe(givens);

  await page.getByTestId("endless-save-draft").click();
  await expect(page.getByTestId("endless-status")).toContainText("草稿已保存", {
    timeout: 15_000,
  });

  const token = await page.evaluate(() => globalThis.localStorage.getItem("suduku2.auth.token"));
  expect(token).toBeTruthy();

  const res = await request.get("http://127.0.0.1:3003/api/progress", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as {
    endless?: { entry?: { clearedLevel?: number } };
    draft?: { grid?: number[][] };
  };
  expect(body.endless?.entry?.clearedLevel ?? 0).toBeGreaterThanOrEqual(0);
  expect(body.draft?.grid?.length).toBe(9);
});
