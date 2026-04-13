import { test, expect } from "@playwright/test";

test.describe("Suduku core model (page smoke)", () => {
  test("loads home and renders a 9×9 board from GameState", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "数独" })).toBeVisible();

    const board = page.getByTestId("suduku-board");
    await expect(board).toBeVisible();

    const cells = page.locator('[data-testid^="suduku-cell-"]');
    await expect(cells).toHaveCount(81);

    await expect(page.getByTestId("suduku-cell-0-0")).toHaveText("5");
    await expect(page.getByTestId("suduku-cell-1-1")).toHaveText("6");
    await expect(page.getByTestId("suduku-cell-2-2")).toHaveText("7");

    await expect(page.getByTestId("suduku-cell-0-0")).toHaveAttribute(
      "data-cell-kind",
      "given",
    );
    await expect(page.getByTestId("suduku-cell-0-1")).toHaveAttribute(
      "data-cell-kind",
      "playable",
    );
  });

  test("isValidPlacement smoke via embedded dataset", async ({ page }) => {
    await page.goto("/");
    const el = page.getByTestId("core-placement-e2e");
    await expect(el).toHaveAttribute("data-placement-row", "false");
    await expect(el).toHaveAttribute("data-placement-col", "false");
    await expect(el).toHaveAttribute("data-placement-box", "false");
    await expect(el).toHaveAttribute("data-placement-ok", "true");
  });
});
