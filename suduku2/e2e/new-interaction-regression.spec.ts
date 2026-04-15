/**
 * 任务 19：Playwright 回归 — 覆盖任务 14–17 核心路径（可控谜题入口 `practice-endless:unique-candidate`）。
 * 不通过 Vitest 嵌套跑 Playwright；单用例超时 ≤ 2 分钟（与 playwright.config 一致）。
 */
import { test, expect, type Page, type Locator } from "@playwright/test";

import { apiRegisterAndLogin, injectAuth } from "./helpers";

test.describe.configure({ retries: 1 });

const MODE = "practice-endless:unique-candidate";
const TID = "unique-candidate";

async function filledCellsByDigit(
  page: Page,
): Promise<{ digit: string; testIds: string[] }[]> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="practice-board"]');
    if (!root) {
      return [];
    }
    const map = new Map<string, string[]>();
    for (const el of root.querySelectorAll('button[data-testid^="sudoku-cell-"]')) {
      if (el.getAttribute("data-s2-empty") === "true") {
        continue;
      }
      const tid = el.getAttribute("data-testid");
      if (!tid) {
        continue;
      }
      const t = (el.textContent ?? "").replace(/\s/g, "");
      if (!/^[1-9]$/.test(t)) {
        continue;
      }
      const arr = map.get(t) ?? [];
      arr.push(tid);
      map.set(t, arr);
    }
    return [...map.entries()]
      .filter(([, ids]) => ids.length >= 2)
      .map(([digit, testIds]) => ({ digit, testIds }));
  });
}

/**
 * 与 `getUniqueValidPlacementDigit` / 数字键盘锁定一致：在填数模式下逐格点击，
 * 用 `data-s2-single-candidate-lock` 与按键启用态定位单候选与多候选格。
 */
async function findSingleAndMultiViaDigitPad(page: Page): Promise<{
  single: { r: number; c: number; d: number };
  multi: { r: number; c: number };
}> {
  await page.getByTestId("sudoku-mode-fill").click();

  let single: { r: number; c: number; d: number } | null = null;
  let multi: { r: number; c: number } | null = null;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = page.getByTestId(`sudoku-cell-${r}-${c}`);
      if ((await cell.getAttribute("data-s2-empty")) !== "true") {
        continue;
      }
      await cell.click();
      const pad = page.getByTestId("sudoku-digit-pad");
      const lock = await pad.getAttribute("data-s2-single-candidate-lock");

      if (lock === "true" && !single) {
        for (let n = 1; n <= 9; n++) {
          if (await page.getByTestId(`digit-pad-${n}`).isEnabled()) {
            single = { r, c, d: n };
            break;
          }
        }
      } else if (lock !== "true" && !multi) {
        const allOn = await Promise.all(
          Array.from({ length: 9 }, (_, i) => page.getByTestId(`digit-pad-${i + 1}`).isEnabled()),
        );
        if (allOn.every(Boolean)) {
          multi = { r, c };
        }
      }

      if (single && multi) {
        return { single, multi };
      }
    }
  }

  throw new Error("未在盘面上找到单候选与多候选空格（请检查专项练习生成或延长等待）");
}

/** 随机题偶发无「行/列/宫唯一可填」起点：重载页面换一题再探测 */
async function findSingleMultiWithReloadRetries(
  page: Page,
  maxAttempts: number,
): Promise<{ single: { r: number; c: number; d: number }; multi: { r: number; c: number } }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("practice-play-root")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("practice-board")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("practice-board").locator('button[data-testid^="sudoku-cell-"]')).toHaveCount(
        81,
        { timeout: 60_000 },
      );
    }
    try {
      return await findSingleAndMultiViaDigitPad(page);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "findSingleMultiWithReloadRetries failed"));
}

/** 选一格用于任务 16，尽量避开单候选格，避免笔记干扰后续任务 17 的锁定断言 */
async function pickEmptyCellForModeToggle(
  board: Locator,
  avoid: { r: number; c: number } | null,
): Promise<Locator> {
  const avoidTid = avoid ? `sudoku-cell-${avoid.r}-${avoid.c}` : null;
  const empties = board.locator(
    'button[data-testid^="sudoku-cell-"][data-s2-empty="true"]:not([disabled])',
  );
  const n = await empties.count();
  for (let i = 0; i < n; i++) {
    const cell = empties.nth(i);
    const tid = await cell.getAttribute("data-testid");
    if (tid && avoidTid && tid === avoidTid) {
      continue;
    }
    return cell;
  }
  return empties.first();
}

