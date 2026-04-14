import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

test("无尽（入门）：盘面提示数与题库一致，保存草稿后进度含草稿", async ({
  page,
  request,
}) => {
  const { token } = await apiRegisterAndLogin(request);
  await injectAuth(page, token);

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
