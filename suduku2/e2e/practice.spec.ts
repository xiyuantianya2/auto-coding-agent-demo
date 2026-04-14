import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const TID = {
  uniqueCandidate: "unique-candidate",
  hiddenSingle: "hidden-single",
} as const;

const MODE_UNIQUE = "practice-endless:unique-candidate";

test("已解锁技巧可进入专项页并显示棋盘", async ({ page }) => {
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

  const patchRes = await page.request.patch("http://127.0.0.1:3003/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      techniques: {
        [TID.uniqueCandidate]: { unlocked: true },
      },
    },
  });
  expect(patchRes.status()).toBe(204);

  await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE_UNIQUE)}`);
  await expect(page.getByTestId("practice-play-root")).toBeVisible();
  await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });
});

test("未解锁技巧进入专项页时显示中文拦截提示", async ({ page }) => {
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

  const patchRes = await page.request.patch("http://127.0.0.1:3003/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      techniques: {
        [TID.uniqueCandidate]: { unlocked: false },
        [TID.hiddenSingle]: { unlocked: true },
      },
    },
  });
  expect(patchRes.status()).toBe(204);

  await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE_UNIQUE)}`);
  await expect(page.getByTestId("practice-locked-root")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("practice-locked-gate")).toBeVisible();
  await expect(page.getByTestId("practice-locked-gate")).toContainText("尚未解锁");
});
