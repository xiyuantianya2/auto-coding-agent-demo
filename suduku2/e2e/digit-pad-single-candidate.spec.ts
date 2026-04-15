/**
 * 任务 17：空白格在填数模式下若仅有一个行/列/宫合法填数，数字键盘仅该键可点；多候选或笔记模式不锁定。
 */
import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

function validPlacement(board: number[][], r: number, c: number, n: number): boolean {
  for (let cc = 0; cc < 9; cc++) {
    if (cc !== c && board[r][cc] === n) {
      return false;
    }
  }
  for (let rr = 0; rr < 9; rr++) {
    if (rr !== r && board[rr][c] === n) {
      return false;
    }
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const rr = br + i;
      const cc = bc + j;
      if (rr === r && cc === c) {
        continue;
      }
      if (board[rr][cc] === n) {
        return false;
      }
    }
  }
  return true;
}

function scanBoard(board: number[][]): { r: number; c: number; digits: number[] }[] {
  const out: { r: number; c: number; digits: number[] }[] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) {
        continue;
      }
      const digits: number[] = [];
      for (let n = 1; n <= 9; n++) {
        if (validPlacement(board, r, c, n)) {
          digits.push(n);
        }
      }
      out.push({ r, c, digits });
    }
  }
  return out;
}

test("单候选格：仅对应数字键可点；多候选格：九键可用；笔记模式不锁定", async ({ page, request }) => {
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
  await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

  const scanned = await page.evaluate(() => {
    const board: number[][] = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const btn = document.querySelector(`[data-testid="sudoku-cell-${r}-${c}"]`);
        if (!btn) {
          return { single: null, multi: null };
        }
        if (btn.getAttribute("data-s2-empty") === "true") {
          board[r][c] = 0;
        } else {
          const t = (btn.textContent ?? "").replace(/\s/g, "");
          const m = t.match(/[1-9]/);
          board[r][c] = m ? Number.parseInt(m[0]!, 10) : 0;
        }
      }
    }

    function validPlacement(b: number[][], r: number, c: number, n: number): boolean {
      for (let cc = 0; cc < 9; cc++) {
        if (cc !== c && b[r][cc] === n) {
          return false;
        }
      }
      for (let rr = 0; rr < 9; rr++) {
        if (rr !== r && b[rr][c] === n) {
          return false;
        }
      }
      const br = Math.floor(r / 3) * 3;
      const bc = Math.floor(c / 3) * 3;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const rr = br + i;
          const cc = bc + j;
          if (rr === r && cc === c) {
            continue;
          }
          if (b[rr][cc] === n) {
            return false;
          }
        }
      }
      return true;
    }

    let single: { r: number; c: number; d: number } | null = null;
    let multi: { r: number; c: number } | null = null;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) {
          continue;
        }
        const ds: number[] = [];
        for (let n = 1; n <= 9; n++) {
          if (validPlacement(board, r, c, n)) {
            ds.push(n);
          }
        }
        if (ds.length === 1 && !single) {
          single = { r, c, d: ds[0]! };
        }
        if (ds.length >= 2 && !multi) {
          multi = { r, c };
        }
      }
    }
    return { single, multi };
  });

  expect(scanned.single, "盘面应至少有一格在规则下仅一个合法填数").not.toBeNull();
  expect(scanned.multi, "盘面应至少有一格有多个合法填数").not.toBeNull();

  await page.getByTestId("sudoku-mode-fill").click();

  const s = scanned.single!;
  await page.getByTestId(`sudoku-cell-${s.r}-${s.c}`).click();
  await expect(page.getByTestId("sudoku-digit-pad")).toHaveAttribute("data-s2-single-candidate-lock", "true");
  await expect(page.getByTestId("sudoku-single-candidate-help")).toBeAttached();
  await expect(page.getByTestId("sudoku-digit-pad")).toHaveAttribute(
    "aria-describedby",
    "sudoku-digit-pad-lock-help",
  );
  await expect(page.getByTestId(`digit-pad-${s.d === 1 ? 2 : 1}`)).toHaveAttribute(
    "data-s2-disabled-by-single-candidate",
    "true",
  );

  for (let n = 1; n <= 9; n++) {
    const btn = page.getByTestId(`digit-pad-${n}`);
    if (n === s.d) {
      await expect(btn).toBeEnabled();
    } else {
      await expect(btn).toBeDisabled();
    }
  }

  const m = scanned.multi!;
  await page.getByTestId(`sudoku-cell-${m.r}-${m.c}`).click();
  await expect(page.getByTestId("sudoku-digit-pad")).not.toHaveAttribute("data-s2-single-candidate-lock");
  for (let n = 1; n <= 9; n++) {
    await expect(page.getByTestId(`digit-pad-${n}`)).toBeEnabled();
  }

  await page.getByTestId(`sudoku-cell-${s.r}-${s.c}`).click();
  await expect(page.getByTestId("sudoku-digit-pad")).toHaveAttribute("data-s2-single-candidate-lock", "true");

  await page.getByTestId("sudoku-mode-notes").click();
  await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("sudoku-digit-pad")).not.toHaveAttribute("data-s2-single-candidate-lock");
  for (let n = 1; n <= 9; n++) {
    await expect(page.getByTestId(`digit-pad-${n}`)).toBeEnabled();
  }
});

test("快速切换焦点：单候选锁不残留到多候选格", async ({ page, request }) => {
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
  await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

  const board = await page.evaluate(() => {
    const g: number[][] = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const btn = document.querySelector(`[data-testid="sudoku-cell-${r}-${c}"]`);
        if (!btn) {
          return null;
        }
        if (btn.getAttribute("data-s2-empty") === "true") {
          g[r][c] = 0;
        } else {
          const t = (btn.textContent ?? "").replace(/\s/g, "");
          const m = t.match(/[1-9]/);
          g[r][c] = m ? Number.parseInt(m[0]!, 10) : 0;
        }
      }
    }
    return g;
  });
  expect(board).not.toBeNull();
  const cells = scanBoard(board!);
  const single = cells.find((x) => x.digits.length === 1);
  const multi = cells.find((x) => x.digits.length >= 2);
  expect(single).toBeDefined();
  expect(multi).toBeDefined();

  await page.getByTestId("sudoku-mode-fill").click();

  for (let k = 0; k < 5; k++) {
    await page.getByTestId(`sudoku-cell-${single!.r}-${single!.c}`).click();
    await page.getByTestId(`sudoku-cell-${multi!.r}-${multi!.c}`).click();
    await expect(page.getByTestId("sudoku-digit-pad")).not.toHaveAttribute("data-s2-single-candidate-lock");
    await expect(page.getByTestId("digit-pad-1")).toBeEnabled();
  }
});
