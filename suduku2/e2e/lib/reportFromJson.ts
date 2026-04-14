/**
 * Pure helpers to turn Playwright JSON reporter output into a human-readable summary.
 * JSON shape follows `@playwright/test` JSON reporter v2 (`reporters/json.js`).
 */

export type PlaywrightJsonReport = {
  suites?: PlaywrightJsonSuite[];
  errors?: Array<{ message?: string } | string>;
  stats?: {
    duration?: number;
    expected?: number;
    unexpected?: number;
    skipped?: number;
    flaky?: number;
  };
};

export type PlaywrightJsonSuite = {
  title?: string;
  file?: string;
  specs?: PlaywrightJsonSpec[];
  suites?: PlaywrightJsonSuite[];
};

export type PlaywrightJsonSpec = {
  title?: string;
  file?: string;
  line?: number;
  column?: number;
  tests?: PlaywrightJsonTest[];
};

export type PlaywrightJsonTest = {
  status?: string;
  results?: Array<{
    errors?: Array<{ message?: string }>;
  }>;
};

export type FailureLine = {
  /** Best-effort full title path */
  titlePath: string;
  /** File relative to project root when present */
  file?: string;
  /** First line of first error message */
  reasonSnippet: string;
};

function firstErrorSnippet(
  test: PlaywrightJsonTest | undefined,
): string | undefined {
  if (!test?.results?.length) return undefined;
  for (const r of test.results) {
    const err = r.errors?.[0];
    const raw = err?.message?.trim();
    if (raw) {
      const line = raw.split(/\r?\n/)[0] ?? raw;
      return line.length > 400 ? `${line.slice(0, 397)}...` : line;
    }
  }
  return undefined;
}

function walkSuite(
  suite: PlaywrightJsonSuite,
  prefix: string[],
  fileHint: string | undefined,
  failures: FailureLine[],
): void {
  const nextPrefix = suite.title ? [...prefix, suite.title] : [...prefix];
  const file = suite.file ?? fileHint;

  for (const spec of suite.specs ?? []) {
    const specFile = spec.file ?? file;
    walkSpec(spec, nextPrefix, specFile, failures);
  }
  for (const child of suite.suites ?? []) {
    walkSuite(child, nextPrefix, file ?? fileHint, failures);
  }
}

function walkSpec(
  spec: PlaywrightJsonSpec,
  prefix: string[],
  fileHint: string | undefined,
  failures: FailureLine[],
): void {
  const specTitle = spec.title;
  const base = specTitle ? [...prefix, specTitle] : [...prefix];

  for (const t of spec.tests ?? []) {
    const st = t.status;
    if (st !== "unexpected" && st !== "failed") continue;
    const snippet = firstErrorSnippet(t) ?? "(no error message in JSON report)";
    failures.push({
      titlePath: base.join(" › ") || "(unnamed test)",
      file: spec.file ?? fileHint,
      reasonSnippet: snippet,
    });
  }
}

export function collectFailuresFromReport(
  report: PlaywrightJsonReport,
): FailureLine[] {
  const failures: FailureLine[] = [];
  for (const root of report.suites ?? []) {
    walkSuite(root, [], root.file, failures);
  }
  return failures;
}

export function isReportPassing(report: PlaywrightJsonReport): boolean {
  const unexpected = report.stats?.unexpected ?? 0;
  const topErrors = report.errors?.length ?? 0;
  return unexpected === 0 && topErrors === 0;
}

export function formatAcceptanceReport(params: {
  report: PlaywrightJsonReport;
  stderrTail?: string;
}): { passed: boolean; text: string } {
  const { report, stderrTail } = params;
  const failures = collectFailuresFromReport(report);
  const passed = isReportPassing(report) && failures.length === 0;

  const lines: string[] = [];
  lines.push("Sudoku2 — Playwright acceptance suite (integration-qa)");
  lines.push("");

  const stats = report.stats;
  if (stats) {
    lines.push(
      `Duration: ${stats.duration != null ? `${stats.duration}ms` : "unknown"}`,
    );
    lines.push(
      [
        `expected=${stats.expected ?? 0}`,
        `unexpected=${stats.unexpected ?? 0}`,
        `flaky=${stats.flaky ?? 0}`,
        `skipped=${stats.skipped ?? 0}`,
      ].join(", "),
    );
  }

  if (report.errors?.length) {
    lines.push("");
    lines.push("Top-level errors:");
    for (const e of report.errors) {
      const msg = typeof e === "string" ? e : (e.message ?? String(e));
      lines.push(`- ${msg.split(/\r?\n/)[0]}`);
    }
  }

  if (failures.length) {
    lines.push("");
    lines.push("Failed tests:");
    for (const f of failures) {
      const loc = f.file ? `[${f.file}] ` : "";
      lines.push(`- ${loc}${f.titlePath}`);
      lines.push(`  ${f.reasonSnippet}`);
    }
  }

  if (stderrTail?.trim()) {
    lines.push("");
    lines.push("Stderr (tail):");
    lines.push(stderrTail.trim());
  }

  lines.push("");
  lines.push(`Result: ${passed ? "PASSED" : "FAILED"}`);

  return { passed, text: lines.join("\n") };
}

/**
 * Extract a single JSON object from stdout (Playwright prints the report once at end).
 */
export function parseJsonReportFromStdout(stdout: string): PlaywrightJsonReport {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("Playwright produced empty stdout for JSON reporter");
  }
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("No JSON object found in Playwright stdout");
  }
  const lastBrace = trimmed.lastIndexOf("}");
  if (lastBrace <= firstBrace) {
    throw new Error("Malformed JSON region in Playwright stdout");
  }
  const jsonSlice = trimmed.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonSlice) as PlaywrightJsonReport;
}
