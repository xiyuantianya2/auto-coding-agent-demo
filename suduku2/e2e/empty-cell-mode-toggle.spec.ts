/**
 * 任务 16：空白格保持焦点时再次点击，在填数 / 笔记模式间切换；
 * `data-s2-input-mode` 与侧栏「当前：填数/笔记」为验收定位。
 * 与长按无冲突（棋盘格未实现长按手势）。
 */
import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

test("空白格二次点击切换填数/笔记且保留笔记数据", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  const { token } = await apiRegisterAndLogin(request);
  await injectAuth(page, token);

  await request.patch("http://127.0.0.1:3003/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      techniques: {
        [TID]: { unlocked: true },
      },
    },
  });

  await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
  await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

  const emptyCell = page
    .locator('button[data-testid^="sudoku-cell-"][data-s2-empty="true"]:not([disabled])')
    .first();

  await emptyCell.click();
  const modeHint = page.getByTestId("sudoku-mode-hint");
  await expect(modeHint).toHaveAttribute("data-s2-input-mode", "fill");
  await expect(modeHint).toContainText("当前：填数");

  await emptyCell.click();
  await expect(modeHint).toHaveAttribute("data-s2-input-mode", "notes");
  await expect(modeHint).toContainText("当前：笔记");
  await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "true");

  const cellId = await emptyCell.getAttribute("data-testid");
  expect(cellId).toMatch(/^sudoku-cell-\d+-\d+$/);
  const m = cellId!.match(/^sudoku-cell-(\d+)-(\d+)$/);
  expect(m).not.toBeNull();
  const r = m![1];
  const c = m![2];

  await page.getByTestId("digit-pad-2").click();
  await page.getByTestId("digit-pad-5").click();
  await page.getByTestId("digit-pad-8").click();

  const note2 = page.getByTestId(`sudoku-note-marker-${r}-${c}-2`);
  const note5 = page.getByTestId(`sudoku-note-marker-${r}-${c}-5`);
  await expect(note2).not.toHaveClass(/opacity-40/);
  await expect(note5).not.toHaveClass(/opacity-40/);

  await emptyCell.click();
  await expect(modeHint).toHaveAttribute("data-s2-input-mode", "fill");
  await expect(note2).not.toHaveClass(/opacity-40/);
  await expect(note5).not.toHaveClass(/opacity-40/);
});
