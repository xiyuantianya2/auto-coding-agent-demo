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

  /* 避免「快速游戏」在遍历空格时自动填数，导致 nth 索引与坐标错位 */
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("suduku2.ui.quickGame");
    } catch {
      /* ignore */
    }
  });

  await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
  await expect(page.getByTestId("practice-play-root")).toBeVisible({ timeout: 60_000 });

  const board = page.getByRole("grid", { name: "数独棋盘" });
  await expect(board).toBeVisible({ timeout: 60_000 });
  await expect(board).toHaveAttribute("data-testid", "practice-board");
  await expect(page.locator('[data-testid="practice-board"] [data-testid^="sudoku-cell-"]')).toHaveCount(
    81,
  );

  const quickGame = page.getByTestId("sudoku-quick-game");
  await expect(quickGame).not.toBeChecked();

  await page.getByTestId("sudoku-mode-fill").click();
  /* 若默认已选中某一空格，首击该格会触发「二次点击切笔记」（任务 16）；先点给定格重置选中 */
  const givenCell = page.locator('[data-testid="practice-board"] button[data-s2-given="true"]').first();
  await expect(givenCell).toBeVisible();
  await givenCell.click();

  /*
   * 多候选时九键可能均启用，但仅部分数字对该格合法；`digit-pad-7.isEnabled()` 不能推出 7 可填入。
   * 对选中空格依次尝试已启用的键，直到非法填数被拒绝后仍为空、或合法填数成功。
   */
  let cellTestId: string | null = null;
  let placedDigit: number | null = null;
  outer: for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cellBtn = page.getByTestId(`sudoku-cell-${r}-${c}`);
      if ((await cellBtn.getAttribute("data-s2-empty")) !== "true") continue;
      if (await cellBtn.isDisabled()) continue;
      await cellBtn.click();
      await expect(page.getByTestId("sudoku-mode-fill")).toHaveAttribute("aria-pressed", "true");

      for (let d = 1; d <= 9; d++) {
        const padKey = page.getByTestId(`digit-pad-${d}`);
        if (!(await padKey.isEnabled())) continue;
        await padKey.click();
        if ((await cellBtn.getAttribute("data-s2-empty")) !== "true") {
          cellTestId = `sudoku-cell-${r}-${c}`;
          placedDigit = d;
          break outer;
        }
      }
    }
  }
  expect(cellTestId, "应在某一空格上成功填入一个合法数字").not.toBeNull();
  expect(placedDigit).not.toBeNull();

  const targetCell = page.getByTestId(cellTestId!);
  await expect(targetCell).toContainText(String(placedDigit));
  const placedPad = page.getByTestId(`digit-pad-${placedDigit}`);
  await expect(placedPad).toBeEnabled();

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "true");
  await expect(placedPad).toBeDisabled();

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "false");
  await expect(placedPad).toBeEnabled();
});
