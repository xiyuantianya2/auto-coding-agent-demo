import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, uniqueUsername } from "./helpers";

test.describe.configure({ retries: 1 });

/** 与任务约定一致：单次 HTTP 调用应在合理时间内完成（通常 < 5s） */
const HTTP_ROUND_TRIP_MAX_MS = 5000;

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

test("未携带 token 时 GET /api/progress 返回 401（受保护资源）", async ({ request }) => {
  const res = await request.get("/api/progress");
  expect(res.status()).toBe(401);
  const body = (await res.json()) as { error?: { code?: string } };
  expect(body.error?.code).toBe("UNAUTHORIZED");
});

test("saveProgress / getProgress：PATCH 合并后 GET 反映 endless 与 techniques，且单次往返 < 5s", async ({
  request,
}) => {
  const { token } = await apiRegisterAndLogin(request);

  const patchStarted = Date.now();
  const patchRes = await request.patch("/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      endless: { entry: { clearedLevel: 4 } },
      techniques: { "unique-candidate": { unlocked: true } },
    },
  });
  expect(patchRes.status()).toBe(204);
  expect(Date.now() - patchStarted).toBeLessThan(HTTP_ROUND_TRIP_MAX_MS);

  const getStarted = Date.now();
  const getRes = await request.get("/api/progress", {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(getRes.ok()).toBe(true);
  expect(Date.now() - getStarted).toBeLessThan(HTTP_ROUND_TRIP_MAX_MS);

  const body = (await getRes.json()) as {
    endless: { entry: { clearedLevel: number } };
    techniques: Record<string, { unlocked?: boolean } | undefined>;
    global: unknown;
  };
  expect(body.endless.entry.clearedLevel).toBe(4);
  expect(body.techniques["unique-candidate"]?.unlocked).toBe(true);
  expect(body.global).toBeDefined();
});

test("未登录访问 /game 显示受保护引导（可与首页「去登录」衔接）", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.removeItem("suduku2.auth.token");
  });
  await page.goto("/game");
  await expect(page.getByTestId("game-login-hint")).toBeVisible();
  await expect(page.getByTestId("game-goto-login")).toBeVisible();
});
