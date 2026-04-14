import { describe, expect, it } from "vitest";

import {
  collectFailuresFromReport,
  formatAcceptanceReport,
  isReportPassing,
  parseJsonReportFromStdout,
  type PlaywrightJsonReport,
} from "./lib/reportFromJson";

describe("reportFromJson", () => {
  it("marks passing stats with no failures", () => {
    const report: PlaywrightJsonReport = {
      stats: {
        duration: 1200,
        expected: 3,
        unexpected: 0,
        skipped: 0,
        flaky: 0,
      },
      suites: [],
      errors: [],
    };
    expect(isReportPassing(report)).toBe(true);
    const { passed, text } = formatAcceptanceReport({ report });
    expect(passed).toBe(true);
    expect(text).toContain("PASSED");
    expect(text).toContain("expected=3");
  });

  it("collects unexpected tests and snippets", () => {
    const report: PlaywrightJsonReport = {
      stats: {
        duration: 500,
        expected: 1,
        unexpected: 1,
        skipped: 0,
        flaky: 0,
      },
      suites: [
        {
          title: "home.spec.ts",
          file: "e2e/home.spec.ts",
          specs: [
            {
              title: "首页可达",
              tests: [
                {
                  status: "unexpected",
                  results: [
                    {
                      errors: [
                        {
                          message:
                            "Error: expect(locator).toBeVisible()\n\nLocator resolved to hidden",
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      errors: [],
    };
    const failures = collectFailuresFromReport(report);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.titlePath).toContain("首页可达");
    expect(failures[0]?.reasonSnippet).toContain("expect(locator)");

    const { passed, text } = formatAcceptanceReport({ report });
    expect(passed).toBe(false);
    expect(text).toContain("FAILED");
    expect(text).toContain("e2e/home.spec.ts");
  });

  it("parseJsonReportFromStdout tolerates leading noise before JSON", () => {
    const inner = JSON.stringify({
      stats: { unexpected: 0, expected: 1 },
      suites: [],
      errors: [],
    });
    const stdout = `some log line\n${inner}\n`;
    const parsed = parseJsonReportFromStdout(stdout);
    expect(parsed.stats?.unexpected).toBe(0);
  });
});
