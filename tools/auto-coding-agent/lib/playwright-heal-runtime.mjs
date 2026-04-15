/**
 * 一键 Playwright E2E：失败时调用 Cursor Agent CLI 修复代码/测试并重试，直至通过或达到轮数上限。
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { runCursorAgent } from "./agent-runner.mjs";
import { resolveAgentTimeoutMs } from "./project-runtime.mjs";

const MAX_LOG_CHARS = 120_000;

/**
 * @param {string} repoRoot
 * @param {string} projectDir 相对仓库根
 */
export function projectHasPlaywright(repoRoot, projectDir) {
  const abs = path.join(repoRoot, projectDir);
  if (!fs.existsSync(abs)) return false;
  const cfgTs = path.join(abs, "playwright.config.ts");
  const cfgMts = path.join(abs, "playwright.config.mts");
  if (fs.existsSync(cfgTs) || fs.existsSync(cfgMts)) return true;
  try {
    const raw = fs.readFileSync(path.join(abs, "package.json"), "utf8");
    const pkg = JSON.parse(raw);
    return !!(pkg.scripts && typeof pkg.scripts["test:e2e"] === "string");
  } catch {
    return false;
  }
}

/**
 * @param {number | undefined} pid
 */
function killProcessTreeBestEffort(pid) {
  if (!pid || pid < 1) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      /* 已退出 */
    }
  } else {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* ignore */
      }
    }
  }
}

function resolveMaxRounds() {
  const raw = process.env.AUTOCODING_E2E_HEAL_MAX_ROUNDS;
  const n = raw === undefined || raw === "" ? 20 : parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(200, n) : 20;
}

function resolvePlaywrightTimeoutMs() {
  const raw = process.env.AUTOCODING_E2E_PLAYWRIGHT_TIMEOUT_MS;
  const n = raw === undefined || raw === "" ? 2 * 60 * 60 * 1000 : parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 30_000 ? Math.min(8 * 60 * 60 * 1000, n) : 2 * 60 * 60 * 1000;
}

/**
 * @param {import("./projects.mjs").ProjectDef} project
 * @param {string} repoRoot
 */
export class PlaywrightHealRuntime {
  /**
   * @param {import("./projects.mjs").ProjectDef} project
   * @param {string} repoRoot
   */
  constructor(project, repoRoot) {
    this.project = project;
    this.repoRoot = repoRoot;
    this.projectAbs = path.join(repoRoot, project.dir);
    /** @type {"idle"|"running"|"paused"|"completed"|"failed"} */
    this.status = "idle";
    /** @type {"e2e"|"agent"|null} */
    this.phase = null;
    this.round = 0;
    this.maxRounds = resolveMaxRounds();
    this.lastError = null;
    this.logBuf = "";
    this._e2eChild = null;
    this._agentPid = null;
    this._pauseRequested = false;
    /** @type {(() => void) | null} */
    this._resolveSession = null;
  }

  /**
   * @param {string} line
   */
  log(line) {
    const t = new Date().toISOString();
    const chunk = `[${t}] ${line}\n`;
    this.logBuf += chunk;
    if (this.logBuf.length > MAX_LOG_CHARS) {
      this.logBuf = this.logBuf.slice(-MAX_LOG_CHARS);
    }
    // eslint-disable-next-line no-console
    console.log(`[playwright-heal:${this.project.id}] ${line}`);
  }

  getLogTail(maxChars = 24_000) {
    const s = this.logBuf;
    if (s.length <= maxChars) return s;
    return s.slice(-maxChars);
  }

