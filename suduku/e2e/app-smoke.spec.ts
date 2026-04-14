/**
 * 最小冒烟：首页可加载、主标题可见（核心模块类型任务阶段无完整棋盘 UI）。
 * 完整 10 类玩法场景待 client-ui / integration-qa 模块补齐。
 */
import { test, expect } from "@playwright/test";

test.describe("suduku app smoke", () => {
  test("home page loads with title", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "数独", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("suduku", { exact: true })).toBeVisible();
  });
});
