import { test, expect } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const TID = "unique-candidate";
const MODE = "practice-endless:unique-candidate";

test("一键笔记：填满候选后可撤销恢复", async ({ page, request }) => {
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

  const fillAllBtn = page.getByTestId("sudoku-fill-all-pencil-notes");
  await expect(fillAllBtn).toBeVisible();
  await expect(fillAllBtn).toHaveAttribute("aria-label", "一键为所有空格填入约束候选笔记");

  const firstEmpty = page
    .locator('button[data-testid^="sudoku-cell-"][data-s2-empty="true"]:not([disabled])')
    .first();
  await firstEmpty.click();
  const cellTestId = await firstEmpty.getAttribute("data-testid");
  expect(cellTestId).toMatch(/^sudoku-cell-(\d+)-(\d+)$/);
  const m = cellTestId!.match(/^sudoku-cell-(\d+)-(\d+)$/);
  const r = m![1];
  const c = m![2];

  const anyNoteActive = async (): Promise<boolean> => {
    for (let n = 1; n <= 9; n++) {
      const el = page.getByTestId(`sudoku-note-marker-${r}-${c}-${n}`);
      const cls = (await el.getAttribute("class")) ?? "";
      if (!cls.includes("opacity-40")) {
        return true;
      }
    }
    return false;
  };

  await expect(anyNoteActive()).resolves.toBe(false);

  await fillAllBtn.click();

  await expect(async () => {
    expect(await anyNoteActive()).toBe(true);
  }).toPass({ timeout: 15_000 });

  await page.getByTestId("sudoku-undo").click();
  await expect(anyNoteActive()).resolves.toBe(false);
});
