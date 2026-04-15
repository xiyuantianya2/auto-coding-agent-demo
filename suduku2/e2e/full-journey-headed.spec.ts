/**
 * 完整旅程（推荐本地 `--headed` 观看）：
 * - UI 注册测试账号
 * - 无尽四档各通关一关
 * - 教学大纲中每个专项模式各通关一关
 *
 * 通过拦截 GET /api/progress 与 /api/practice/puzzle 注入 {@link E2E_SINGLES_CHAIN_PUZZLE}，
 * 保证「裸单链」可解，避免随机题耗时或卡死。
 */
import { expect, test, type Page } from "@playwright/test";

import { E2E_SINGLES_CHAIN_PUZZLE } from "./fixtures/singles-chain-puzzle";
import { ensurePlayingNotPaused } from "./helpers";

test.describe.configure({ retries: 0 });

const BASE = "http://127.0.0.1:3003";

const ENDLESS_TIERS = ["entry", "normal", "hard", "expert"] as const;

/** 与 `content/curriculum` 中 `practiceEndlessModeId` 一致 */
const PRACTICE_MODE_IDS = [
  "practice-endless:unique-candidate",
  "practice-endless:hidden-single",
  "practice-endless:pointing",
  "practice-endless:box-line-reduction",
  "practice-endless:naked-pair",
  "practice-endless:hidden-pair",
  "practice-endless:naked-triple",
  "practice-endless:hidden-triple",
  "practice-endless:x-wing",
] as const;

const ALL_TECHNIQUE_IDS = [
  "unique-candidate",
  "hidden-single",
  "pointing",
  "box-line-reduction",
  "naked-pair",
  "hidden-pair",
  "naked-triple",
  "hidden-triple",
  "x-wing",
] as const;

async function switchToRegisterTab(page: Page): Promise<void> {
  if (new URL(page.url()).searchParams.get("mode") !== "register") {
    await page.getByTestId("auth-tab-register").click();
  }
  await expect(page).toHaveURL(/\/login\?mode=register$/);
}

