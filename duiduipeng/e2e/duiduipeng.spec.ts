/**
 * Comprehensive Playwright E2E tests for 对对碰 (Match-3 Puzzle Game).
 *
 * Complements the existing narrower specs (game-controls, playback,
 * instructions) by covering the full game flow:
 *   - Board rendering & HUD completeness
 *   - Timer ticking & pause-freeze
 *   - Tile selection (aria-pressed toggling)
 *   - Valid swap → score increase + moves decrease
 *   - Invalid swap → rejection toast + moves unchanged
 *   - Hint visually highlighting a valid pair
 *   - "New game" reset
 *   - Game-over (fail) dialog with retry
 *   - Level-win dialog with progression to next level
 *   - Multi-level play-through
 *
 * Most tests use `emulateMedia({ reducedMotion: "reduce" })` so chain
 * animations settle instantly, keeping runs fast and deterministic.
 *
 * Run with:  npx playwright test
 * Or:        npm run test:e2e
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROWS = 6;
const COLS = 6;
const TOTAL_TILES = ROWS * COLS;

// Level 1 defaults from level-progression.ts EARLY_GAME_LEVEL_CONFIG
const LEVEL1_TARGET = 200;
const LEVEL1_MOVES = 22;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getScore(page: Page): Promise<number> {
  const text = await page
    .locator("[data-ddp-score-panel]")
    .locator(".tabular-nums")
    .first()
    .innerText();
  return parseInt(text, 10);
}

async function getMoves(page: Page): Promise<number> {
  const text = await page
    .locator("[data-ddp-moves-panel]")
    .locator(".tabular-nums")
    .first()
    .innerText();
  return parseInt(text, 10);
}

async function countPieces(page: Page): Promise<number> {
  return page.locator('button[aria-label^="棋子"]').count();
}

async function getTimerText(page: Page): Promise<string> {
  const cards = page.getByLabel("游戏信息").locator(".tabular-nums");
  // Timer is the 5th (last) tabular-nums element in the HUD grid
  return cards.nth(4).innerText();
}

/**
 * Wait for chain settlement after a valid swap in reduced-motion mode.
 * The reduced-motion useEffect dispatches `playback_finalize` in
 * setTimeout(0), so a small delay + attribute check suffices.
 */
async function waitForSettlement(page: Page): Promise<void> {
  await page.waitForTimeout(100);
  await expect(
    page.locator("[data-ddp-playback]").first(),
  ).toHaveAttribute("data-ddp-playback", "false", { timeout: 10_000 });
}

/**
 * Read the board from DOM, find a valid swap (two orthogonally adjacent
 * cells where swapping creates ≥3-in-a-row), and click both cells.
 * Returns true if a pair was found and clicked.
 */
async function findAndClickValidSwap(page: Page): Promise<boolean> {
  return page.evaluate(
    ({ rows, cols }) => {
      const emojiMap: Record<string, number> = {
        "\uD83D\uDD34": 0,
        "\uD83D\uDFE2": 1,
        "\uD83D\uDD35": 2,
        "\uD83D\uDFE1": 3,
        "\uD83D\uDFE3": 4,
      };
      const board: (number | null)[][] = Array.from({ length: rows }, () =>
        new Array(cols).fill(null),
      );
      const btnMap = new Map<string, HTMLButtonElement>();

      for (const btn of document.querySelectorAll(
        'button[aria-label^="棋子"]',
      )) {
        const label = btn.getAttribute("aria-label") ?? "";
        const m = label.match(/棋子\s+(\d+)\s*,\s*(\d+)/);
        if (!m) continue;
        const r = Number(m[1]) - 1;
        const c = Number(m[2]) - 1;
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const span = btn.querySelector("span");
        const emoji = (span?.textContent ?? "").trim();
        const sym = emojiMap[emoji];
        if (sym !== undefined) {
          board[r][c] = sym;
          btnMap.set(`${r},${c}`, btn as HTMLButtonElement);
        }
      }

      function findMatches(b: (number | null)[][]): Set<string> {
        const matched = new Set<string>();
        for (let r = 0; r < rows; r++) {
          let s = 0;
          for (let c = 1; c <= cols; c++) {
            if (c < cols && b[r]![c] !== null && b[r]![c] === b[r]![s])
              continue;
            if (c - s >= 3 && b[r]![s] !== null)
              for (let k = s; k < c; k++) matched.add(`${r},${k}`);
            s = c;
          }
        }
        for (let c = 0; c < cols; c++) {
          let s = 0;
          for (let r = 1; r <= rows; r++) {
            if (r < rows && b[r]![c] !== null && b[r]![c] === b[s]![c])
              continue;
            if (r - s >= 3 && b[s]![c] !== null)
              for (let k = s; k < r; k++) matched.add(`${k},${c}`);
            s = r;
          }
        }
        return matched;
      }

      const dirs: [number, number][] = [
        [0, 1],
        [1, 0],
      ];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= rows || nc >= cols) continue;
            if (board[r]![c] == null || board[nr]![nc] == null) continue;
            if (board[r]![c] === board[nr]![nc]) continue;

            const trial = board.map((row) => [...row]);
            [trial[r]![c], trial[nr]![nc]] = [trial[nr]![nc]!, trial[r]![c]!];

            const matches = findMatches(trial);
            if (
              matches.has(`${r},${c}`) ||
              matches.has(`${nr},${nc}`)
            ) {
              const btnA = btnMap.get(`${r},${c}`);
              const btnB = btnMap.get(`${nr},${nc}`);
              if (btnA && btnB) {
                btnA.click();
                btnB.click();
                return true;
              }
            }
          }
        }
      }
      return false;
    },
    { rows: ROWS, cols: COLS },
  );
}

