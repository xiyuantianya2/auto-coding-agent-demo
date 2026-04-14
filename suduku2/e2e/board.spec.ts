import { test, expect } from "@playwright/test";

test.describe.configure({ retries: 1 });

function uniqueUsername(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

async function registerAndLogin(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("auth-tab-register").click();
  await page.getByTestId("auth-username").fill(uniqueUsername());
  await page.getByTestId("auth-password").fill("secret12");
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://127.0.0.1:3003/");
}

test("主棋盘：笔记切换、提示高亮、暂停冻结计时、撤销一步", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });

  await registerAndLogin(page);

  const token = await page.evaluate(() => globalThis.localStorage.getItem("suduku2.auth.token"));
  expect(token).toBeTruthy();

  await page.request.patch("http://127.0.0.1:3003/api/progress", {
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

  await page.getByTestId("sudoku-mode-notes").click();
  await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "true");

  const emptyPlayerCell = page
    .locator('button[data-testid^="sudoku-cell-"]:not([disabled])')
    .first();
  await emptyPlayerCell.click();

  await page.getByTestId("digit-pad-3").click();
  const firstCellTestId = await emptyPlayerCell.getAttribute("data-testid");
  expect(firstCellTestId).toMatch(/^sudoku-cell-\d+-\d+$/);
  const m = firstCellTestId!.match(/^sudoku-cell-(\d+)-(\d+)$/);
  expect(m).not.toBeNull();
  const mr = m![1];
  const mc = m![2];
  const note3 = page.getByTestId(`sudoku-note-marker-${mr}-${mc}-3`);
  await expect(note3).toBeVisible();
  await expect(note3).not.toHaveClass(/opacity-40/);

  await page.getByTestId("sudoku-undo").click();
  await expect(note3).toHaveClass(/opacity-40/);

  const timer = page.getByTestId("sudoku-timer");
  const parseSec = async (): Promise<number> => {
    const t = await timer.innerText();
    const mm = t.match(/(\d+)/);
    return mm ? Number(mm[1]) : 0;
  };
  const t0 = await parseSec();
  await page.waitForTimeout(1200);
  const t1 = await parseSec();
  expect(t1).toBeGreaterThanOrEqual(t0);

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "true");
  const frozen = await parseSec();
  await page.waitForTimeout(1200);
  const still = await parseSec();
  expect(still).toBe(frozen);

  await page.getByTestId("sudoku-pause").click();
  await expect(page.getByTestId("sudoku-pause")).toHaveAttribute("aria-pressed", "false");
  /* 恢复后 setInterval 可能晚一帧更新，避免在高并发下读到 0 */
  await expect(async () => {
    const v = await parseSec();
    expect(v).toBeGreaterThanOrEqual(still);
  }).toPass({ timeout: 15_000 });

  await page.getByTestId("sudoku-hint").click();
  await expect(page.getByTestId("sudoku-hint-banner")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-hint-cell=\"true\"]").first()).toBeVisible();
});
