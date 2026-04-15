/**
 * 完整通关：专项练习 + 快速游戏，仅依赖「唯一候选」链式填数直至胜利横幅。
 * 若随机题目在某阶段无唯一候选，则整页重试以换新题（与 quick-game.spec 思路一致）。
 */
import { test, expect } from "@playwright/test";

import { E2E_SINGLES_CHAIN_PUZZLE } from "./fixtures/singles-chain-puzzle";
import { apiRegisterAndLogin, ensurePlayingNotPaused, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

async function gotoPracticeWithBoard(page: import("@playwright/test").Page, modeId: string): Promise<void> {
  await page.goto(`/game/practice?modeId=${encodeURIComponent(modeId)}`);
  await expect(page.getByTestId("practice-play-root")).toBeVisible({ timeout: 60_000 });

  const board = page.getByTestId("practice-board");
  const retryBtn = page.getByTestId("practice-retry");

  await expect(async () => {
    if (await board.isVisible()) {
      return;
    }
    if (await retryBtn.isVisible()) {
      await retryBtn.click();
    }
    expect(await board.isVisible()).toBe(true);
  }).toPass({ timeout: 120_000 });
}

async function hasAnyEmptyCell(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const btn = document.querySelector(`[data-testid="sudoku-cell-${r}-${c}"]`);
        if (btn?.getAttribute("data-s2-empty") === "true") {
          return true;
        }
      }
    }
    return false;
  });
}

async function pickSingleCandidate(
  page: import("@playwright/test").Page,
): Promise<{ r: number; c: number } | null> {
  return page.evaluate(() => {
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
          return null;
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
        if (ds.length === 1) {
          return { r, c };
        }
      }
    }
    return null;
  });
}

test("专项练习：快速游戏链式唯一候选直至胜利横幅（整局通关）", async ({ page, request }) => {
  test.setTimeout(180_000);

  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.route("**/api/practice/puzzle*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ spec: E2E_SINGLES_CHAIN_PUZZLE }),
    });
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

  await gotoPracticeWithBoard(page, MODE);
  await ensurePlayingNotPaused(page);

  const quickToggle = page.getByTestId("sudoku-quick-game");
  await quickToggle.check();
  await expect(quickToggle).toBeChecked();
  await expect(page.getByTestId("sudoku-mode-fill")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("sudoku-mode-fill").click();
  await expect(page.getByTestId("sudoku-mode-fill")).toHaveAttribute("aria-pressed", "true");

  await expect(async () => {
    const p = await pickSingleCandidate(page);
    expect(p).not.toBeNull();
  }).toPass({ timeout: 60_000 });

  let reloads = 0;
  /** 固定题仍可能因 UI/竞态短暂卡住，保留少量整页重试 */
  const maxReloads = 6;
  let stagnant = 0;

  for (let step = 0; step < 650; step++) {
    const win = page.getByTestId("practice-win-banner");
    if (await win.isVisible()) {
      await expect(win).toContainText("恭喜完成本局");
      return;
    }

    const pick = await pickSingleCandidate(page);
    if (!pick) {
      if (await win.isVisible()) {
        await expect(win).toContainText("恭喜完成本局");
        return;
      }
      if (!(await hasAnyEmptyCell(page))) {
        await expect(win).toBeVisible({ timeout: 30_000 });
        await expect(win).toContainText("恭喜完成本局");
        return;
      }
      stagnant += 1;
      if (stagnant < 8) {
        continue;
      }
      expect(reloads, "多次重载后仍无唯一候选，题目可能无法用纯唯一候选链完成").toBeLessThan(maxReloads);
      reloads += 1;
      stagnant = 0;
      await page.reload();
      await gotoPracticeWithBoard(page, MODE);
      await ensurePlayingNotPaused(page);
      await quickToggle.check();
      await expect(quickToggle).toBeChecked();
      await expect(page.getByTestId("sudoku-mode-fill")).toBeEnabled({ timeout: 30_000 });
      await page.getByTestId("sudoku-mode-fill").click();
      await expect(page.getByTestId("sudoku-mode-fill")).toHaveAttribute("aria-pressed", "true");
      continue;
    }

    stagnant = 0;
    await page.getByTestId(`sudoku-cell-${pick.r}-${pick.c}`).click();
  }

  throw new Error("步数上限内未完成通关");
});