async function hasAnyEmptyCell(page: Page): Promise<boolean> {
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

async function pickSingleCandidate(page: Page): Promise<{ r: number; c: number } | null> {
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

async function gotoPracticeWithBoard(page: Page, modeId: string): Promise<void> {
  await page.goto(`/game/practice?modeId=${encodeURIComponent(modeId)}`);
  await expect(page.getByTestId("practice-play-root")).toBeVisible({ timeout: 120_000 });

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

async function prepareQuickGame(page: Page): Promise<void> {
  await ensurePlayingNotPaused(page);
  const quickToggle = page.getByTestId("sudoku-quick-game");
  await quickToggle.check();
  await expect(quickToggle).toBeChecked();
  await expect(page.getByTestId("sudoku-mode-fill")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("sudoku-mode-fill").click();
  await expect(page.getByTestId("sudoku-mode-fill")).toHaveAttribute("aria-pressed", "true");
}

/**
 * 快速游戏 + 裸单链填至胜利横幅出现。
 */
async function solveFixtureBoardUntilWin(
  page: Page,
  winBannerTestId: string,
  winSubstring: string,
  reload: () => Promise<void>,
): Promise<void> {
  await expect(async () => {
    const p = await pickSingleCandidate(page);
    expect(p).not.toBeNull();
  }).toPass({ timeout: 60_000 });

  let reloads = 0;
  const maxReloads = 6;
  let stagnant = 0;

  for (let step = 0; step < 650; step++) {
    const win = page.getByTestId(winBannerTestId);
    if (await win.isVisible()) {
      await expect(win).toContainText(winSubstring);
      return;
    }

    const pick = await pickSingleCandidate(page);
    if (!pick) {
      if (await win.isVisible()) {
        await expect(win).toContainText(winSubstring);
        return;
      }
      if (!(await hasAnyEmptyCell(page))) {
        await expect(win).toBeVisible({ timeout: 30_000 });
        await expect(win).toContainText(winSubstring);
        return;
      }
      stagnant += 1;
      if (stagnant < 8) {
        continue;
      }
      expect(reloads, "多次重载后仍无唯一候选").toBeLessThan(maxReloads);
      reloads += 1;
      stagnant = 0;
      await reload();
      await prepareQuickGame(page);
      continue;
    }

    stagnant = 0;
    await page.getByTestId(`sudoku-cell-${pick.r}-${pick.c}`).click();
  }

  throw new Error("步数上限内未完成通关");
}

test("完整旅程：UI 注册 → 无尽四档 → 各专项一关（headed 可视）", async ({ page, request }) => {
  test.setTimeout(900_000);

  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.route("**/api/practice/puzzle*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({ spec: E2E_SINGLES_CHAIN_PUZZLE }),
      });
    } catch {
      await route.continue().catch(() => {});
    }
  });

  await page.route("**/api/progress", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    let response: Awaited<ReturnType<typeof route.fetch>>;
    try {
      response = await route.fetch();
    } catch {
      await route.continue().catch(() => {});
      return;
    }
    if (response.status() !== 200) {
      await route.fulfill({ response });
      return;
    }
    const body = (await response.json()) as {
      endless?: Record<string, { clearedLevel?: number }>;
      global?: Record<string, { maxPreparedLevel?: number; puzzles?: Record<number, unknown> }>;
    };
    if (!body.global || !body.endless) {
      await route.fulfill({ response });
      return;
    }
    for (const tier of ENDLESS_TIERS) {
      const g = body.global[tier];
      if (!g?.puzzles) {
        continue;
      }
      const cleared = body.endless[tier]?.clearedLevel ?? 0;
      const nextLevel = cleared + 1;
      g.puzzles[nextLevel] = E2E_SINGLES_CHAIN_PUZZLE;
      g.maxPreparedLevel = Math.max(g.maxPreparedLevel ?? 0, nextLevel);
    }
    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(body),
      });
    } catch {
      await route.continue().catch(() => {});
    }
  });

  const password = "secret12";
  const username = `tour_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  await page.goto("/login");
  await switchToRegisterTab(page);
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();

  await page.waitForURL(`${BASE}/`);
  await expect(page.getByTestId("session-status")).toContainText("已登录");

  const token = await page.evaluate(() => globalThis.localStorage.getItem("suduku2.auth.token"));
  expect(token).toBeTruthy();

  const techniques = Object.fromEntries(
    ALL_TECHNIQUE_IDS.map((id) => [id, { unlocked: true }]),
  ) as Record<string, { unlocked: boolean }>;

  const patchRes = await request.patch(`${BASE}/api/progress`, {
    headers: {
      Authorization: `Bearer ${token!}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: { techniques },
  });
  expect(patchRes.status()).toBe(204);

  for (const tier of ENDLESS_TIERS) {
    await page.goto(`/game/endless/${tier}`);
    await expect(page.getByTestId("endless-play-root")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId("endless-board")).toBeVisible({ timeout: 120_000 });
    await prepareQuickGame(page);
    await solveFixtureBoardUntilWin(page, "endless-win-banner", "恭喜通关", async () => {
      await page.reload();
      await expect(page.getByTestId("endless-board")).toBeVisible({ timeout: 120_000 });
    });
    await page.getByTestId("endless-back").click();
    await expect(page.getByTestId("endless-tier-list")).toBeVisible({ timeout: 30_000 });
  }

  for (const modeId of PRACTICE_MODE_IDS) {
    await gotoPracticeWithBoard(page, modeId);
    await prepareQuickGame(page);
    await solveFixtureBoardUntilWin(page, "practice-win-banner", "恭喜完成本局", async () => {
      await page.reload();
      await gotoPracticeWithBoard(page, modeId);
    });
  }

  await page.unrouteAll({ behavior: "ignoreErrors" });
});
