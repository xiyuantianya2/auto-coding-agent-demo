import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

async function unlockPractice(request: import("@playwright/test").APIRequestContext, token: string) {
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
}

test.describe("SudokuPlaySurface 响应式版面（棋盘放大、无横向溢出）", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("手机竖屏：棋盘较改版前上限更宽，且页面无横向滚动条", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const { token } = await apiRegisterAndLogin(request);
    await unlockPractice(request, token);
    await injectAuth(page, token);

    await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
    await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

    const metrics = await page.evaluate(() => {
      const el = document.documentElement;
      const board = document.querySelector('[data-testid="practice-board"]');
      const br = board?.getBoundingClientRect();
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        boardWidth: br?.width ?? 0,
        innerWidth: window.innerWidth,
      };
    });

    expect(metrics.scrollWidth, "横向不出现溢出滚动（scrollWidth≈clientWidth）").toBeLessThanOrEqual(
      metrics.clientWidth + 2,
    );
    /* 父级含左右 padding，棋盘约等于内容区宽度；应占视口绝大部分且不窄于旧版 min(92vw,420) 的典型比例 */
    expect(metrics.boardWidth / metrics.innerWidth).toBeGreaterThan(0.875);
    expect(metrics.boardWidth).toBeLessThanOrEqual(metrics.innerWidth + 1);
  });

  test("较宽手机竖屏：棋盘可接近新上限（> 旧 420px 顶）", async ({ page, request }) => {
    /* 内容区 ≈ vw − 左右 padding，需足够宽才能超过旧 max-w 420px */
    await page.setViewportSize({ width: 480, height: 960 });

    const { token } = await apiRegisterAndLogin(request);
    await unlockPractice(request, token);
    await injectAuth(page, token);

    await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
    await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

    const boardWidth = await page.evaluate(() => {
      const board = document.querySelector('[data-testid="practice-board"]');
      return board?.getBoundingClientRect().width ?? 0;
    });

    expect(boardWidth).toBeGreaterThan(420);
  });

  test("手机横屏：棋盘与侧栏区域无横向溢出", async ({ page, request }) => {
    await page.setViewportSize({ width: 844, height: 390 });

    const { token } = await apiRegisterAndLogin(request);
    await unlockPractice(request, token);
    await injectAuth(page, token);

    await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
    await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("桌面横屏：棋盘与侧栏不重叠且无横向溢出", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 720 });

    const { token } = await apiRegisterAndLogin(request);
    await unlockPractice(request, token);
    await injectAuth(page, token);

    await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
    await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

    const layout = await page.evaluate(() => {
      const board = document.querySelector('[data-testid="practice-board"]');
      const modeFill = document.querySelector('[data-testid="sudoku-mode-fill"]');
      if (!board || !modeFill) {
        return { ok: false as const, reason: "missing nodes" };
      }
      const a = board.getBoundingClientRect();
      const b = modeFill.getBoundingClientRect();
      /* md 横屏为左右分栏：侧栏控件应在棋盘右侧，留间隙 */
      const sideBySideOk = b.left >= a.right - 2;
      return { ok: sideBySideOk as boolean, boardRight: a.right, modeLeft: b.left, boardWidth: a.width };
    });

    expect(layout.ok, "棋盘与侧栏在横屏下应左右排列不重叠").toBe(true);
    if ("boardWidth" in layout && typeof layout.boardWidth === "number") {
      /* 横屏 720p 下受 calc(100dvh−…) 约束，棋盘仍明显大于旧版 420 顶且与侧栏分栏 */
      expect(layout.boardWidth).toBeGreaterThan(400);
    }

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
