/**
 * 任务 22：快速游戏开关、单候选点击自动填数、笔记模式优先级与 localStorage 持久化。
 */
import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

test("快速游戏：单候选自动填、多候选不填、笔记模式不填、关闭恢复仅选中、刷新保持开关", async ({
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
  await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

  const quickToggle = page.getByTestId("sudoku-quick-game");
  await expect(quickToggle).not.toBeChecked();

  const scanBoard = () =>
    page.evaluate(() => {
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

  let scanned = await scanBoard();
  for (let attempt = 0;
    attempt < 8 && (scanned.single === null || scanned.multi === null);
    attempt++
  ) {
    await page.reload();
    await expect(page.getByTestId("practice-play-root")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });
    scanned = await scanBoard();
  }

  expect(scanned.single, "盘面应至少有一格在规则下仅一个合法填数").not.toBeNull();
  expect(scanned.multi, "盘面应至少有一格有多个合法填数").not.toBeNull();

  await page.getByTestId("sudoku-mode-fill").click();

  const s = scanned.single!;
  const m = scanned.multi!;

  /* 关闭快速游戏：点单候选格仅选中，不自动填 */
  await page.getByTestId(`sudoku-cell-${s.r}-${s.c}`).click();
  await expect(page.getByTestId(`sudoku-cell-${s.r}-${s.c}`)).toHaveAttribute("data-s2-empty", "true");

  /* 开启快速游戏 */
  await quickToggle.check();
  await expect(quickToggle).toBeChecked();

  /* 多候选格：不自动填 */
  await page.getByTestId(`sudoku-cell-${m.r}-${m.c}`).click();
  await expect(page.getByTestId(`sudoku-cell-${m.r}-${m.c}`)).toHaveAttribute("data-s2-empty", "true");

  /* 单候选格：自动填入 */
  await page.getByTestId(`sudoku-cell-${s.r}-${s.c}`).click();
  await expect(page.getByTestId(`sudoku-cell-${s.r}-${s.c}`)).not.toHaveAttribute("data-s2-empty", "true");
  await expect(page.getByTestId(`sudoku-cell-${s.r}-${s.c}`)).toContainText(String(s.d));

  /* 撤销一步，恢复空格以便测笔记模式 */
  await page.getByTestId("sudoku-undo").click();
  await expect(page.getByTestId(`sudoku-cell-${s.r}-${s.c}`)).toHaveAttribute("data-s2-empty", "true");

  /* 笔记模式 + 快速游戏：不自动填（优先级：笔记编辑）；先点他格避免焦点仍在 s 上触发「二次点击切模式」 */
  await page.getByTestId(`sudoku-cell-${m.r}-${m.c}`).click();
  await page.getByTestId("sudoku-mode-notes").click();
  await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId(`sudoku-cell-${s.r}-${s.c}`).click();
  await expect(page.getByTestId(`sudoku-cell-${s.r}-${s.c}`)).toHaveAttribute("data-s2-empty", "true");

  await page.getByTestId("sudoku-mode-fill").click();

  /* 关闭快速游戏：再次点击单候选仅选中 */
  await quickToggle.uncheck();
  await expect(quickToggle).not.toBeChecked();
  await page.getByTestId(`sudoku-cell-${m.r}-${m.c}`).click();
  await page.getByTestId(`sudoku-cell-${s.r}-${s.c}`).click();
  await expect(page.getByTestId(`sudoku-cell-${s.r}-${s.c}`)).toHaveAttribute("data-s2-empty", "true");

  /* 持久化：勾选后刷新仍开启 */
  await quickToggle.check();
  await page.reload();
  await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("sudoku-quick-game")).toBeChecked();
});
