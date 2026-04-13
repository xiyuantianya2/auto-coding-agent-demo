import { expect, test } from "@playwright/test";

test.describe("游戏控制与 HUD", () => {
  test("第 1 关显示与 level-progression 前期表一致；暂停时格子不可点；连点提示出现冷却", async ({
    page,
  }) => {
    await page.goto("/");

    const hud = page.getByLabel("游戏信息");
    await expect(hud.getByText("200")).toBeVisible();
    await expect(hud.getByText("22")).toBeVisible();
    await expect(page.locator("text=第 1 关").first()).toBeVisible();

    const pause = page.getByTestId("ddp-pause-toggle");
    await expect(pause).toHaveText("暂停");
    await pause.click();
    await expect(pause).toHaveText("继续");
    await expect(page.getByText("已暂停").first()).toBeVisible();

    const piece = page.getByRole("button", { name: /^棋子/ }).first();
    await expect(piece).toBeDisabled();

    await pause.click();
    await expect(piece).toBeEnabled();

    const hint = page.getByTestId("ddp-hint-button");
    await hint.click();
    await hint.click();
    await expect(page.getByRole("status")).toContainText("提示冷却");
  });
});
