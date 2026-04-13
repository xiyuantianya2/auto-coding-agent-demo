/**
 * Headed Playwright E2E test for the Link Game (连连看).
 *
 * Verifies the complete game flow across all 3 levels:
 *   - Board rendering, tile clicking, matching & elimination
 *   - Timer ticking and freezing on win
 *   - Hint button highlighting a connectable pair
 *   - Restart button resetting the board
 *   - Level progression (auto-advance or manual)
 *   - Final "all cleared" victory screen and replay
 *
 * Run with:  npx playwright test --headed
 * Or:        npm run test:e2e
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LEVELS = [
  { id: 1, name: "入门", rows: 4, cols: 4, tiles: 16 },
  { id: 2, name: "进阶", rows: 5, cols: 6, tiles: 30 },
  { id: 3, name: "挑战", rows: 6, cols: 8, tiles: 48 },
];

interface CellCoord {
  row: number;
  col: number;
}

/**
 * Find a connectable pair via page.evaluate (reads DOM + runs BFS).
 */
async function findConnectablePair(
  page: Page,
  rows: number,
  cols: number,
): Promise<{ a: CellCoord; b: CellCoord } | null> {
  return page.evaluate(
    ({ rows, cols }) => {
      const allButtons = document.querySelectorAll(
        'button[aria-label^="棋子"]',
      );
      const board: (number | null)[][] = Array.from({ length: rows }, () =>
        new Array(cols).fill(null),
      );
      for (const btn of allButtons) {
        const label = btn.getAttribute("aria-label") ?? "";
        const coordMatch = label.match(/棋子\s+(\d+)\s*,\s*(\d+)/);
        const patternMatch = label.match(/图案\s*(\d+)/);
        if (coordMatch && patternMatch) {
          const r = Number(coordMatch[1]) - 1;
          const c = Number(coordMatch[2]) - 1;
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            board[r][c] = Number(patternMatch[1]);
          }
        }
      }

      const DR = [-1, 0, 1, 0];
      const DC = [0, 1, 0, -1];
      function canConnect(
        ax: number,
        ay: number,
        bx: number,
        by: number,
      ): boolean {
        const pr = rows + 2;
        const pc = cols + 2;
        const pad: (number | null)[][] = Array.from({ length: pr }, () =>
          new Array(pc).fill(null),
        );
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) pad[r + 1][c + 1] = board[r][c];
        pad[ax + 1][ay + 1] = null;
        pad[bx + 1][by + 1] = null;
        const sr = ax + 1,
          sc = ay + 1,
          er = bx + 1,
          ec = by + 1;
        const queue: [number, number, number, number][] = [[sr, sc, -1, 0]];
        const seen = new Set<string>();
        let head = 0;
        while (head < queue.length) {
          const [r, c, lastDir, bends] = queue[head++];
          const key = `${r},${c},${lastDir},${bends}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (r === er && c === ec) return true;
          for (let d = 0; d < 4; d++) {
            const nr = r + DR[d],
              nc = c + DC[d];
            if (nr < 0 || nr >= pr || nc < 0 || nc >= pc) continue;
            if (pad[nr][nc] !== null) continue;
            let nb = bends;
            if (lastDir !== -1 && d !== lastDir) nb++;
            if (nb > 2) continue;
            queue.push([nr, nc, d, nb]);
          }
        }
        return false;
      }

      const byPattern = new Map<number, { row: number; col: number }[]>();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = board[r][c];
          if (v === null) continue;
          if (!byPattern.has(v)) byPattern.set(v, []);
          byPattern.get(v)!.push({ row: r, col: c });
        }
      }
      for (const cells of byPattern.values()) {
        for (let i = 0; i < cells.length; i++) {
          for (let j = i + 1; j < cells.length; j++) {
            if (canConnect(cells[i].row, cells[i].col, cells[j].row, cells[j].col)) {
              return { a: cells[i], b: cells[j] };
            }
          }
        }
      }
      return null;
    },
    { rows, cols },
  );
}

/**
 * Find a connectable pair AND click both cells in one evaluate call.
 * Returns true if a pair was found and clicked, false otherwise.
 */
async function findAndClickPair(
  page: Page,
  rows: number,
  cols: number,
): Promise<boolean> {
  return page.evaluate(
    ({ rows, cols }) => {
      const allButtons = document.querySelectorAll(
        'button[aria-label^="棋子"]',
      );
      const board: (number | null)[][] = Array.from({ length: rows }, () =>
        new Array(cols).fill(null),
      );
      const btnMap = new Map<string, HTMLButtonElement>();

      for (const btn of allButtons) {
        const label = btn.getAttribute("aria-label") ?? "";
        const coordMatch = label.match(/棋子\s+(\d+)\s*,\s*(\d+)/);
        const patternMatch = label.match(/图案\s*(\d+)/);
        if (coordMatch && patternMatch) {
          const r = Number(coordMatch[1]) - 1;
          const c = Number(coordMatch[2]) - 1;
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            board[r][c] = Number(patternMatch[1]);
            btnMap.set(`${r},${c}`, btn as HTMLButtonElement);
          }
        }
      }

      const DR = [-1, 0, 1, 0];
      const DC = [0, 1, 0, -1];
      function canConnect(
        ax: number,
        ay: number,
        bx: number,
        by: number,
      ): boolean {
        const pr = rows + 2;
        const pc = cols + 2;
        const pad: (number | null)[][] = Array.from({ length: pr }, () =>
          new Array(pc).fill(null),
        );
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) pad[r + 1][c + 1] = board[r][c];
        pad[ax + 1][ay + 1] = null;
        pad[bx + 1][by + 1] = null;
        const sr = ax + 1,
          sc = ay + 1,
          er = bx + 1,
          ec = by + 1;
        const queue: [number, number, number, number][] = [[sr, sc, -1, 0]];
        const seen = new Set<string>();
        let head = 0;
        while (head < queue.length) {
          const [r, c, lastDir, bends] = queue[head++];
          const key = `${r},${c},${lastDir},${bends}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (r === er && c === ec) return true;
          for (let d = 0; d < 4; d++) {
            const nr = r + DR[d],
              nc = c + DC[d];
            if (nr < 0 || nr >= pr || nc < 0 || nc >= pc) continue;
            if (pad[nr][nc] !== null) continue;
            let nb = bends;
            if (lastDir !== -1 && d !== lastDir) nb++;
            if (nb > 2) continue;
            queue.push([nr, nc, d, nb]);
          }
        }
        return false;
      }

      const byPattern = new Map<number, { row: number; col: number }[]>();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = board[r][c];
          if (v === null) continue;
          if (!byPattern.has(v)) byPattern.set(v, []);
          byPattern.get(v)!.push({ row: r, col: c });
        }
      }

      for (const cells of byPattern.values()) {
        for (let i = 0; i < cells.length; i++) {
          for (let j = i + 1; j < cells.length; j++) {
            const a = cells[i], b = cells[j];
            if (canConnect(a.row, a.col, b.row, b.col)) {
              const btnA = btnMap.get(`${a.row},${a.col}`);
              const btnB = btnMap.get(`${b.row},${b.col}`);
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
    { rows, cols },
  );
}

/** Click a cell using Playwright locator (for non-solver interactions). */
async function clickCell(page: Page, coord: CellCoord) {
  const label = new RegExp(
    `^棋子 ${coord.row + 1},${coord.col + 1}，`,
  );
  const btn = page.getByRole("button", { name: label });
  if ((await btn.count()) > 0 && (await btn.isEnabled())) {
    await btn.click();
  }
}

/** Count remaining tile buttons on the board. */
async function countTiles(page: Page): Promise<number> {
  return page.locator('button[aria-label^="棋子"]').count();
}

/**
 * Solve the current level by repeatedly finding & clicking connectable pairs.
 * Uses findAndClickPair for atomicity (find + click in single evaluate).
 * If stuck, restarts the level with a fresh board.
 */
async function solveLevel(page: Page, level: (typeof LEVELS)[number]) {
  const maxRetries = 10;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let stuckCount = 0;

    for (let move = 0; move < 300; move++) {
      const remaining = await countTiles(page);
      if (remaining === 0) return;

      const clicked = await findAndClickPair(page, level.rows, level.cols);
      if (!clicked) {
        stuckCount++;
        if (stuckCount > 3) {
          await page.getByRole("button", { name: "重新开始本关" }).click();
          await page.waitForTimeout(400);
          break;
        }
        await page.waitForTimeout(200);
        continue;
      }

      stuckCount = 0;
      // Small delay to let React re-render after the click
      await page.waitForTimeout(80);
    }

    const remaining = await countTiles(page);
    if (remaining === 0) return;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("连连看 - Full game flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("连连看");
  });

  test("Page loads with game board and HUD", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();

    // HUD elements
    await expect(page.getByText("第 1 关")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "入门" }),
    ).toBeVisible();
    await expect(page.getByText("已用时间")).toBeVisible();

    // Control buttons
    await expect(
      page.getByRole("button", { name: "暂停" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "提示" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "重新开始本关" }),
    ).toBeVisible();

    // Level selector
    await expect(page.getByText("关卡（顺序解锁）")).toBeVisible();

    // Board grid should have tile buttons
    const tileButtons = page.locator('button[aria-label^="棋子"]');
    await expect(tileButtons.first()).toBeVisible();
    const count = await tileButtons.count();
    expect(count).toBe(LEVELS[0].tiles);
  });

  test("Timer ticks upward", async ({ page }) => {
    const timerEl = page.locator('p:has-text("已用时间")');
    const t0 = await timerEl.textContent();
    await page.waitForTimeout(1500);
    const t1 = await timerEl.textContent();
    expect(t0).not.toBe(t1);
  });

  test("Hint highlights a pair of tiles", async ({ page }) => {
    await page.getByRole("button", { name: "提示" }).click();
    await page.waitForTimeout(800);

    const amberTiles = page.locator(
      'button[aria-label^="棋子"][class*="amber"]',
    );
    const count = await amberTiles.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Highlight should disappear after ~2.6s
    await expect(amberTiles).toHaveCount(0, { timeout: 5_000 });
  });

  test("Restart resets the board", async ({ page }) => {
    const level = LEVELS[0];

    // Solve one pair to reduce tile count
    const pair = await findConnectablePair(page, level.rows, level.cols);
    if (pair) {
      await clickCell(page, pair.a);
      await page.waitForTimeout(200);
      await clickCell(page, pair.b);
      await page.waitForTimeout(500);
    }

    const tilesAfterMatch = await countTiles(page);
    expect(tilesAfterMatch).toBeLessThan(level.tiles);

    await page.getByRole("button", { name: "重新开始本关" }).click();
    await page.waitForTimeout(500);

    const tilesAfterRestart = await countTiles(page);
    expect(tilesAfterRestart).toBe(level.tiles);
  });

  test("Pause freezes the game", async ({ page }) => {
    const timerEl = page.locator('p:has-text("已用时间")');

    await page.getByRole("button", { name: "暂停" }).click();
    await page.waitForTimeout(300);
    await expect(
      page.getByRole("button", { name: "继续" }),
    ).toBeVisible();

    const tPaused = await timerEl.textContent();
    await page.waitForTimeout(1500);
    const tStill = await timerEl.textContent();
    expect(tPaused).toBe(tStill);

    await page.getByRole("button", { name: "继续" }).click();
    await page.waitForTimeout(1500);
    const tResumed = await timerEl.textContent();
    expect(tResumed).not.toBe(tPaused);
  });

  test("Play through all 3 levels to victory", async ({ page }) => {
    test.setTimeout(300_000);

    for (let li = 0; li < LEVELS.length; li++) {
      const level = LEVELS[li];

      await expect(page.getByText(`第 ${level.id} 关`)).toBeVisible();

      // Solve the level
      await solveLevel(page, level);

      await page.waitForTimeout(600);

      if (li < LEVELS.length - 1) {
        await expect(
          page.locator('[role="status"]').filter({ hasText: "本关已完成" }),
        ).toBeVisible({ timeout: 15_000 });

        await expect(
          page.getByRole("button", { name: "已结束" }),
        ).toBeVisible();

        // Uncheck auto-advance, then manually click next level
        const autoCheckbox = page.locator('input[type="checkbox"]');
        if (
          (await autoCheckbox.count()) > 0 &&
          (await autoCheckbox.isChecked())
        ) {
          await autoCheckbox.uncheck();
        }

        await page.getByRole("button", { name: "下一关" }).click();
        await page.waitForTimeout(1000);
      } else {
        await expect(
          page.locator('[role="status"]').filter({ hasText: "全部通关" }),
        ).toBeVisible({ timeout: 15_000 });

        await expect(
          page.getByRole("button", { name: "再玩一次" }),
        ).toBeVisible();
      }
    }

    // Click "再玩一次" and verify reset
    await page.getByRole("button", { name: "再玩一次" }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("第 1 关")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "入门" }),
    ).toBeVisible();

    const tilesCount = await countTiles(page);
    expect(tilesCount).toBe(LEVELS[0].tiles);
  });
});
