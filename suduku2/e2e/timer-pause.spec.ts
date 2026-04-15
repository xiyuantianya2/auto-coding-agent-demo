import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

test("计时器与暂停：开局向上计时、暂停冻结数值与交互、恢复后继续累计", async ({
  page,
  request,
}) => {
  /* 受控时钟：避免真实 sleep 与慢机首轮超时，稳定断言「增长 / 冻结 / 再增长」 */
  await page.clock.install();
  await page.emulateMedia({ reducedMotion: "reduce" });

  const { token } = await apiRegisterAndLogin(request);
  await injectAuth(page, token);

  await request.patch("http://127.0.0.1:3003/api/progress", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      techniques: {
        [TID]: { unlocked: true },
      },
    },
  });

  await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
  await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });
  /** headed + 假时钟下偶发晚于棋盘出现，先钉死可见再读秒 */
  await expect(page.getByTestId("sudoku-timer")).toBeVisible({ timeout: 60_000 });

  const timer = page.getByTestId("sudoku-timer");
  const parseSec = async (): Promise<number> => {
    const t = await timer.innerText();
    const mm = t.match(/(\d+)/);
    return mm ? Number(mm[1]) : 0;
  };

  /* 500ms 刻度 + 开局 effect，推进墙上时间使显示 ≥1 秒，再测暂停 */
  await page.clock.runFor(2500);
  await expect.poll(async () => parseSec()).toBeGreaterThanOrEqual(1);

  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "true");

  const frozen = await parseSec();
  expect(frozen).toBeGreaterThanOrEqual(1);

  await expect(page.getByTestId("digit-pad-5")).toBeDisabled();
  await expect(page.getByTestId("sudoku-mode-fill")).toBeDisabled();
  await expect(page.getByTestId("sudoku-hint")).toBeDisabled();

  await expect(async () => {
    const n = await page.locator('button[data-testid^="sudoku-cell-"]:not([disabled])').count();
    expect(n).toBe(0);
  }).toPass({ timeout: 5_000 });

  await page.clock.runFor(5000);
  expect(await parseSec()).toBe(frozen);

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "false");

  await expect(page.getByTestId("digit-pad-5")).toBeEnabled();

  await page.clock.runFor(2000);
  expect(await parseSec()).toBeGreaterThan(frozen);
});