/**
 * Find two adjacent cells with different symbols where swapping does NOT
 * create a match-3. Click both to trigger a "no_match" rejection.
 */
async function findAndClickInvalidSwap(page: Page): Promise<boolean> {
  return page.evaluate(
    ({ rows, cols }) => {
      const emojiMap: Record<string, number> = {
        "\uD83D\uDD34": 0,
        "\uD83D\uDFE2": 1,
        "\uD83D\uDD35": 2,
        "\uD83D\uDFE1": 3,
        "\uD83D\uDFE3": 4,
      };
      const board: (number | null)[][] = Array.from({ length: rows }, () =>
        new Array(cols).fill(null),
      );
      const btnMap = new Map<string, HTMLButtonElement>();

      for (const btn of document.querySelectorAll(
        'button[aria-label^="棋子"]',
      )) {
        const label = btn.getAttribute("aria-label") ?? "";
        const m = label.match(/棋子\s+(\d+)\s*,\s*(\d+)/);
        if (!m) continue;
        const r = Number(m[1]) - 1;
        const c = Number(m[2]) - 1;
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const span = btn.querySelector("span");
        const emoji = (span?.textContent ?? "").trim();
        const sym = emojiMap[emoji];
        if (sym !== undefined) {
          board[r][c] = sym;
          btnMap.set(`${r},${c}`, btn as HTMLButtonElement);
        }
      }

      function findMatches(b: (number | null)[][]): Set<string> {
        const matched = new Set<string>();
        for (let r = 0; r < rows; r++) {
          let s = 0;
          for (let c = 1; c <= cols; c++) {
            if (c < cols && b[r]![c] !== null && b[r]![c] === b[r]![s])
              continue;
            if (c - s >= 3 && b[r]![s] !== null)
              for (let k = s; k < c; k++) matched.add(`${r},${k}`);
            s = c;
          }
        }
        for (let c = 0; c < cols; c++) {
          let s = 0;
          for (let r = 1; r <= rows; r++) {
            if (r < rows && b[r]![c] !== null && b[r]![c] === b[s]![c])
              continue;
            if (r - s >= 3 && b[s]![c] !== null)
              for (let k = s; k < r; k++) matched.add(`${k},${c}`);
            s = r;
          }
        }
        return matched;
      }

      const dirs: [number, number][] = [
        [0, 1],
        [1, 0],
      ];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= rows || nc >= cols) continue;
            if (board[r]![c] == null || board[nr]![nc] == null) continue;
            if (board[r]![c] === board[nr]![nc]) continue;

            const trial = board.map((row) => [...row]);
            [trial[r]![c], trial[nr]![nc]] = [trial[nr]![nc]!, trial[r]![c]!];

            const matches = findMatches(trial);
            if (
              !matches.has(`${r},${c}`) &&
              !matches.has(`${nr},${nc}`)
            ) {
              const btnA = btnMap.get(`${r},${c}`);
              const btnB = btnMap.get(`${nr},${nc}`);
              if (btnA && btnB) {
                btnA.click();
                btnB.click();
                return true;
              }
            }
          }
        }
      }
      return false;
    },
    { rows: ROWS, cols: COLS },
  );
}

