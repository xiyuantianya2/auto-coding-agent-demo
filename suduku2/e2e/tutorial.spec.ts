import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 与 `@/lib/solver/technique-ids` 对齐，E2E 中避免额外模块解析配置 */
const TID = {
  uniqueCandidate: "unique-candidate",
  hiddenSingle: "hidden-single",
} as const;

test("未登录访问教学页时显示登录提示", async ({ page }) => {
  await page.goto("/tutorial");
  await expect(page.getByTestId("tutorial-curriculum-root")).toBeVisible();
  await expect(page.getByTestId("tutorial-login-hint")).toBeVisible();
  await expect(page.getByTestId(`tutorial-unlock-status-${TID.uniqueCandidate}`)).toContainText(
    "需登录",
  );
});

test("已登录时教学列表与解锁态与进度一致", async ({ page }) => {
  const username = uniqueUsername();
  const password = "secret12";

  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://127.0.0.1:3003/");

  const token = await page.evaluate(() =>
    globalThis.localStorage.getItem("suduku2.auth.token"),
  );
  expect(token).toBeTruthy();

  const patchRes = await page.request.patch("http://127.0.0.1:3003/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      techniques: {
        [TID.uniqueCandidate]: { unlocked: true },
        [TID.hiddenSingle]: { unlocked: false },
      },
    },
  });
  expect(patchRes.status()).toBe(204);

  await page.goto("/tutorial");
  await expect(page.getByTestId("tutorial-curriculum-root")).toBeVisible();
  await expect(page.getByTestId("tutorial-login-hint")).toHaveCount(0);

  await expect(page.getByTestId(`tutorial-unlock-status-${TID.uniqueCandidate}`)).toContainText(
    "已解锁",
    { timeout: 15_000 },
  );
  await expect(page.getByTestId(`tutorial-unlock-status-${TID.hiddenSingle}`)).toContainText(
    "未解锁",
  );

  await expect(page.getByTestId(`tutorial-technique-${TID.uniqueCandidate}`)).toContainText(
    "唯一候选（裸单）",
  );
  await expect(page.getByTestId(`tutorial-practice-link-${TID.uniqueCandidate}`)).toBeVisible();
});
