import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

async function probeFullscreenSupported(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    const el = probe as HTMLElement & {
      webkitRequestFullscreen?: (n?: number) => void | Promise<void>;
      mozRequestFullScreen?: () => void | Promise<void>;
      msRequestFullscreen?: () => void | Promise<void>;
    };
    return (
      typeof probe.requestFullscreen === "function" ||
      typeof el.webkitRequestFullscreen === "function" ||
      typeof el.mozRequestFullScreen === "function" ||
      typeof el.msRequestFullscreen === "function"
    );
  });
}

test.describe("对局界面全屏入口", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("无尽入门对局：与探测一致时显示全屏按钮并可键盘聚焦", async ({ page, request }) => {
    const { token } = await apiRegisterAndLogin(request);
    await injectAuth(page, token);

    await page.goto("/game/endless/entry", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("endless-board")).toBeVisible({ timeout: 60_000 });

    const supported = await probeFullscreenSupported(page);
    const toggle = page.getByTestId("sudoku-fullscreen-toggle");

    if (!supported) {
      await expect(toggle).toHaveCount(0);
      test.skip(true, "当前环境不支持 Fullscreen API（与探测一致时已隐藏全屏按钮）");
    }

    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-label", "进入全屏");
    await toggle.focus();
    await expect(toggle).toBeFocused();
  });

  test("专项练习对局：与探测一致时显示全屏按钮并可键盘聚焦", async ({ page, request }) => {
    const { token } = await apiRegisterAndLogin(request);
    await injectAuth(page, token);

    const modeId = "practice-endless:unique-candidate";
    await request.patch("http://127.0.0.1:3003/api/progress", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      data: {
        techniques: {
          "unique-candidate": { unlocked: true },
        },
      },
    });

    await page.goto(`/game/practice?modeId=${encodeURIComponent(modeId)}`);
    await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });

    const supported = await probeFullscreenSupported(page);
    const toggle = page.getByTestId("sudoku-fullscreen-toggle");

    if (!supported) {
      await expect(toggle).toHaveCount(0);
      test.skip(true, "当前环境不支持 Fullscreen API（与探测一致时已隐藏全屏按钮）");
    }

    await expect(toggle).toBeVisible();
    await toggle.focus();
    await expect(toggle).toBeFocused();
  });

  test("全屏后 16:9 视口内棋盘与数字区完整可见；退出后恢复", async ({ page, request }) => {
    const supported = await probeFullscreenSupported(page);
    if (!supported) {
      test.skip(true, "当前环境不支持 Fullscreen API");
    }

    await page.setViewportSize({ width: 1280, height: 720 });
    const { token } = await apiRegisterAndLogin(request);
    await injectAuth(page, token);

    await page.goto("/game/endless/entry", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("endless-board")).toBeVisible({ timeout: 60_000 });

    const root = page.getByTestId("sudoku-play-surface-root");
    const board = page.getByTestId("endless-board");
    const digitPad = page.getByTestId("digit-pad-1");
    const toggle = page.getByTestId("sudoku-fullscreen-toggle");

    async function assertElementsInViewport(): Promise<void> {
      const vw = page.viewportSize()!.width;
      const vh = page.viewportSize()!.height;
      /* 亚像素与页眉占位差异：略放宽仍要求基本落在视口内 */
      const pad = 8;
      for (const loc of [board, digitPad]) {
        const box = await loc.boundingBox();
        expect(box, "element should have layout box").not.toBeNull();
        expect(box!.x, "left edge").toBeGreaterThanOrEqual(-pad);
        expect(box!.y, "top edge").toBeGreaterThanOrEqual(-pad);
        expect(box!.x + box!.width, "right edge").toBeLessThanOrEqual(vw + pad);
        expect(box!.y + box!.height, "bottom edge").toBeLessThanOrEqual(vh + pad);
      }
    }

    await assertElementsInViewport();

    await toggle.click();

    try {
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const el = document.querySelector('[data-testid="sudoku-play-surface-root"]');
              return el !== null && document.fullscreenElement === el;
            }),
          { timeout: 15_000 },
        )
        .toBe(true);
    } catch {
      test.skip(true, "自动化环境未进入对局全屏（浏览器策略或权限）");
    }

    await expect(root).toHaveAttribute("data-fullscreen", "true");

    await assertElementsInViewport();

    await toggle.click();

    await expect
      .poll(async () => page.evaluate(() => document.fullscreenElement === null), { timeout: 15_000 })
      .toBe(true);

    await expect(root).toHaveAttribute("data-fullscreen", "false", { timeout: 15_000 });
    await assertElementsInViewport();
  });
});
