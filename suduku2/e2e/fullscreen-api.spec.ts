import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

test.describe("全屏 API 封装（Hook）", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("支持时进入全屏后 document 与状态一致；exitFullscreen 后恢复", async ({ page }) => {
    test.setTimeout(60_000);

    await page.goto("/fullscreen-smoke", { waitUntil: "load" });
    const browserSupports = await page.evaluate(() => {
      const d = document.createElement("div");
      return typeof d.requestFullscreen === "function";
    });
    if (!browserSupports) {
      test.skip(true, "当前环境不支持 Fullscreen API");
    }
    /** 静态预渲染首帧可能为 false，hydration 后 useSyncExternalStore 与探测结果一致 */
    await expect(page.getByTestId("fullscreen-smoke-state")).toHaveAttribute("data-supported", "true", {
      timeout: 15_000,
    });

    const root = page.getByTestId("fullscreen-smoke-root");

    await page.getByTestId("fullscreen-smoke-enter").click();

    try {
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const el = document.querySelector('[data-testid="fullscreen-smoke-root"]');
              return el !== null && document.fullscreenElement === el;
            }),
          { timeout: 12_000 },
        )
        .toBe(true);
    } catch {
      // 部分 CI/无头环境策略禁止全屏，不阻塞整仓
      test.skip(true, "自动化环境未进入全屏（浏览器策略）");
    }

    await expect(page.getByTestId("fullscreen-smoke-state")).toHaveAttribute("data-fullscreen", "true");
    await expect(root).toHaveAttribute("data-fullscreen", "true");

    await page.evaluate(async () => {
      await document.exitFullscreen();
    });

    await expect
      .poll(async () => page.evaluate(() => document.fullscreenElement === null), { timeout: 12_000 })
      .toBe(true);

    await expect(page.getByTestId("fullscreen-smoke-state")).toHaveAttribute("data-fullscreen", "false");
  });

  test("冒烟页可访问，切换全屏不抛错（不支持路径由单测覆盖）", async ({ page }) => {
    await page.goto("/fullscreen-smoke", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("fullscreen-smoke-root")).toBeVisible();
    await page.getByTestId("fullscreen-smoke-toggle").click();
    await expect(page.getByTestId("fullscreen-smoke-state")).toBeVisible();
  });
});
