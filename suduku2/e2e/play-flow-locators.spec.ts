/**
 * 可访问性与测试定位契约（task 11）：改版后仍须稳定的主对局流。
 * 使用 `role="grid"`、`aria-label` 与 `data-testid` 定位（不依赖易变类名），
 * 断言采用 Playwright 默认 expect 超时，无无上限 DOM 轮询。
 */
import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

test("主对局流：进入专项 → grid 地标 → 选格 → 填数 → 暂停/继续（testid / aria）", async ({
  page,
  request,
}) => {
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

  const board = page.getByRole("grid", { name: "数独棋盘" });
  await expect(board).toBeVisible({ timeout: 60_000 });
  await expect(board).toHaveAttribute("data-testid", "practice-board");
  await expect(page.locator('[data-testid="practice-board"] [data-testid^="sudoku-cell-"]')).toHaveCount(
    81,
  );

  const empties = page.locator(
    '[data-testid="practice-board"] button[data-testid^="sudoku-cell-"][data-s2-empty="true"]:not([disabled])',
  );
  const nEmpty = await empties.count();
  let cellTestId: string | null = null;
  for (let i = 0; i < nEmpty; i++) {
    await empties.nth(i).click();
    if (await page.getByTestId("digit-pad-7").isEnabled()) {
      cellTestId = await empties.nth(i).getAttribute("data-testid");
      break;
    }
  }
  expect(cellTestId, "应存在一空格使数字 7 在填数模式下可点（非单候选误锁）").not.toBeNull();
  expect(cellTestId).toMatch(/^sudoku-cell-\d+-\d+$/);

  await page.getByTestId("digit-pad-7").click();
  await expect(page.getByTestId(cellTestId!)).toContainText("7");
  await expect(page.getByTestId("digit-pad-7")).toBeEnabled();

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("digit-pad-7")).toBeDisabled();

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("digit-pad-7")).toBeEnabled();
});