/**
 * Make valid swaps until the game ends (win or fail dialog appears).
 * Returns the outcome.
 */
async function playUntilEnd(page: Page): Promise<"win" | "fail"> {
  const endDialog = page.locator('[role="dialog"][aria-modal="true"]');

  for (let move = 0; move < 100; move++) {
    if (await endDialog.isVisible()) break;

    const clicked = await findAndClickValidSwap(page);
    if (!clicked) {
      await page.waitForTimeout(300);
      continue;
    }
    await waitForSettlement(page);
  }

  await expect(endDialog).toBeVisible({ timeout: 10_000 });
  const title = await endDialog.locator("#ddp-endgame-title").innerText();
  return title.includes("过关") ? "win" : "fail";
}

/**
 * Solve a level by making valid swaps. If the level is failed, click
 * "重试本关" and try again up to maxRetries times.
 */
async function solveLevel(page: Page, maxRetries = 25): Promise<void> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await playUntilEnd(page);
    if (result === "win") return;

    const retryBtn = page.getByRole("button", { name: "重试本关" });
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();
    await page.waitForTimeout(500);
  }
  throw new Error(`Could not solve level after ${maxRetries} retries`);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("对对碰 - 完整游戏流程", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("ddp-full-chain-animations", "0");
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("对对碰");
  });

  // ----- Rendering & HUD -----

  test("页面加载：棋盘正确渲染 36 格，HUD 完整", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("对对碰");
    await expect(page.locator("text=第 1 关").first()).toBeVisible();

    const hud = page.getByLabel("游戏信息");
    await expect(hud).toBeVisible();
    await expect(hud.getByText("得分")).toBeVisible();
    await expect(hud.getByText("目标")).toBeVisible();
    await expect(hud.getByText("剩余步数")).toBeVisible();
    await expect(hud.getByText("用时")).toBeVisible();

    expect(await getScore(page)).toBe(0);
    expect(await getMoves(page)).toBe(LEVEL1_MOVES);

    const tileCount = await countPieces(page);
    expect(tileCount).toBe(TOTAL_TILES);

    await expect(page.getByTestId("ddp-pause-toggle")).toBeVisible();
    await expect(page.getByTestId("ddp-hint-button")).toBeVisible();
    await expect(page.getByTestId("ddp-skip-playback")).toBeVisible();
  });

  // ----- Timer -----

  test("计时器正常向上计数", async ({ page }) => {
    const t0 = await getTimerText(page);
    await page.waitForTimeout(2_000);
    const t1 = await getTimerText(page);
    expect(t0).not.toBe(t1);
  });

  test("暂停时计时器冻结，恢复后继续", async ({ page }) => {
    await page.waitForTimeout(1_200);

    const pause = page.getByTestId("ddp-pause-toggle");
    await pause.click();
    await expect(pause).toHaveText("继续");

    const tPaused = await getTimerText(page);
    await page.waitForTimeout(2_000);
    const tStill = await getTimerText(page);
    expect(tPaused).toBe(tStill);

    await pause.click();
    await page.waitForTimeout(1_500);
    const tResumed = await getTimerText(page);
    expect(tResumed).not.toBe(tPaused);
  });

  // ----- Tile selection -----

  test("点选格子：首次点选高亮，再点同格取消", async ({ page }) => {
    const piece = page.getByRole("button", { name: "棋子 1,1" });
    await expect(piece).toHaveAttribute("aria-pressed", "false");

    await piece.click();
    await expect(piece).toHaveAttribute("aria-pressed", "true");

    await piece.click();
    await expect(piece).toHaveAttribute("aria-pressed", "false");
  });

  // ----- Valid swap -----

  test("有效交换：得分增加，步数减少", async ({ page }) => {
    const scoreBefore = await getScore(page);
    const movesBefore = await getMoves(page);

    const clicked = await findAndClickValidSwap(page);
    expect(clicked).toBe(true);

    await waitForSettlement(page);

    const scoreAfter = await getScore(page);
    const movesAfter = await getMoves(page);

    expect(scoreAfter).toBeGreaterThan(scoreBefore);
    expect(movesAfter).toBe(movesBefore - 1);

    const tileCount = await countPieces(page);
    expect(tileCount).toBe(TOTAL_TILES);
  });

  // ----- Invalid swap -----

  test("无效交换：提示「未形成三消」，步数不变", async ({ page }) => {
    const movesBefore = await getMoves(page);

    const clicked = await findAndClickInvalidSwap(page);
    expect(clicked).toBe(true);

    await page.waitForTimeout(300);

    const toast = page.locator('[role="status"][aria-live="polite"]');
    await expect(toast).toContainText("未形成三消", { timeout: 5_000 });

    const movesAfter = await getMoves(page);
    expect(movesAfter).toBe(movesBefore);
  });

  // ----- Hint -----

  test("提示高亮可交换配对", async ({ page }) => {
    const countHighlighted = async () =>
      page.evaluate(() => {
        let n = 0;
        for (const btn of document.querySelectorAll(
          'button[aria-label^="棋子"]',
        )) {
          const bs = getComputedStyle(btn).boxShadow;
          if (bs && bs !== "none" && bs.includes("0px 0px 0px 2px")) n++;
        }
        return n;
      });

    const before = await countHighlighted();
    expect(before).toBe(0);

    await page.getByTestId("ddp-hint-button").click();
    await page.waitForTimeout(500);

    const after = await countHighlighted();
    expect(after).toBeGreaterThanOrEqual(2);

    // Highlight should auto-dismiss after ~2.8s
    await page.waitForTimeout(3_500);
    const afterDismiss = await countHighlighted();
    expect(afterDismiss).toBe(0);
  });

  // ----- New game reset -----

  test("新游戏（第 1 关）重置所有状态", async ({ page }) => {
    const clicked = await findAndClickValidSwap(page);
    expect(clicked).toBe(true);
    await waitForSettlement(page);

    expect(await getScore(page)).toBeGreaterThan(0);
    expect(await getMoves(page)).toBeLessThan(LEVEL1_MOVES);

    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "新游戏（第 1 关）" }).click();
    await page.waitForTimeout(500);

    expect(await getScore(page)).toBe(0);
    expect(await getMoves(page)).toBe(LEVEL1_MOVES);
    expect(await countPieces(page)).toBe(TOTAL_TILES);
    await expect(page.locator("text=第 1 关").first()).toBeVisible();
  });

  // ----- Game over & level progression -----

  test("对局结束弹窗：失败显示重试，胜利显示下一关", async ({ page }) => {
    test.setTimeout(300_000);

    const result = await playUntilEnd(page);
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible();

    if (result === "fail") {
      await expect(
        dialog.locator("#ddp-endgame-title"),
      ).toContainText("本关未达标");
      await expect(
        dialog.getByRole("button", { name: "重试本关" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "新游戏（第 1 关）" }),
      ).toBeVisible();

      await dialog.getByRole("button", { name: "重试本关" }).click();
      await page.waitForTimeout(500);

      await expect(page.locator("text=第 1 关").first()).toBeVisible();
      expect(await getScore(page)).toBe(0);
      expect(await getMoves(page)).toBe(LEVEL1_MOVES);
    } else {
      await expect(
        dialog.locator("#ddp-endgame-title"),
      ).toContainText("过关");
      await expect(
        dialog.getByRole("button", { name: "下一关" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "新游戏（第 1 关）" }),
      ).toBeVisible();
    }
  });

  test("连续通过多关：关卡递进与胜利弹窗", async ({ page }) => {
    test.setTimeout(600_000);

    const levelsToPlay = 2;

    for (let li = 0; li < levelsToPlay; li++) {
      const levelNum = li + 1;
      await expect(
        page.locator(`text=第 ${levelNum} 关`).first(),
      ).toBeVisible();

      await solveLevel(page);

      const dialog = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.locator("#ddp-endgame-title"),
      ).toContainText("过关");

      const score = await getScore(page);
      expect(score).toBeGreaterThan(0);

      if (li < levelsToPlay - 1) {
        await dialog.getByRole("button", { name: "下一关" }).click();
        await page.waitForTimeout(500);
      }
    }

    // After the last win, go back to level 1 via new game
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    page.on("dialog", (d) => d.accept());
    await dialog
      .getByRole("button", { name: "新游戏（第 1 关）" })
      .click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=第 1 关").first()).toBeVisible();
    expect(await getScore(page)).toBe(0);
    expect(await countPieces(page)).toBe(TOTAL_TILES);
  });
});
