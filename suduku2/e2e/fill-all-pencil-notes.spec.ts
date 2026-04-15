import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

test("一键笔记：填满候选后可撤销恢复", async ({ page, request }) => {
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

  const fillAllBtn = page.getByTestId("sudoku-fill-all-pencil-notes");
  await expect(fillAllBtn).toBeVisible();
  await expect(fillAllBtn).toHaveAttribute("aria-label", "一键为所有空格填入约束候选笔记");

  const firstEmpty = page
    .locator('button[data-testid^="sudoku-cell-"][data-s2-empty="true"]:not([disabled])')
    .first();
  await firstEmpty.click();
  const cellTestId = await firstEmpty.getAttribute("data-testid");
  expect(cellTestId).toMatch(/^sudoku-cell-(\d+)-(\d+)$/);
  const m = cellTestId!.match(/^sudoku-cell-(\d+)-(\d+)$/);
  const r = m![1];
  const c = m![2];
  const ri = Number.parseInt(r, 10);
  const ci = Number.parseInt(c, 10);

  const expectedCandidateCount = await page.evaluate(
    ({ row, col }: { row: number; col: number }) => {
      function validPlacement(b: number[][], rr: number, cc: number, n: number): boolean {
        for (let j = 0; j < 9; j++) {
          if (j !== cc && b[rr][j] === n) {
            return false;
          }
        }
        for (let i = 0; i < 9; i++) {
          if (i !== rr && b[i][cc] === n) {
            return false;
          }
        }
        const br = Math.floor(rr / 3) * 3;
        const bc = Math.floor(cc / 3) * 3;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const r2 = br + i;
            const c2 = bc + j;
            if (r2 === rr && c2 === cc) {
              continue;
            }
            if (b[r2][c2] === n) {
              return false;
            }
          }
        }
        return true;
      }

      const board: number[][] = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
      for (let rr = 0; rr < 9; rr++) {
        for (let cc = 0; cc < 9; cc++) {
          const btn = document.querySelector(`[data-testid="sudoku-cell-${rr}-${cc}"]`);
          if (!btn) {
            return 0;
          }
          if (btn.getAttribute("data-s2-empty") === "true") {
            board[rr][cc] = 0;
          } else {
            const t = (btn.textContent ?? "").replace(/\s/g, "");
            const mm = t.match(/[1-9]/);
            board[rr][cc] = mm ? Number.parseInt(mm[0]!, 10) : 0;
          }
        }
      }
      if (board[row][col] !== 0) {
        return 0;
      }
      let n = 0;
      for (let d = 1; d <= 9; d++) {
        if (validPlacement(board, row, col, d)) {
          n += 1;
        }
      }
      return n;
    },
    { row: ri, col: ci },
  );
  expect(expectedCandidateCount).toBeGreaterThan(0);

  const countNotesOnInCell = async (): Promise<number> => {
    let on = 0;
    for (let n = 1; n <= 9; n++) {
      const el = page.getByTestId(`sudoku-note-marker-${r}-${c}-${n}`);
      if ((await el.getAttribute("data-s2-note-on")) === "true") {
        on += 1;
      }
    }
    return on;
  };

  await expect(countNotesOnInCell()).resolves.toBe(0);

  await fillAllBtn.click();

  await expect(async () => {
    const on = await countNotesOnInCell();
    expect(on).toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });

  /* 一键笔记后：该空格笔记点数应与规则下合法候选数一致（data-s2-note-on 可断言） */
  await expect(countNotesOnInCell()).resolves.toBe(expectedCandidateCount);

  await page.getByTestId("sudoku-undo").click();
  await expect(countNotesOnInCell()).resolves.toBe(0);
});
