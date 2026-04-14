import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 与仓库 Playwright 规范对齐的数独场景回归（串行降低 next dev 并发压力）。
 * 其它 spec 已覆盖细分路径；此处补充防抖草稿、专家档冒烟与多步导航。
 */
test.describe.serial("client-ui 集成回归", () => {
  test("草稿防抖：落子后未点「保存草稿」，服务端仍收到 PATCH 草稿", async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const username = uniqueUsername();
    const password = "secret12";

    await page.goto("/login");
    await page.getByTestId("auth-tab-register").click();
    await page.getByTestId("auth-username").fill(username);
    await page.getByTestId("auth-password").fill(password);
    await page.getByTestId("auth-submit").click();
    await page.waitForURL("http://127.0.0.1:3003/");

    const token = await page.evaluate(() => globalThis.localStorage.getItem("suduku2.auth.token"));
    expect(token).toBeTruthy();

    await page.goto("/game/endless/entry");
    await expect(page.getByTestId("endless-board")).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("sudoku-mode-notes").click();
    const empty = page
      .locator('[data-testid="endless-board"] button[data-testid^="sudoku-cell-"]:not([disabled])')
      .first();
    await empty.click();
    await page.getByTestId("digit-pad-7").click();

    await page.waitForTimeout(2500);

    const res = await request.get("http://127.0.0.1:3003/api/progress", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      draft?: { cells?: Array<Array<{ notes?: number[] }>> };
    };
    expect(body.draft?.cells?.length).toBe(9);
    let foundNote = false;
    const cells = body.draft?.cells;
    if (cells) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (cells[r]?.[c]?.notes?.includes(7)) {
            foundNote = true;
            break;
          }
        }
      }
    }
    expect(foundNote).toBe(true);
  });

  test("专家档无尽：题库未就绪或棋盘可见（结构冒烟）", async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });

    const username = uniqueUsername();
    await page.goto("/login");
    await page.getByTestId("auth-tab-register").click();
    await page.getByTestId("auth-username").fill(username);
    await page.getByTestId("auth-password").fill("secret12");
    await page.getByTestId("auth-submit").click();
    await page.waitForURL("http://127.0.0.1:3003/");

    await page.goto("/game/endless/expert");
    await expect(page.getByTestId("endless-play-root")).toBeVisible({ timeout: 60_000 });

    const board = page.getByTestId("endless-board");
    const poolWait = page.getByTestId("endless-pool-wait");

    await expect(async () => {
      const b = await board.isVisible();
      const w = await poolWait.isVisible();
      expect(b || w).toBe(true);
    }).toPass({ timeout: 90_000 });
  });

  test("多步导航：登录 → 无尽入门 → 返回选档 → 首页仍显示已登录", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    const username = uniqueUsername();
    await page.goto("/login");
    await page.getByTestId("auth-tab-register").click();
    await page.getByTestId("auth-username").fill(username);
    await page.getByTestId("auth-password").fill("secret12");
    await page.getByTestId("auth-submit").click();
    await page.waitForURL("http://127.0.0.1:3003/");

    await page.goto("/game/endless/entry");
    await expect(page.getByTestId("endless-board")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("endless-back").click();
    await expect(page).toHaveURL(/\/game\/endless$/);

    await page.goto("/");
    await expect(page.getByTestId("session-status")).toContainText("已登录");
  });
});
