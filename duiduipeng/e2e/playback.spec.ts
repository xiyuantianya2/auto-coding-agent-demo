import { expect, test } from "@playwright/test";

/** 与 `SwapPlayground` 默认棋盘 `mulberry32(2026)` 上 `findFirstValidSwap` 一致 */
const DEFAULT_SEED_FIRST_SWAP_NAMES = ["棋子 1,5", "棋子 2,5"] as const;

test.describe("连锁播放与 data 属性", () => {
  test("有效交换后可见播放中状态，跳过动画后与完整结算一致", async ({ page }) => {
    await page.goto("/");

    const board = page.locator("[data-ddp-playback]").first();
    await expect(board).toHaveAttribute("data-ddp-playback", "false");

    await page.getByRole("button", { name: DEFAULT_SEED_FIRST_SWAP_NAMES[0] }).click();
    await page.getByRole("button", { name: DEFAULT_SEED_FIRST_SWAP_NAMES[1] }).click();

    await expect(board).toHaveAttribute("data-ddp-playback", "true", { timeout: 15_000 });
    await expect(board).toHaveAttribute("data-ddp-playback-pending-score", "true");

    const scorePanel = page.locator("[data-ddp-score-panel]");
    const scoreBeforeSkip = await scorePanel.locator(".tabular-nums").first().innerText();

    await page.getByTestId("ddp-skip-playback").click();

    await expect(board).toHaveAttribute("data-ddp-playback", "false", { timeout: 10_000 });
    await expect(board).toHaveAttribute("data-ddp-playback-pending-score", "false");

    const scoreAfter = await scorePanel.locator(".tabular-nums").first().innerText();
    expect(Number.parseInt(scoreAfter, 10)).toBeGreaterThan(Number.parseInt(scoreBeforeSkip, 10));
  });

  test("减弱动效：跳过按钮禁用且交换后快速进入终局结算", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const skip = page.getByTestId("ddp-skip-playback");
    await expect(skip).toBeDisabled();

    const board = page.locator("[data-ddp-playback]").first();
    await page.getByRole("button", { name: DEFAULT_SEED_FIRST_SWAP_NAMES[0] }).click();
    await page.getByRole("button", { name: DEFAULT_SEED_FIRST_SWAP_NAMES[1] }).click();

    await expect(board).toHaveAttribute("data-ddp-playback", "false", { timeout: 10_000 });

    const scoreText = await page
      .locator("[data-ddp-score-panel]")
      .locator(".tabular-nums")
      .first()
      .innerText();
    expect(Number.parseInt(scoreText, 10)).toBeGreaterThan(0);
  });
});