  /**
   * @returns {{ ok: boolean; error?: string }}
   */
  start() {
    if (this.status === "running") {
      return { ok: false, error: "自愈测试已在运行中" };
    }
    if (!projectHasPlaywright(this.repoRoot, this.project.dir)) {
      return {
        ok: false,
        error: `项目目录下未检测到 Playwright（缺少 playwright.config.* 且无 npm run test:e2e）：${this.project.dir}`,
      };
    }
    if (!fs.existsSync(this.projectAbs)) {
      return { ok: false, error: `项目路径不存在：${this.projectAbs}` };
    }

    this.status = "running";
    this.phase = null;
    this.round = 0;
    this.lastError = null;
    this.logBuf = "";
    this._pauseRequested = false;
    this.log(`开始自愈 E2E：${this.project.name}（${this.project.dir}）`);

    void this._runLoop().catch((e) => {
      this.log(`运行器异常: ${e?.message || e}`);
      if (this.status === "running") {
        this.status = "failed";
        this.lastError = String(e?.message || e);
      }
      this._notifySessionEnd();
    });

    return { ok: true };
  }

  _notifySessionEnd() {
    const fn = this._resolveSession;
    this._resolveSession = null;
    if (fn) fn();
  }

  /**
   * 等待本会话结束（completed / failed / paused）。若当前未在运行则立即 resolve。
   * @returns {Promise<void>}
   */
  waitUntilIdle() {
    return new Promise((resolve) => {
      if (this.status !== "running") {
        resolve();
        return;
      }
      this._resolveSession = resolve;
    });
  }

  pause() {
    if (this.status !== "running") {
      return { ok: true, message: "当前未在运行" };
    }
    this._pauseRequested = true;
    killProcessTreeBestEffort(this._e2eChild?.pid);
    this._e2eChild = null;
    killProcessTreeBestEffort(this._agentPid);
    this._agentPid = null;
    this.status = "paused";
    this.phase = null;
    this.log("用户暂停：已终止当前子进程。");
    this._notifySessionEnd();
    return { ok: true };
  }

  reset() {
    this.pause();
    this.status = "idle";
    this.phase = null;
    this.round = 0;
    this.lastError = null;
    this.logBuf = "";
    return { ok: true };
  }

  getStatus() {
    return {
      ok: true,
      project: this.project.id,
      status: this.status,
      phase: this.phase,
      round: this.round,
      maxRounds: this.maxRounds,
      lastError: this.lastError,
      log: this.getLogTail(),
    };
  }

  async _runLoop() {
    try {
      while (this.status === "running" && !this._pauseRequested) {
        this.round += 1;
        if (this.round > this.maxRounds) {
          this.status = "failed";
          this.lastError = `已达最大测试/自愈轮数（${this.maxRounds}），请检查失败日志或提高 AUTOCODING_E2E_HEAL_MAX_ROUNDS。`;
          this.log(this.lastError);
          break;
        }

        this.log(`—— 第 ${this.round}/${this.maxRounds} 轮：运行 npm run test:e2e ——`);

        const e2e = await this._runPlaywright();
        if (this._pauseRequested || this.status !== "running") break;

        if (e2e.code === 0) {
          this.status = "completed";
          this.phase = null;
          this.log("Playwright E2E 全部通过。");
          break;
        }

        this.log(
          `E2E 失败（exit ${e2e.code}）。截取输出 ${e2e.tail.length} 字符，准备调用 Cursor Agent CLI 修复…`,
        );

        this.phase = "agent";
        const prompt = this._buildAgentPrompt(e2e.tail);
        const agentTimeout = resolveAgentTimeoutMs(undefined);
        this.log(`调用 agent（超时 ${Math.round(agentTimeout / 60000)} 分钟）…`);

        const agentRes = await runCursorAgent(this.repoRoot, prompt, undefined, agentTimeout, {
          onSpawn: (pid) => {
            this._agentPid = pid;
          },
          onStdout: (s) => {
            if (s) this.log(`[agent stdout] ${s.split("\n").slice(-3).join(" ").slice(0, 800)}`);
          },
          onStderr: (s) => {
            if (s) this.log(`[agent stderr] ${s.split("\n").slice(-2).join(" ").slice(0, 800)}`);
          },
        });
        this._agentPid = null;

        if (this._pauseRequested || this.status !== "running") break;

        if (agentRes.code !== 0) {
          this.log(
            `Agent 退出码 ${agentRes.code}（可能是网络或用户中断）。将仍重试 E2E。Stderr 节选：${(agentRes.stderr || "").slice(-1200)}`,
          );
        } else {
          this.log("Agent 本轮正常结束，准备再次运行 E2E。");
        }
        this.phase = null;
      }
    } finally {
      this._e2eChild = null;
      this._agentPid = null;
      if (this.status === "running") {
        this.status = "failed";
        this.lastError = this.lastError || "未知原因中断";
      }
      if (this.status === "failed" && !this.lastError) {
        this.lastError = "会话结束（失败）";
      }
      this._notifySessionEnd();
    }
  }

