import type { APIRequestContext, Page } from "@playwright/test";

export function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 通过 API 注册并登录，跳过 UI 表单交互和额外的页面导航，大幅减少每个测试的前置耗时。
 * 返回的 token 可配合 {@link injectAuth} 注入 localStorage。
 */
export async function apiRegisterAndLogin(
  request: APIRequestContext,
): Promise<{ username: string; token: string }> {
  const username = uniqueUsername();
  const password = "secret12";

  const regRes = await request.post("/api/auth/register", {
    data: { username, password },
  });
  if (!regRes.ok()) {
    throw new Error(`Registration failed: ${regRes.status()} ${await regRes.text()}`);
  }

  const loginRes = await request.post("/api/auth/login", {
    data: { username, password },
  });
  if (!loginRes.ok()) {
    throw new Error(`Login failed: ${loginRes.status()} ${await loginRes.text()}`);
  }
  const { token } = (await loginRes.json()) as { token: string };

  return { username, token };
}

/**
 * 在页面首次导航前注入 auth token 到 localStorage，
 * 使后续 page.goto() 时 React 应用立即识别为已登录状态。
 * 必须在第一次 page.goto() **之前**调用。
 */
export async function injectAuth(page: Page, token: string): Promise<void> {
  await page.addInitScript((t: string) => {
    window.localStorage.setItem("suduku2.auth.token", t);
  }, token);
}
