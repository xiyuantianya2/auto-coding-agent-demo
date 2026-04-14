import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

import type { DifficultyTier, EndlessGlobalState, UserProgress } from "@/server/types";

test.describe.configure({ retries: 1 });

type ProgressBody = UserProgress & { global: EndlessGlobalState };

function countGivensInGrid(g: number[][]): number {
  let n = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = g[r]?.[c];
      if (typeof v === "number" && v > 0) n += 1;
    }
  }
  return n;
}

/**
 * 产品设计：下一关为 clearedLevel+1；池中需有 puzzles[nextLevel]，否则 UI 显示「准备中」。
 * maxPreparedLevel 与 puzzles 的键一致（为已准备到的最高关卡号）。
 */
function assertGlobalTierMatchesNextLevel(
  tier: DifficultyTier,
  clearedLevel: number,
  globalTier: EndlessGlobalState[DifficultyTier],
): void {
  const nextLevel = clearedLevel + 1;
  const spec = globalTier.puzzles[nextLevel];

  if (spec) {
    expect(spec.seed.length).toBeGreaterThan(0);
    expect(spec.givens.length).toBe(9);
    for (let r = 0; r < 9; r++) {
      expect(spec.givens[r]?.length).toBe(9);
    }
    expect(globalTier.maxPreparedLevel).toBeGreaterThanOrEqual(nextLevel);
  } else {
    expect(globalTier.maxPreparedLevel).toBeLessThan(nextLevel);
  }

  expect(Number.isInteger(globalTier.maxPreparedLevel)).toBe(true);
  expect(globalTier.maxPreparedLevel).toBeGreaterThanOrEqual(0);
}

test("getProgress：四档 global 与 endless.clearedLevel+1 契约（新用户）", async ({
  request,
}) => {
  const { token } = await apiRegisterAndLogin(request);
  const res = await request.get("/api/progress", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as ProgressBody;

  for (const tier of ["entry", "normal", "hard", "expert"] as const) {
    const cleared = body.endless[tier].clearedLevel;
    expect(cleared).toBe(0);
    assertGlobalTierMatchesNextLevel(tier, cleared, body.global[tier]);
  }
});

test("入门档：盘面提示数/种子与 getProgress 中 PuzzleSpec 一致", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  const { token } = await apiRegisterAndLogin(request);

  const progRes = await request.get("/api/progress", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(progRes.ok()).toBeTruthy();
  const prog = (await progRes.json()) as ProgressBody;
  const cleared = prog.endless.entry.clearedLevel;
  const nextLevel = cleared + 1;
  const spec = prog.global.entry.puzzles[nextLevel];
  expect(spec, "新用户入门第 1 关应在共享池中就绪").toBeDefined();
  const apiGivens = countGivensInGrid(spec!.givens);

  await injectAuth(page, token);
  await page.goto("/game/endless/entry");
  await expect(page.getByTestId("endless-play-root")).toBeVisible();
  await expect(page.getByTestId("endless-board")).toBeVisible({ timeout: 60_000 });

  await expect(page.getByTestId("endless-meta")).toContainText(spec!.seed);
  const metaText = await page.getByTestId("endless-meta").innerText();
  const m = metaText.match(/提示数：(\d+)/);
  expect(m).not.toBeNull();
  expect(Number(m![1])).toBe(apiGivens);

  const filledCells = await page
    .locator('[data-testid^="sudoku-cell-"]')
    .filter({ hasText: /^[1-9]$/ })
    .count();
  expect(filledCells).toBe(apiGivens);
});

test("提升 clearedLevel 后全局池含下一关 puzzles[maxCleared+1]（可能触发服务端补缺）", async ({
  request,
}) => {
  test.setTimeout(120_000);

  const { token } = await apiRegisterAndLogin(request);

  const patchRes = await request.patch("/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: { endless: { entry: { clearedLevel: 2 } } },
  });
  expect(patchRes.status()).toBe(204);

  const getRes = await request.get("/api/progress", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(getRes.ok()).toBeTruthy();
  const body = (await getRes.json()) as ProgressBody;

  expect(body.endless.entry.clearedLevel).toBe(2);
  const nextLevel = 3;
  const spec = body.global.entry.puzzles[nextLevel];
  expect(spec, "cleared=2 时第 3 关应在池中就绪").toBeDefined();
  expect(spec!.seed.length).toBeGreaterThan(0);
  expect(countGivensInGrid(spec!.givens)).toBeGreaterThan(10);
  expect(body.global.entry.maxPreparedLevel).toBeGreaterThanOrEqual(nextLevel);
});

test("专家档：getProgress 契约冒烟（不全量断言随机生成）", async ({ request }) => {
  const { token } = await apiRegisterAndLogin(request);
  const res = await request.get("/api/progress", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as ProgressBody;

  const g = body.global.expert;
  expect(typeof g.maxPreparedLevel).toBe("number");
  expect(Number.isInteger(g.maxPreparedLevel)).toBe(true);
  expect(g.maxPreparedLevel).toBeGreaterThanOrEqual(0);
  expect(g.puzzles).toBeTruthy();

  assertGlobalTierMatchesNextLevel("expert", body.endless.expert.clearedLevel, g);
});
