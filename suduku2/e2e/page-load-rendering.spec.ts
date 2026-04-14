import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

/** 首屏 DOM 可交互的合理上限（任务约定通常远小于 5s；CI/冷启动略放宽） */
const FIRST_PAINT_MAX_MS = 8000;

function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

test.describe("页面加载与渲染基线（棋盘 / HUD / 无障碍 / reducedMotion）", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("首页与对局入口可达，主地标与 API 示例可见", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      globalThis.localStorage.removeItem("suduku2.auth.token");
    });

    const t0 = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: FIRST_PAINT_MAX_MS });
    expect(Date.now() - t0).toBeLessThan(FIRST_PAINT_MAX_MS);

    await expect(page.locator("#sudoku2-main")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "数独2" }),
    ).toBeVisible();
    await expect(page.getByTestId("api-path-sample")).toContainText("/api/auth/login");

    const t1 = Date.now();
    await page.goto("/game", { waitUntil: "domcontentloaded", timeout: FIRST_PAINT_MAX_MS });
    expect(Date.now() - t1).toBeLessThan(FIRST_PAINT_MAX_MS);

    await expect(page.getByRole("heading", { name: "对局" })).toBeVisible();
    /* GameGate：未登录时引导登录；已登录才渲染子页「无尽模式」入口 */
    await expect(page.getByTestId("game-login-hint")).toBeVisible();
    await expect(page.getByTestId("game-goto-login")).toBeVisible();
    await expect(page.getByRole("link", { name: "返回首页" })).toBeVisible();
  });

  test("无尽入门：81 格棋盘、grid 角色与关卡/难度/计时 HUD", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("auth-tab-register").click();
    await page.getByTestId("auth-username").fill(uniqueUsername());
    await page.getByTestId("auth-password").fill("secret12");
    await page.getByTestId("auth-submit").click();
    await page.waitForURL("http://127.0.0.1:3003/");

    await page.goto("/game/endless/entry", {
      waitUntil: "domcontentloaded",
      timeout: FIRST_PAINT_MAX_MS,
    });

    await expect(page.getByTestId("endless-play-root")).toBeVisible();
    await expect(page.getByTestId("endless-board")).toBeVisible({ timeout: 60_000 });

    const board = page.getByTestId("endless-board");
    await expect(board).toHaveAttribute("role", "grid");
    await expect(board).toHaveAttribute("aria-label", "数独棋盘");

    await expect(page.locator('[data-testid^="sudoku-cell-"]')).toHaveCount(81);

    await expect(page.getByTestId("sudoku-timer-row")).toBeVisible();
    await expect(page.getByTestId("sudoku-timer")).toBeVisible();
    await expect(page.getByTestId("sudoku-timer")).toContainText("秒");

    await expect(page.getByTestId("endless-cleared")).toBeVisible();
    await expect(page.getByTestId("endless-cleared")).toContainText("已通关");
    await expect(page.getByTestId("endless-cleared")).toContainText("关卡");

    await expect(page.getByTestId("endless-meta")).toBeVisible();
    await expect(page.getByTestId("endless-meta")).toContainText("难度分");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("入门");
  });
});
