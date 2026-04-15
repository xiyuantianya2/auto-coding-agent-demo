/**
 * 任务 26：填数模式下「从未打过笔记」的空格不渲染 1–9 淡色占位；
 * 笔记模式下显示可编辑 3×3 网格；有笔记的空格在填数模式下仍展示已记笔记。
 */
import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

test("空白格：填数模式无笔记不挂载占位 marker；笔记模式可编辑；有笔记后填数模式仍可见", async ({
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
      techniques: {
        [TID]: { unlocked: true },
      },
    },
  });

  await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
  await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

  await page.getByTestId("sudoku-mode-fill").click();
  await expect(page.getByTestId("sudoku-mode-fill")).toHaveAttribute("aria-pressed", "true");

  const emptyCell = page
    .locator('button[data-testid^="sudoku-cell-"][data-s2-empty="true"]:not([disabled])')
    .first();
  await emptyCell.click();

  const cellId = await emptyCell.getAttribute("data-testid");
  expect(cellId).toMatch(/^sudoku-cell-(\d+)-(\d+)$/);
  const m = cellId!.match(/^sudoku-cell-(\d+)-(\d+)$/);
  const r = m![1];
  const c = m![2];

  await expect(
    page.locator(`[data-testid^="sudoku-note-marker-${r}-${c}-"]`),
  ).toHaveCount(0);

  await page.getByTestId("sudoku-mode-notes").click();
  await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "true");

  await expect(
    page.locator(`[data-testid^="sudoku-note-marker-${r}-${c}-"]`),
  ).toHaveCount(9);

  await page.getByTestId("digit-pad-4").click();
  const note4 = page.getByTestId(`sudoku-note-marker-${r}-${c}-4`);
  await expect(note4).toBeVisible();
  await expect(note4).toHaveAttribute("data-s2-note-on", "true");

  await page.getByTestId("sudoku-mode-fill").click();
  await expect(page.getByTestId("sudoku-mode-fill")).toHaveAttribute("aria-pressed", "true");

  await expect(note4).toBeVisible();
  await expect(note4).toHaveAttribute("data-s2-note-on", "true");
  await expect(
    page.locator(`[data-testid^="sudoku-note-marker-${r}-${c}-"]`),
  ).toHaveCount(1);
});
