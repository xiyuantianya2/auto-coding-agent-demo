import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

test("主棋盘：笔记切换、提示高亮、暂停冻结计时、撤销一步", async ({ page, request }) => {
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

  await page.getByTestId("sudoku-mode-notes").click();
  await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "true");

  const emptyPlayerCell = page
    .locator('button[data-testid^="sudoku-cell-"][data-s2-empty="true"]:not([disabled])')
    .first();
  await emptyPlayerCell.click();

  await page.getByTestId("digit-pad-3").click();
  const firstCellTestId = await emptyPlayerCell.getAttribute("data-testid");
  expect(firstCellTestId).toMatch(/^sudoku-cell-\d+-\d+$/);
  const m = firstCellTestId!.match(/^sudoku-cell-(\d+)-(\d+)$/);
  expect(m).not.toBeNull();
  const mr = m![1];
  const mc = m![2];
  const note3 = page.getByTestId(`sudoku-note-marker-${mr}-${mc}-3`);
  await expect(note3).toBeVisible();
  await expect(note3).not.toHaveClass(/opacity-40/);

  await page.getByTestId("sudoku-undo").click();
  await expect(note3).toHaveClass(/opacity-40/);

  const timer = page.getByTestId("sudoku-timer");
  const parseSec = async (): Promise<number> => {
    const t = await timer.innerText();
    const mm = t.match(/(\d+)/);
    return mm ? Number(mm[1]) : 0;
  };
  const t0 = await parseSec();
  await expect(async () => {
    const t1 = await parseSec();
    expect(t1).toBeGreaterThanOrEqual(t0);
    if (t0 === 0) {
      expect(t1).toBeGreaterThanOrEqual(1);
    }
  }).toPass({ timeout: 15_000 });

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "true");
  const frozen = await parseSec();
  await page.waitForTimeout(800);
  const still = await parseSec();
  expect(still).toBe(frozen);

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "false");
  await expect(async () => {
    const v = await parseSec();
    expect(v).toBeGreaterThanOrEqual(still);
  }).toPass({ timeout: 15_000 });

  await page.getByTestId("sudoku-hint").click();
  await expect(page.getByTestId("sudoku-hint-banner")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-hint-cell=\"true\"]").first()).toBeVisible();
});
