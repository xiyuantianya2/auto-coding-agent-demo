/**
 * 任务 18：对局面板无障碍与测试定位（模式 status、testid、减少动效下可交互）。
 */
import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

test("模式与棋盘：role/status、aria-pressed、格钮 aria-label 含选中语义（减少动效）", async ({
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

  await expect(page.getByTestId("sudoku-input-mode-group")).toBeVisible();
  await expect(page.getByTestId("sudoku-mode-fill")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "false");

  const modeStatus = page.getByTestId("sudoku-mode-hint");
  await expect(modeStatus).toHaveAttribute("role", "status");
  await expect(modeStatus).toContainText("填数");

  await page.getByTestId("sudoku-mode-notes").click();
  await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("sudoku-mode-fill")).toHaveAttribute("aria-pressed", "false");
  await expect(modeStatus).toContainText("笔记");

  const firstEmpty = page.locator('[data-testid="practice-board"] [data-s2-empty="true"]').first();
  await firstEmpty.click();
  const id = await firstEmpty.getAttribute("data-testid");
  expect(id).toMatch(/^sudoku-cell-\d+-\d+$/);
  await expect(page.getByTestId(id!)).toHaveAttribute("data-s2-selected", "true");

  const label = await page.getByTestId(id!).getAttribute("aria-label");
  expect(label ?? "").toContain("已选中");

  await expect(page.getByTestId("sudoku-single-candidate-help")).toHaveCount(0);
});
