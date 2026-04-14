/**
 * Integration acceptance entry for Sudoku2 (`integration-qa` module).
 *
 * **Import:** `import { runAcceptanceSuite } from "@/e2e/acceptance"` or `@/e2e` (see `e2e/index.ts`).
 *
 * Runs the same Playwright suite as `npm run test:e2e` (see `playwright.config.ts`: `testDir: ./e2e`, port 3003, `workers: 1`).
 * Implementation spawns `npx playwright test --reporter=json` and summarizes JSON output into `report`.
 */

import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  formatAcceptanceReport,
  parseJsonReportFromStdout,
  type PlaywrightJsonReport,
} from "./lib/reportFromJson";

export type AcceptanceSuiteResult = {
  passed: boolean;
  report: string;
};

function suduku2RootDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

/**
 * 检测端口是否被占用（有服务在监听）。
 * 用于判断是否应以 CI 模式启动生产构建，还是复用已有 dev server。
 */
function isPortInUse(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host });
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => {
      resolve(false);
    });
  });
}

function runPlaywrightJsonReporter(projectRoot: string, useCI: boolean): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const args = [
      "playwright",
      "test",
      "--reporter=json",
      "--config=playwright.config.ts",
    ];
    const env = { ...process.env };
    if (useCI) {
      env.CI = "1";
    }
    const child = spawn("npx", args, {
      cwd: projectRoot,
      shell: true,
      env,
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

function stderrTail(stderr: string, maxChars = 4000): string {
  if (stderr.length <= maxChars) return stderr;
  return stderr.slice(-maxChars);
}

/**
 * Run the full Playwright E2E suite programmatically and return pass/fail plus a text summary.
 * Failures include test titles (with file when present) and a short reason line from the JSON report.
 */
export async function runAcceptanceSuite(): Promise<AcceptanceSuiteResult> {
  const projectRoot = suduku2RootDir();
  const alreadyHasCI = !!process.env.CI;
  const serverRunning = await isPortInUse(3003);
  // CI 模式（生产构建）：调用方已设 CI，或端口空闲时自动启用以获得更快的页面加载
  const useCI = alreadyHasCI || !serverRunning;
  const { exitCode, stdout, stderr } =
    await runPlaywrightJsonReporter(projectRoot, useCI);

  let reportJson: PlaywrightJsonReport;
  try {
    reportJson = parseJsonReportFromStdout(stdout);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const report = [
      "Sudoku2 — Playwright acceptance suite (integration-qa)",
      "",
      "Failed to parse Playwright JSON report from stdout.",
      `Parse error: ${errMsg}`,
      `Playwright exit code: ${exitCode}`,
      "",
      "Stderr (tail):",
      stderrTail(stderr),
      "",
      "Stdout (tail):",
      stdout.trim().slice(-4000) || "(empty)",
      "",
      "Result: FAILED",
    ].join("\n");
    return { passed: false, report };
  }

  const { passed: jsonSaysPass, text } = formatAcceptanceReport({
    report: reportJson,
    stderrTail: exitCode !== 0 ? stderrTail(stderr) : undefined,
  });

  const passed = jsonSaysPass && exitCode === 0;
  const report =
    !passed && exitCode !== 0 && jsonSaysPass
      ? `${text}\n\n(Playwright process exited with code ${exitCode})`
      : text;

  return { passed, report };
}
