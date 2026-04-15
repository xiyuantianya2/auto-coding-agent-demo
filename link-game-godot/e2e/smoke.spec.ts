import { test, expect } from "@playwright/test";

test("静态占位页可加载（npm dev + Playwright 基线）", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("link-game-godot-root")).toBeVisible();
  await expect(page.getByRole("heading", { name: "连连看-godot" })).toBeVisible();
});
