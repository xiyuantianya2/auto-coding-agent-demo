/**
 * 任务 14：选中已填格时同数字全局高亮（data-s2-same-digit），与选中环可区分。
 */
import { test, expect, type Page } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const MODE = "practice-endless:unique-candidate";
const TID = "unique-candidate";

/** 已填格（非 data-s2-empty）中单字符 1–9 的 testid 列表，按数字分组 */
async function filledCellsByDigit(
  page: Page,
): Promise<{ digit: string; testIds: string[] }[]> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="practice-board"]');
    if (!root) {
      return [];
    }
    const map = new Map<string, string[]>();
    for (const el of root.querySelectorAll('button[data-testid^="sudoku-cell-"]')) {
      if (el.getAttribute("data-s2-empty") === "true") {
        continue;
      }
      const tid = el.getAttribute("data-testid");
      if (!tid) {
        continue;
      }
      const t = (el.textContent ?? "").replace(/\s/g, "");
      if (!/^[1-9]$/.test(t)) {
        continue;
      }
      const arr = map.get(t) ?? [];
      arr.push(tid);
      map.set(t, arr);
    }
    return [...map.entries()]
      .filter(([, ids]) => ids.length >= 2)
      .map(([digit, testIds]) => ({ digit, testIds }));
  });
}

test("已填格：同数字全局高亮；切换数字更新；空格无残留", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  const { token } = await apiRegisterAndLogin(request);
  await injectAuth(page, token);

  await request.patch("http://127.0.0.1:3003/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      techniques: { [TID]: { unlocked: true } },
    },
  });

  await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
  await expect(page.getByTestId("practice-play-root")).toBeVisible({ timeout: 60_000 });

  const board = page.getByTestId("practice-board");
  await expect(board).toBeVisible({ timeout: 60_000 });
  await expect(board.locator('button[data-testid^="sudoku-cell-"]')).toHaveCount(81, { timeout: 60_000 });
  await expect(board.locator('[data-s2-given="true"]').first()).toBeVisible({ timeout: 60_000 });

  const multi = await filledCellsByDigit(page);
  expect(
    multi.length,
    "盘面应至少有两种已填数字各出现不少于两次（用于同数字高亮与切换）",
  ).toBeGreaterThanOrEqual(2);

  const first = multi[0]!;
  const second = multi.find((m) => m.digit !== first.digit) ?? multi[1]!;
  expect(second).toBeDefined();

  await page.getByTestId(first.testIds[0]!).click();
  await expect(board.locator('[data-s2-same-digit="true"]')).toHaveCount(first.testIds.length);

  await page.getByTestId(second!.testIds[0]!).click();
  await expect(board.locator('[data-s2-same-digit="true"]')).toHaveCount(second!.testIds.length);

  const firstEmpty = board
    .locator('button[data-testid^="sudoku-cell-"][data-s2-empty="true"]:not([disabled])')
    .first();
  await firstEmpty.click();
  await expect(board.locator('[data-s2-same-digit="true"]')).toHaveCount(0);
});
