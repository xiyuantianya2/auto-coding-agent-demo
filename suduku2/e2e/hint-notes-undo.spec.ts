import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

/** 专项页拉题可能偶发超时，出现「重试」时点击直至棋盘就绪 */
async function gotoPracticeWithBoard(page: import("@playwright/test").Page, modeId: string): Promise<void> {
  await page.goto(`/game/practice?modeId=${encodeURIComponent(modeId)}`);
  await expect(page.getByTestId("practice-play-root")).toBeVisible({ timeout: 60_000 });

  const board = page.getByTestId("practice-board");
  const retryBtn = page.getByTestId("practice-retry");

  await expect(async () => {
    if (await board.isVisible()) {
      return;
    }
    if (await retryBtn.isVisible()) {
      await retryBtn.click();
    }
    expect(await board.isVisible()).toBe(true);
  }).toPass({ timeout: 120_000 });
}

/** 通过计算样式判断笔记点是否处于「强调」态，避免断言 Tailwind 类名字符串 */
async function noteMarkerEmphasis(
  page: import("@playwright/test").Page,
  testId: string,
): Promise<number> {
  return page.evaluate((id: string) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    if (!el) {
      return -1;
    }
    return parseFloat(getComputedStyle(el).opacity);
  }, testId);
}

/** 读取格内「主填数」；空格候选点阵的 textContent 会包含 1–9，不能与填数混用 */
async function readFilledDigit(
  page: import("@playwright/test").Page,
  cellTestId: string,
): Promise<string> {
  return page.evaluate((id: string) => {
    const btn = document.querySelector(`[data-testid="${id}"]`);
    const first = btn?.querySelector(":scope > span");
    if (!first) {
      return "";
    }
    /* 空格为 9 个小笔记者；填数格为单文本 span */
    if (first.querySelectorAll(":scope > span").length === 9) {
      return "";
    }
    return (first.textContent ?? "").trim();
  }, cellTestId);
}


test("提示：请求后出现 data-hint-cell / data-hint-candidate 或提示条（DOM 可读）", async ({
  page,
  request,
}) => {
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

  await gotoPracticeWithBoard(page, MODE);

  await page.getByTestId("sudoku-hint").click();
  await expect(page.getByTestId("sudoku-hint-banner")).toBeVisible({ timeout: 8_000 });

  const hintDom = await page.evaluate(() => {
    const cells = document.querySelectorAll('[data-hint-cell="true"]');
    const cands = document.querySelectorAll('[data-hint-candidate="true"]');
    return { hintCellCount: cells.length, hintCandCount: cands.length };
  });
  expect(hintDom.hintCellCount + hintDom.hintCandCount).toBeGreaterThan(0);
});

test("笔记模式：可切换、打点可读；撤销/重做与按钮 disabled 一致", async ({ page, request }) => {
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

  await gotoPracticeWithBoard(page, MODE);

  await page.getByTestId("sudoku-mode-notes").click();
  await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "true");

  /* 填数→笔记 的 setMode 会写入撤销栈，与「仅选中格不入栈」不同：此时应可撤销模式切换，重做仍不可用 */
  await expect(page.getByTestId("sudoku-undo")).toBeEnabled();
  await expect(page.getByTestId("sudoku-redo")).toBeDisabled();

  const emptyPlayerCell = page
    .locator('button[data-testid^="sudoku-cell-"]:not([disabled])')
    .first();
  await emptyPlayerCell.click();

  await page.getByTestId("digit-pad-3").click();

  const firstCellTestId = await emptyPlayerCell.getAttribute("data-testid");
  expect(firstCellTestId).toMatch(/^sudoku-cell-(\d+)-(\d+)$/);
  const m = firstCellTestId!.match(/^sudoku-cell-(\d+)-(\d+)$/);
  expect(m).not.toBeNull();
  const mr = m![1];
  const mc = m![2];
  const markerId = `sudoku-note-marker-${mr}-${mc}-3`;

  const onOpacity = await noteMarkerEmphasis(page, markerId);
  expect(onOpacity).toBeGreaterThan(0.55);

  await expect(page.getByTestId("sudoku-undo")).toBeEnabled();
  await expect(page.getByTestId("sudoku-redo")).toBeDisabled();

  await page.getByTestId("sudoku-undo").click();
  const offOpacity = await noteMarkerEmphasis(page, markerId);
  expect(offOpacity).toBeLessThan(0.55);

  await expect(page.getByTestId("sudoku-redo")).toBeEnabled();
  await page.getByTestId("sudoku-redo").click();
  const again = await noteMarkerEmphasis(page, markerId);
  expect(again).toBeGreaterThan(0.55);
});

test("填数模式：填一格后撤销清空、重做恢复（与 canUndo/canRedo 按钮态一致）", async ({
  page,
  request,
}) => {
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

  await gotoPracticeWithBoard(page, MODE);

  await page.getByTestId("sudoku-mode-fill").click();
  await expect(page.getByTestId("sudoku-mode-fill")).toHaveAttribute("aria-pressed", "true");

  const cell = page.locator('button[data-testid^="sudoku-cell-"]:not([disabled])').first();
  await cell.click();
  const tid = await cell.getAttribute("data-testid");
  expect(tid).toMatch(/^sudoku-cell-\d+-\d+$/);

  await expect(page.getByTestId("sudoku-undo")).toBeDisabled();

  let placed = "";
  for (let d = 1; d <= 9; d++) {
    await page.getByTestId(`digit-pad-${d}`).click();
    placed = await readFilledDigit(page, tid!);
    if (placed !== "") {
      break;
    }
  }
  expect(placed).not.toBe("");

  await expect(page.getByTestId("sudoku-undo")).toBeEnabled();

  await page.getByTestId("sudoku-undo").click();

  await expect.poll(async () => readFilledDigit(page, tid!)).toBe("");

  await expect(page.getByTestId("sudoku-redo")).toBeEnabled();
  await page.getByTestId("sudoku-redo").click();

  await expect.poll(async () => readFilledDigit(page, tid!)).toBe(placed);
});
