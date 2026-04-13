import { expect, test } from "@playwright/test";

test.describe("游戏说明", () => {
  test("首页说明入口可见，打开后含核心玩法与计分关键词", async ({ page }) => {
    await page.goto("/");

    const heroTrigger = page.getByTestId("game-instructions-trigger");
    await expect(heroTrigger).toBeVisible();
    await expect(heroTrigger).toHaveText("游戏说明");

    await heroTrigger.click();

    const dialog = page.getByTestId("game-instructions-dialog");
    await expect(dialog).toBeVisible();
    await expect(heroTrigger).toHaveAttribute("aria-expanded", "true");

    await expect(dialog.getByRole("heading", { name: "游戏说明与得分" })).toBeVisible();

    await expect(dialog).toContainText("三消");
    await expect(dialog).toContainText("合法与步数");
    await expect(dialog).toContainText("目标分");
    await expect(dialog).toContainText("剩余步数");
    await expect(dialog).toContainText("检测三消 → 消除 → 下落补位");
    await expect(dialog).toContainText("BASE_SCORE_PER_CELL");
    await expect(dialog).toContainText("CHAIN_BONUS_PER_EXTRA_WAVE");
    await expect(dialog).toContainText("分步展示");
    await expect(dialog).toContainText("连锁呈现");
    await expect(dialog).not.toContainText("MERGE_PAIR_SCORE");
    await expect(dialog).not.toContainText("对碰合并");

    await page.getByTestId("game-instructions-close").click();
    await expect(dialog).toBeHidden();
    await expect(heroTrigger).toHaveAttribute("aria-expanded", "false");
  });

  test("游戏区内说明入口可见且可打开同一类说明", async ({ page }) => {
    await page.goto("/");

    const inlineTrigger = page.getByTestId("game-instructions-trigger-inline");
    await expect(inlineTrigger).toBeVisible();

    await inlineTrigger.click();
    const dialog = page.getByTestId("game-instructions-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("合法与步数");
    await expect(dialog).toContainText("连锁波次");
    await expect(dialog).toContainText("检测三消 → 消除 → 下落补位");
    await expect(dialog).not.toContainText("MERGE_PAIR_SCORE");
  });
});
