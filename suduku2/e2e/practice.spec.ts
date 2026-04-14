import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = {
  uniqueCandidate: "unique-candidate",
  hiddenSingle: "hidden-single",
} as const;

const MODE_UNIQUE = "practice-endless:unique-candidate";

test("已解锁技巧可进入专项页并显示棋盘", async ({ page, request }) => {
  const { token } = await apiRegisterAndLogin(request);
  await injectAuth(page, token);

  const patchRes = await request.patch("http://127.0.0.1:3003/api/progress", {
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

test("未解锁技巧进入专项页时显示中文拦截提示", async ({ page, request }) => {
  const { token } = await apiRegisterAndLogin(request);
  await injectAuth(page, token);

  const patchRes = await request.patch("http://127.0.0.1:3003/api/progress", {
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