test.describe("任务14–17 新交互回归（unique-candidate）", () => {
  test("单会话串联：同数字高亮与键盘、空白格模式切换、单候选键盘锁", async ({
    page,
    request,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: "reduce" });

    const { token } = await apiRegisterAndLogin(request);
    await injectAuth(page, token);

    await request.patch("http://127.0.0.1:3003/api/progress", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      data: {
        techniques: { [TID]: { unlocked: true } },
      },
    });

    await page.goto(`/game/practice?modeId=${encodeURIComponent(MODE)}`);
    await expect(page.getByTestId("practice-play-root")).toBeVisible({ timeout: 60_000 });

    const board = page.getByTestId("practice-board");
    await expect(board).toBeVisible({ timeout: 60_000 });
    await expect(board.locator('button[data-testid^="sudoku-cell-"]')).toHaveCount(81, {
      timeout: 60_000,
    });
    await expect(board.locator('[data-s2-given="true"]').first()).toBeVisible({
      timeout: 60_000,
    });

    // 先锁定任务 17 用坐标（与 UI 锁定逻辑一致；必要时换题）
    const { single: s, multi: mu } = await findSingleMultiWithReloadRetries(page, 4);

    // —— 任务 14 / 15：同数字高亮 + 数字键盘关注态 ——
    const multi = await filledCellsByDigit(page);
    expect(
      multi.length,
      "盘面应至少有两种已填数字各出现不少于两次",
    ).toBeGreaterThanOrEqual(2);
    const first = multi[0]!;
    const second = multi.find((m) => m.digit !== first.digit) ?? multi[1]!;
    expect(second).toBeDefined();

    await page.getByTestId(first.testIds[0]!).click();
    await expect(board.locator('[data-s2-same-digit="true"]')).toHaveCount(first.testIds.length);
    await expect(page.getByTestId(`digit-pad-${first.digit}`)).toHaveAttribute(
      "data-s2-focus-digit",
      "true",
    );

    await page.getByTestId(second!.testIds[0]!).click();
    await expect(board.locator('[data-s2-same-digit="true"]')).toHaveCount(second!.testIds.length);
    await expect(page.getByTestId(`digit-pad-${second.digit}`)).toHaveAttribute(
      "data-s2-focus-digit",
      "true",
    );

    const modeCell = await pickEmptyCellForModeToggle(board, s);
    await modeCell.click();
    await expect(board.locator('[data-s2-same-digit="true"]')).toHaveCount(0);
    await expect(page.getByTestId(`digit-pad-${first.digit}`)).not.toHaveAttribute(
      "data-s2-focus-digit",
      "true",
    );

    // —— 任务 16：空白格二次点击切换填数 / 笔记 ——
    const modeHint = page.getByTestId("sudoku-mode-hint");
    await expect(modeHint).toHaveAttribute("data-s2-input-mode", "fill");
    await expect(modeHint).toContainText("当前：填数");

    await modeCell.click();
    await expect(modeHint).toHaveAttribute("data-s2-input-mode", "notes");
    await expect(modeHint).toContainText("当前：笔记");
    await expect(page.getByTestId("sudoku-mode-notes")).toHaveAttribute("aria-pressed", "true");

    const cellId = await modeCell.getAttribute("data-testid");
    expect(cellId).toMatch(/^sudoku-cell-\d+-\d+$/);
    const m = cellId!.match(/^sudoku-cell-(\d+)-(\d+)$/);
    expect(m).not.toBeNull();
    const r = m![1];
    const c = m![2];

    await page.getByTestId("digit-pad-2").click();
    await page.getByTestId("digit-pad-5").click();

    const note2 = page.getByTestId(`sudoku-note-marker-${r}-${c}-2`);
    await expect(note2).not.toHaveClass(/opacity-40/);

    await modeCell.click();
    await expect(modeHint).toHaveAttribute("data-s2-input-mode", "fill");
    await expect(note2).not.toHaveClass(/opacity-40/);

    // —— 任务 17：单候选锁定 / 多候选解锁 / 笔记不锁定 ——
    await page.getByTestId("sudoku-mode-fill").click();

    await page.getByTestId(`sudoku-cell-${s.r}-${s.c}`).click();
    await expect(page.getByTestId("sudoku-digit-pad")).toHaveAttribute(
      "data-s2-single-candidate-lock",
      "true",
    );
    for (let n = 1; n <= 9; n++) {
      const btn = page.getByTestId(`digit-pad-${n}`);
      if (n === s.d) {
        await expect(btn).toBeEnabled();
      } else {
        await expect(btn).toBeDisabled();
      }
    }

    await page.getByTestId(`sudoku-cell-${mu.r}-${mu.c}`).click();
    await expect(page.getByTestId("sudoku-digit-pad")).not.toHaveAttribute(
      "data-s2-single-candidate-lock",
    );
    for (let n = 1; n <= 9; n++) {
      await expect(page.getByTestId(`digit-pad-${n}`)).toBeEnabled();
    }

    for (let k = 0; k < 4; k++) {
      await page.getByTestId(`sudoku-cell-${s.r}-${s.c}`).click();
      await page.getByTestId(`sudoku-cell-${mu.r}-${mu.c}`).click();
      await expect(page.getByTestId("sudoku-digit-pad")).not.toHaveAttribute(
        "data-s2-single-candidate-lock",
      );
    }

    await page.getByTestId(`sudoku-cell-${s.r}-${s.c}`).click();
    await expect(page.getByTestId("sudoku-digit-pad")).toHaveAttribute(
      "data-s2-single-candidate-lock",
      "true",
    );

    await page.getByTestId("sudoku-mode-notes").click();
    await expect(page.getByTestId("sudoku-digit-pad")).not.toHaveAttribute(
      "data-s2-single-candidate-lock",
    );
    for (let n = 1; n <= 9; n++) {
      await expect(page.getByTestId(`digit-pad-${n}`)).toBeEnabled();
    }
  });
});
