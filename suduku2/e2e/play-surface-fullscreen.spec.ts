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
      return;
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
      return;
    }

    await expect(toggle).toBeVisible();
    await toggle.focus();
    await expect(toggle).toBeFocused();
  });
});
