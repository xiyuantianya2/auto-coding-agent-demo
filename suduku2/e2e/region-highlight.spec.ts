/**
 * 任务 13：选中格时行/列/宫区域高亮（data-s2-in-region），减少动效下无过渡闪烁。
 */
import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const MODE = "practice-endless:unique-candidate";
const TID = "unique-candidate";

function regionCellCount(sr: number, sc: number): number {
  const keys = new Set<string>();
  for (let c = 0; c < 9; c++) {
    keys.add(`${sr},${c}`);
  }
  for (let r = 0; r < 9; r++) {
    keys.add(`${r},${sc}`);
  }
  const br = Math.floor(sr / 3) * 3;
  const bc = Math.floor(sc / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      keys.add(`${r},${c}`);
    }
  }
  return keys.size;
}

test("选格后行/列/宫区域高亮，切换选格时更新（减少动效）", async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });

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
  const firstEmpty = board
    .locator('button[data-testid^="sudoku-cell-"]:not([disabled])')
    .first();
  await firstEmpty.click();

  const id1 = await firstEmpty.getAttribute("data-testid");
  expect(id1).toMatch(/^sudoku-cell-(\d+)-(\d+)$/);
  const m1 = /^sudoku-cell-(\d+)-(\d+)$/.exec(id1!);
  const sr1 = Number(m1![1]);
  const sc1 = Number(m1![2]);
  const n1 = regionCellCount(sr1, sc1);
  const regionIds1 = await board
    .locator('[data-s2-in-region="true"]')
    .evaluateAll((els) =>
      [...els].map((el) => el.getAttribute("data-testid")).filter((x): x is string => x != null).sort(),
    );

  await expect(board.locator('[data-s2-in-region="true"]')).toHaveCount(n1);
  expect(regionIds1).toHaveLength(n1);

  const secondEmpty = board.locator('button[data-testid^="sudoku-cell-"]:not([disabled])').nth(5);
  await secondEmpty.click();

  const id2 = await secondEmpty.getAttribute("data-testid");
  expect(id2).toMatch(/^sudoku-cell-(\d+)-(\d+)$/);
  const m2 = /^sudoku-cell-(\d+)-(\d+)$/.exec(id2!);
  const sr2 = Number(m2![1]);
  const sc2 = Number(m2![2]);
  const n2 = regionCellCount(sr2, sc2);

  await expect(board.locator('[data-s2-in-region="true"]')).toHaveCount(n2);

  const regionIds2 = await board
    .locator('[data-s2-in-region="true"]')
    .evaluateAll((els) =>
      [...els].map((el) => el.getAttribute("data-testid")).filter((x): x is string => x != null).sort(),
    );
  expect(regionIds2).toHaveLength(n2);

  if (id1 !== id2) {
    expect(regionIds1).not.toEqual(regionIds2);
  }

  expect(errors, `console errors: ${errors.join("; ")}`).toEqual([]);
});
