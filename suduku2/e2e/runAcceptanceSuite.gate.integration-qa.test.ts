/**
 * integration-qa / task 8：将 `runAcceptanceSuite` 纳入 `npm test`（Vitest）总闸，
 * 与 `npm run test:e2e` 使用相同的 Playwright 配置与用例集（`*.spec.ts`）。
 */

import { describe, expect, it } from "vitest";

import { runAcceptanceSuite } from "./acceptance";

describe.sequential("integration-qa task 8: runAcceptanceSuite (full Playwright gate)", () => {
  it(
    "returns passed: true and a text report with run summary",
    { timeout: 600_000 },
    async () => {
      const { passed, report } = await runAcceptanceSuite();
      if (!passed) {
        // eslint-disable-next-line no-console -- 总闸失败时打印报告便于诊断
        console.error(report);
      }
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain("Sudoku2 — Playwright acceptance suite (integration-qa)");
      expect(report).toMatch(/expected=\d+/);
      expect(report).toContain("Result:");
      expect(passed).toBe(true);
    },
  );
});
