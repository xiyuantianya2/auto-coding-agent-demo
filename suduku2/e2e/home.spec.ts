import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

test("首页可达，标题与主内容区可见", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "数独2" }),
  ).toBeVisible();
  await expect(page.locator("#sudoku2-main")).toBeVisible();
  await expect(page.getByTestId("api-path-sample")).toContainText(
    "/api/auth/login",
  );
});
