import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

test("注册成功后可从首页看到已登录状态", async ({ page }) => {
  const username = uniqueUsername();
  const password = "secret12";

  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();

  await page.waitForURL("http://127.0.0.1:3003/");
  await expect(page.getByTestId("session-status")).toContainText("已登录");

  const token = await page.evaluate(() =>
    globalThis.localStorage.getItem("suduku2.auth.token"),
  );
  expect(token).toBeTruthy();
  expect(token!.length).toBeGreaterThan(10);
});

test("登录成功：已存在用户可登录", async ({ page }) => {
  const username = uniqueUsername();
  const password = "secret12";

  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://127.0.0.1:3003/");

  await page.getByTestId("logout-button").click();
  await expect(page.getByTestId("session-status")).toContainText("未登录");

  await page.goto("/login");
  await page.getByTestId("auth-tab-login").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();

  await page.waitForURL("http://127.0.0.1:3003/");
  await expect(page.getByTestId("session-status")).toContainText("已登录");
});

test("错误密码时显示中文提示", async ({ page }) => {
  const username = uniqueUsername();
  const password = "secret12";

  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://127.0.0.1:3003/");

  await page.goto("/login");
  await page.getByTestId("auth-tab-login").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill("wrongpw");
  await page.getByTestId("auth-submit").click();

  await expect(page.getByTestId("auth-feedback")).toContainText("用户名或密码不正确");
});

test("重复用户名注册时显示中文提示", async ({ page }) => {
  const username = uniqueUsername();
  const password = "secret12";

  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://127.0.0.1:3003/");

  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(username);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();

  await expect(page.getByTestId("auth-feedback")).toContainText("已被注册");
});

test("网络错误时显示中文提示", async ({ page }) => {
  await page.route("**/api/auth/login", (route) => route.abort("failed"));

  await page.goto("/login");
  await page.getByTestId("auth-tab-login").click();
  await page.getByTestId("auth-username").fill(uniqueUsername());
  await page.getByTestId("auth-password").fill("secret12");
  await page.getByTestId("auth-submit").click();

  await expect(page.getByTestId("auth-feedback")).toContainText("网络连接失败");
});