  /**
   * @returns {Promise<{ code: number; tail: string }>}
   */
  _runPlaywright() {
    return new Promise((resolve) => {
      this.phase = "e2e";
      const env = {
        ...process.env,
        CI: process.env.AUTOCODING_E2E_FORCE_CI === "0" ? process.env.CI || "" : "1",
        FORCE_COLOR: "0",
      };

      const child = spawn("npm", ["run", "test:e2e"], {
        cwd: this.projectAbs,
        env,
        shell: true,
        windowsHide: true,
      });
      this._e2eChild = child;

      let out = "";
      let err = "";
      const cap = 800_000;
      child.stdout?.setEncoding("utf8");
      child.stderr?.setEncoding("utf8");
      child.stdout?.on("data", (c) => {
        out += c;
        if (out.length > cap) out = out.slice(-cap);
      });
      child.stderr?.on("data", (c) => {
        err += c;
        if (err.length > cap) err = err.slice(-cap);
      });

      const timeoutMs = resolvePlaywrightTimeoutMs();
      const timer = setTimeout(() => {
        this.log(`E2E 超时（${timeoutMs}ms），终止子进程。`);
        killProcessTreeBestEffort(child.pid);
      }, timeoutMs);

      child.on("close", (code) => {
        clearTimeout(timer);
        this._e2eChild = null;
        const merged = [out, err].filter(Boolean).join("\n--- stderr ---\n");
        const tail = merged.length > 24_000 ? merged.slice(-24_000) : merged;
        resolve({ code: code ?? 1, tail });
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        this._e2eChild = null;
        resolve({ code: 1, tail: String(e?.message || e) });
      });
    });
  }

  /**
   * @param {string} failureTail
   */
  _buildAgentPrompt(failureTail) {
    const dir = this.project.dir;
    return [
      `你是本仓库的 coding agent。工作区根目录：${this.repoRoot}`,
      ``,
      `【自愈任务】子项目「${this.project.name}」（相对目录 ${dir}/）执行 \`npm run test:e2e\` 失败。`,
      `你需要修复应用缺陷、测试脆弱性、或补全缺失的 E2E（须符合仓库 .cursor/rules 中 Playwright 规范：主流程、计时器、有效/无效操作等）。`,
      ``,
      `硬性要求：`,
      `1. 在 ${dir}/ 目录阅读 playwright.config.ts、e2e/ 与被测页面代码。`,
      `2. 在 ${dir}/ 下执行 npm run lint 与 npm run build（若项目提供），修复至通过。`,
      `3. 若尚未安装浏览器，在 ${dir}/ 执行 npx playwright install chromium。`,
      `4. 在 ${dir}/ 下再次运行 npm run test:e2e 直至全部通过（可单文件调试：npx playwright test <文件>）。`,
      `5. 不要修改根目录 task.json 的 passes 字段（本流程与任务队列无关）。`,
      `6. 改动范围尽量仅限 ${dir}/ 及必要的共享文档。`,
      ``,
      `【最近一次失败输出（尾部）】`,
      failureTail.slice(-18_000),
    ].join("\n");
  }
}
