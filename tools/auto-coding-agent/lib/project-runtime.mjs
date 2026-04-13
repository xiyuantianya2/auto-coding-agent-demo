/**
 * ProjectRuntime: 每个子项目的独立运行时实例。
 * 封装全部 per-project 状态（worker、agent 进程、日志、CLI 输出等），
 * 使多个项目可以并行运行 agent。
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { runCursorAgent } from "./agent-runner.mjs";
import { loadIncompleteTasks, isTaskDone } from "./task-queue.mjs";
import { performLinkGameProjectReset } from "./reset-link-game.mjs";
import { formatBeijingDateTime } from "./beijing-time.mjs";

const MAX_LOG_LINES = 900;

// ── project-specific agent prompt builders ──────────────────────────

const CUSTOM_AGENT_BUILDERS = {
  "link-game": (repoRoot, project, task) => {
    const steps = Array.isArray(task.steps) ? task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "";
    return [
      `你是本仓库的 coding agent。工作区根目录：${repoRoot}`,
      ``,
      `必读文件（按顺序理解约束）：CLAUDE.md、progress.txt、task.json、architecture.md。`,
      `应用代码在子目录 link-game/（Next.js）。执行 npm 脚本时请在 link-game 目录下。`,
      ``,
      `【本步唯一目标】只完成任务 task id=${task.id}（不要并行做其它 task）：`,
      `标题：${task.title}`,
      task.description ? `说明：${task.description}` : "",
      `验收步骤：`,
      steps,
      ``,
      `硬性要求：`,
      `- 严格按 CLAUDE.md 的会话流程：先确认基线（init 或 link-game 下 dev），再实现本任务。`,
      `- 实现完成后：必须修改仓库根目录下的 task.json（路径：${path.join(repoRoot, "task.json")}），将 id=${task.id} 的 passes 改为 true；不要只改子目录里的副本。`,
      `- 更新 progress.txt 记录本任务。`,
      `- 在 link-game 目录执行 npm run lint 与 npm run build，修复直至通过。`,
      `- 浏览器自动化验收（Playwright E2E）：在 link-game/ 目录下执行 \`npx playwright test --headed\`（或 \`npm run test:e2e\`），它会自动启动 dev server 并打开 Chromium 浏览器窗口，运行 E2E 测试。Playwright 配置已内置 webServer 自动启动 dev。如果浏览器未安装，先执行 \`npx playwright install chromium\`。全部测试通过才算验收成功。`,
      `- 单次 git commit 包含本任务相关变更（若使用 git）。`,
    ]
      .filter(Boolean)
      .join("\n");
  },
};

// ── pure utility functions ──────────────────────────────────────────

function extractText(msg) {
  if (!msg?.content) return "";
  return msg.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("");
}

function describeToolCall(tc) {
  if (!tc) return "未知工具";
  if (tc.readToolCall) {
    const p = tc.readToolCall.args?.path || "";
    return `读取文件 ${p.split(/[\\/]/).pop() || p}`;
  }
  if (tc.shellToolCall) {
    const cmd = tc.shellToolCall.args?.command || tc.shellToolCall.description || "";
    return `执行命令 ${cmd.length > 100 ? cmd.slice(0, 100) + "…" : cmd}`;
  }
  if (tc.editToolCall) return `编辑文件 ${tc.editToolCall.args?.filePath || ""}`;
  if (tc.writeToolCall) return `写入文件 ${tc.writeToolCall.args?.filePath || ""}`;
  if (tc.listToolCall) return `列出目录 ${tc.listToolCall.args?.path || ""}`;
  if (tc.grepToolCall) return `搜索 ${tc.grepToolCall.args?.pattern || ""}`;
  if (tc.globToolCall) return `查找文件 ${tc.globToolCall.args?.pattern || ""}`;
  return Object.keys(tc)[0] || "未知工具";
}

function describeToolResult(tc) {
  if (!tc) return "";
  for (const key of Object.keys(tc)) {
    const inner = tc[key];
    if (inner?.result?.rejected) {
      return `❌ 被拒绝: ${inner.result.rejected.command || inner.result.rejected.reason || ""}`;
    }
    if (inner?.result?.success) return "";
  }
  return "";
}

function isWebpackNoise(chunk) {
  if (chunk.length < 80) return false;
  if (
    chunk.includes("__webpack_require__") ||
    chunk.includes("node_modules/.pnpm/") ||
    chunk.includes("dist/cjs/internal/")
  )
    return true;
  const sample = chunk.slice(0, 600);
  const codeChars = (sample.match(/[{}();=>,[\]]/g) || []).length;
  return sample.length > 200 && codeChars / sample.length > 0.08;
}

// ── Dev server port / kill listener (EADDRINUSE) ───────────────────

/** @param {string} projectDir */
function inferDevServerPort(projectDir) {
  const fallback = 3000;
  try {
    const raw = fs.readFileSync(path.join(projectDir, "package.json"), "utf8");
    const j = JSON.parse(raw);
    const dev = j.scripts?.dev;
    if (typeof dev !== "string" || !dev.trim()) return fallback;

    const mEnv = dev.match(/\bPORT\s*=\s*(\d{1,5})\b/i);
    if (mEnv) {
      const p = parseInt(mEnv[1], 10);
      if (p >= 1 && p <= 65535) return p;
    }
    const mDash = dev.match(/(?:^|[\s/])-p(?:\s+|=)(\d{1,5})\b/);
    if (mDash) {
      const p = parseInt(mDash[1], 10);
      if (p >= 1 && p <= 65535) return p;
    }
    const mLong = dev.match(/--port(?:=|\s+)(\d{1,5})\b/);
    if (mLong) {
      const p = parseInt(mLong[1], 10);
      if (p >= 1 && p <= 65535) return p;
    }

    if (/\bnext\s+dev\b/.test(dev)) return fallback;
    if (/\bvite\b/.test(dev)) return 5173;
    return fallback;
  } catch {
    return fallback;
  }
}

/** @param {number} port */
function winGetPidsListeningOnPort(port) {
  try {
    const script =
      `$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue; ` +
      `if ($null -ne $c) { $c | Select-Object -ExpandProperty OwningProcess -Unique }`;
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const n = parseInt(line.trim(), 10);
      if (Number.isFinite(n) && n > 0) pids.add(n);
    }
    if (pids.size > 0) return [...pids];
  } catch {
    /* fall through to netstat */
  }
  try {
    const out = execFileSync("cmd.exe", ["/c", "netstat -ano -p TCP"], {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 2 * 1024 * 1024,
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5 || parts[0] !== "TCP") continue;
      const localAddr = parts[1];
      const state = parts[3];
      if (state !== "LISTENING") continue;
      const pid = parseInt(parts[4], 10);
      const m = localAddr.match(/:(\d+)$/);
      if (!m || !Number.isFinite(pid) || pid <= 0) continue;
      if (parseInt(m[1], 10) !== port) continue;
      pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

/** @param {number} port */
function unixGetPidsListeningOnPort(port) {
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
      maxBuffer: 512 * 1024,
    });
    const pids = new Set();
    for (const line of out.trim().split(/\r?\n/)) {
      const n = parseInt(line.trim(), 10);
      if (Number.isFinite(n) && n > 0) pids.add(n);
    }
    return [...pids];
  } catch {
    return [];
  }
}

/** @param {number} port */
function getPidsListeningOnPort(port) {
  if (!Number.isFinite(port) || port < 1 || port > 65535) return [];
  if (process.platform === "win32") return winGetPidsListeningOnPort(port);
  return unixGetPidsListeningOnPort(port);
}

/** @param {number} pid */
function killPidForceBestEffort(pid) {
  if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) return false;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        try {
          process.kill(pid, "SIGTERM");
        } catch {
          /* ignore */
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 结束占用指定 TCP 监听端口的进程（用于解决 dev server 启动时 EADDRINUSE）。
 * @param {number} port
 * @returns {number[]} 已尝试结束的 PID（去重）
 */
function killProcessesListeningOnPort(port) {
  const killed = [];
  const seen = new Set();
  for (let round = 0; round < 3; round++) {
    const pids = getPidsListeningOnPort(port);
    if (pids.length === 0) break;
    let any = false;
    for (const pid of pids) {
      if (seen.has(pid)) continue;
      if (killPidForceBestEffort(pid)) {
        seen.add(pid);
        killed.push(pid);
        any = true;
      }
    }
    if (!any) break;
  }
  return killed;
}

// ── ProjectRuntime class ────────────────────────────────────────────

export class ProjectRuntime {
  /**
   * @param {import("./projects.mjs").ProjectDef} project
   * @param {string} repoRoot
   * @param {string} dataDir
   * @param {{ agentTimeoutMs?: number; maxCliChars?: number }} [config]
   */
  constructor(project, repoRoot, dataDir, config = {}) {
    this.project = project;
    this.repoRoot = repoRoot;
    this.dataDir = dataDir;
    this.statePath = path.join(dataDir, `state-${project.id}.json`);
    this.agentTimeoutMs = config.agentTimeoutMs || 45 * 60 * 1000;
    this.maxCliChars = Math.max(50_000, Math.min(4 * 1024 * 1024, config.maxCliChars || 900_000));

    this.state = { status: "idle", lastError: null, updatedAt: formatBeijingDateTime(), lastTaskId: null };
    this.startupRecoveredRunningToPaused = false;
    this.workerRunning = false;
    this.resetRequested = false;
    /** @type {number | undefined} */
    this.lastAgentPid = undefined;
    /** @type {import("node:stream").Writable | null} */
    this.agentStdinStream = null;
    this.lastAgentOutputAt = 0;
    this.agentPhase = { phase: "idle", detail: "", updatedAt: formatBeijingDateTime() };
    this.autoAdvance = true;
    /** @type {string[]} */
    this.logLines = [];
    this.agentPromptSnapshot = { text: "", taskId: null, updatedAt: null };
    this.agentCliSnapshot = { text: "", taskId: null, updatedAt: null };
    this.stdoutLineBuf = "";

    /** @type {string | null} */
    this.wizardDescription = null;
    /** @type {Array<{id:string, label:string, type:string, placeholder?:string, options?:string[]}>|null} */
    this.wizardQuestions = null;

    /** @type {import("node:child_process").ChildProcess | null} */
    this.devServerProc = null;
    this.devServerRunning = false;
    /** @type {string[]} */
    this.devServerLog = [];
  }

  // ── State persistence ───────────────────────────────────────────

  async loadState() {
    this.startupRecoveredRunningToPaused = false;
    try {
      const raw = await fsp.readFile(this.statePath, "utf8");
      const j = JSON.parse(raw);
      if (["running", "paused", "idle", "completed"].includes(j.status)) {
        if (j.status === "running") {
          this.state.status = "paused";
          this.startupRecoveredRunningToPaused = true;
        } else {
          this.state.status = j.status;
        }
      }
      if (typeof j.lastError === "string" || j.lastError === null) this.state.lastError = j.lastError;
      if (typeof j.lastTaskId === "number" || j.lastTaskId === null) this.state.lastTaskId = j.lastTaskId ?? null;
    } catch {
      /* first run */
    }
    this.state.updatedAt = formatBeijingDateTime();
  }

  async saveState() {
    this.state.updatedAt = formatBeijingDateTime();
    await fsp.mkdir(this.dataDir, { recursive: true });
    await fsp.writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  async deleteStateFile() {
    try {
      await fsp.unlink(this.statePath);
    } catch {
      /* ok */
    }
  }

  // ── Logging ─────────────────────────────────────────────────────

  log(line) {
    const t = formatBeijingDateTime();
    const s = `[${t}] [${this.project.id}] ${line}\n`;
    this.logLines.push(s);
    while (this.logLines.length > MAX_LOG_LINES) this.logLines.shift();
    process.stdout.write(s);
  }

  // ── Agent phase & CLI output ────────────────────────────────────

  setAgentPhase(phase, detail = "") {
    this.agentPhase = { phase, detail, updatedAt: formatBeijingDateTime() };
  }

  appendCliText(s) {
    this.agentCliSnapshot.text += s;
    if (this.agentCliSnapshot.text.length > this.maxCliChars) {
      const keep = this.maxCliChars - 120;
      this.agentCliSnapshot.text =
        "…[输出过长，仅保留末尾 " + String(keep) + " 字符]\n\n" + this.agentCliSnapshot.text.slice(-keep);
    }
    this.agentCliSnapshot.updatedAt = formatBeijingDateTime();
  }

  appendAgentCliChunk(chunk, source) {
    if (source === "stderr") {
      let s = String(chunk);
      if (isWebpackNoise(s)) s = "\n[stderr: 已省略一段打包/二进制噪声]\n";
      this.appendCliText(s);
      return;
    }
    this.stdoutLineBuf += String(chunk);
    const lines = this.stdoutLineBuf.split("\n");
    this.stdoutLineBuf = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      this.processStreamJsonLine(trimmed);
    }
  }

  processStreamJsonLine(line) {
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      this.appendCliText(line + "\n");
      return;
    }
    const t = evt.type;
    if (t === "system") {
      this.setAgentPhase("init", `model=${evt.model || ""} mode=${evt.permissionMode || ""}`);
      this.appendCliText(`[系统] 初始化 model=${evt.model || ""} permissionMode=${evt.permissionMode || ""}\n`);
      return;
    }
    if (t === "user") {
      const text = extractText(evt.message);
      this.setAgentPhase("processing", "已发送提示词");
      this.appendCliText(`[用户消息] ${text.length > 200 ? text.slice(0, 200) + "…" : text}\n`);
      return;
    }
    if (t === "thinking") {
      if (evt.subtype === "delta" && evt.text) this.setAgentPhase("thinking", evt.text.slice(0, 120));
      return;
    }
    if (t === "assistant") {
      const text = extractText(evt.message);
      if (text.trim()) {
        this.setAgentPhase("responding", "");
        this.appendCliText(text.endsWith("\n") ? text : text + "\n");
      }
      return;
    }
    if (t === "tool_call") {
      if (evt.subtype === "started") {
        const desc = describeToolCall(evt.tool_call);
        this.setAgentPhase("tool", desc);
        this.appendCliText(`[工具调用] ${desc}\n`);
      } else if (evt.subtype === "completed") {
        const result = describeToolResult(evt.tool_call);
        if (result) this.appendCliText(`  → ${result}\n`);
        this.setAgentPhase("processing", "工具调用完成");
      }
      return;
    }
    if (t === "result") {
      const ok = evt.subtype === "success" && !evt.is_error;
      const dur = evt.duration_ms ? `${(evt.duration_ms / 1000).toFixed(1)}s` : "";
      const usage = evt.usage
        ? ` tokens: in=${evt.usage.inputTokens ?? "?"} out=${evt.usage.outputTokens ?? "?"} cache_read=${evt.usage.cacheReadTokens ?? 0}`
        : "";
      this.setAgentPhase("done", ok ? "成功" : "失败");
      this.appendCliText(`[结果] ${ok ? "✅ 成功" : "❌ 失败"} ${dur}${usage}\n`);
      return;
    }
    this.appendCliText(`[${t || "unknown"}] ${line.slice(0, 300)}\n`);
  }

  beginAgentCliSession(task) {
    const header =
      (this.agentCliSnapshot.text ? "\n\n" : "") +
      `──────────────── task id=${task.id} · ${task.title} ────────────────\n`;
    this.agentCliSnapshot.text = (this.agentCliSnapshot.text || "") + header;
    this.agentCliSnapshot.taskId = task.id;
    this.agentCliSnapshot.updatedAt = formatBeijingDateTime();
    this.stdoutLineBuf = "";
    this.setAgentPhase("init", `task id=${task.id}`);
    if (this.agentCliSnapshot.text.length > this.maxCliChars) {
      const keep = this.maxCliChars - 120;
      this.agentCliSnapshot.text =
        "…[输出过长，已丢弃更早内容]\n\n" + this.agentCliSnapshot.text.slice(-keep);
    }
  }

  // ── Process management ──────────────────────────────────────────

  killAgentTreeBestEffort() {
    const pid = this.lastAgentPid;
    if (!pid || pid < 1) return;
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      } catch {
        /* ignore */
      }
    } else {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* ignore */
      }
    }
  }

  // ── Task JSON resolution ────────────────────────────────────────

  getTaskJsonPath() {
    if (!this.project.taskJsonPath) return null;
    return path.join(this.repoRoot, this.project.taskJsonPath);
  }

  getWizardFilePath() {
    return path.join(this.dataDir, `wizard-${this.project.id}.json`);
  }

  // ── Agent message building ──────────────────────────────────────

  buildAgentMessage(task) {
    const custom = CUSTOM_AGENT_BUILDERS[this.project.id];
    if (custom) return custom(this.repoRoot, this.project, task);

    const steps = Array.isArray(task.steps) ? task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "";
    const tjp = this.getTaskJsonPath();
    return [
      `你是本仓库的 coding agent。工作区根目录：${this.repoRoot}`,
      ``,
      `应用代码在子目录 ${this.project.dir}/。执行 npm 脚本时请在 ${this.project.dir} 目录下。`,
      ``,
      `【本步唯一目标】只完成任务 task id=${task.id}（不要并行做其它 task）：`,
      `标题：${task.title}`,
      task.description ? `说明：${task.description}` : "",
      `验收步骤：`,
      steps,
      ``,
      `硬性要求：`,
      `- 实现完成后：修改 task.json（路径：${tjp}），将 id=${task.id} 的 passes 改为 true。`,
      `- 在 ${this.project.dir} 目录执行 npm run lint 与 npm run build，修复直至通过。`,
      `- 浏览器自动化验收（Playwright E2E）：在 ${this.project.dir}/ 目录下执行 \`npx playwright test --headed\`（或 \`npm run test:e2e\`），它会自动启动 dev server 并打开 Chromium 浏览器窗口，运行 E2E 测试。Playwright 配置已内置 webServer 自动启动 dev。如果浏览器未安装，先执行 \`npx playwright install chromium\`（系统级缓存，不要重复下载）。若 e2e/ 目录下尚无测试文件，需为当前任务的功能编写 Playwright 测试用例。全部测试通过才算验收成功。`,
      `- 单次 git commit 包含本任务相关变更（若使用 git）。`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  buildDecompositionMessage(userPrompt) {
    const tjp = this.getTaskJsonPath();
    return [
      `你是本仓库的 coding agent。工作区根目录：${this.repoRoot}`,
      ``,
      `你的唯一任务是：分析用户的功能需求，将其分解为具体的开发任务，并更新 task.json 文件。`,
      `你不需要实现任何功能代码，只需要完成任务分解和更新 task.json。`,
      ``,
      `用户需求描述：`,
      `---`,
      userPrompt,
      `---`,
      ``,
      `执行步骤：`,
      `1. 浏览 ${this.project.dir}/ 目录的代码结构，了解项目背景。`,
      `2. 阅读当前 task.json（路径：${tjp}），了解已有任务。`,
      `3. 将用户需求分解为若干个可独立完成和验证的开发任务（通常 3-10 个）。`,
      `4. 修改 task.json：`,
      `   - 保留已有 passes: true 的任务不变`,
      `   - 删除已有 passes: false 的旧任务（它们将被新任务替代）`,
      `   - 新任务追加到 tasks 数组末尾`,
      `   - 新任务的 id 从现有最大 id + 1 开始递增`,
      `   - 每个新任务格式：{ "id": N, "title": "简短标题", "description": "说明", "steps": ["验收步骤1", "验收步骤2", ...], "passes": false }`,
      `   - 任务应按依赖顺序排列`,
      ``,
      `硬性要求：`,
      `- 只修改 task.json（路径：${tjp}），不要修改任何应用代码或其他文件`,
      `- 确保 task.json 格式正确，可被 JSON.parse 解析`,
      `- 所有新任务的 passes 必须为 false`,
    ].join("\n");
  }

  // ── Task execution ──────────────────────────────────────────────

  async runOneTask(task) {
    const agentMessage = this.buildAgentMessage(task);
    this.agentPromptSnapshot = { text: agentMessage, taskId: task.id, updatedAt: formatBeijingDateTime() };
    this.beginAgentCliSession(task);
    this.lastAgentPid = undefined;
    this.agentStdinStream = null;
    this.lastAgentOutputAt = Date.now();

    const hooks = {
      onSpawn: (pid, stdin) => {
        this.lastAgentPid = pid;
        this.agentStdinStream = stdin;
      },
      onStdout: (chunk) => {
        if (this.state.status !== "running") return;
        this.lastAgentOutputAt = Date.now();
        this.appendAgentCliChunk(chunk, "stdout");
        const tail = String(chunk).slice(-2000);
        if (tail.trim()) this.log(`[agent stdout] …${tail.slice(-400)}`);
      },
      onStderr: (chunk) => {
        if (this.state.status !== "running") return;
        this.lastAgentOutputAt = Date.now();
        this.appendAgentCliChunk(chunk, "stderr");
        if (isWebpackNoise(chunk)) return;
        const tail = String(chunk).slice(-2000);
        if (tail.trim()) this.log(`[agent stderr] …${tail.slice(-400)}`);
      },
    };

    const result = await runCursorAgent(this.repoRoot, agentMessage, undefined, this.agentTimeoutMs, hooks);

    if (result.code !== 0) {
      return { ok: false, code: result.code, stderr: result.stderr };
    }

    const marked = await this.waitUntilTaskMarkedDone(task.id);
    if (!marked) {
      return {
        ok: false,
        code: 2,
        stderr:
          `Agent 退出码为 0，但 task.json 中 id=${task.id} 的 passes 仍为 false。\n` +
          "可能原因：agent 完成了会话开场但未开始实现；或实现了但漏改标记。\n" +
          "请检查 CLI 输出，如果 agent 已完成实现仅漏改标记，可手动在 task.json 中将 passes 改为 true，然后点「继续下一任务」。",
      };
    }
    return { ok: true, code: 0 };
  }

  async waitUntilTaskMarkedDone(taskId) {
    const attempts = Math.max(1, Math.min(20, Number(process.env.AUTOCODING_PASS_POLL_ATTEMPTS) || 8));
    const delayMs = Math.max(50, Math.min(2000, Number(process.env.AUTOCODING_PASS_POLL_MS) || 250));
    const tjp = this.getTaskJsonPath();
    for (let i = 0; i < attempts; i++) {
      if (isTaskDone(this.repoRoot, taskId, tjp)) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return isTaskDone(this.repoRoot, taskId, tjp);
  }

  async taskExecutionLoop() {
    for (;;) {
      if (this.state.status !== "running") break;
      if (this.resetRequested) {
        this.resetRequested = false;
        this.state.lastError = null;
        await this.saveState();
        this.log("已应用重置请求，worker 结束。");
        break;
      }

      const tjp = this.getTaskJsonPath();
      if (!tjp) {
        this.state.lastError = `项目 ${this.project.id} 未配置 task.json，无法执行任务。`;
        this.log(this.state.lastError);
        this.state.status = "idle";
        await this.saveState();
        break;
      }
      const queue = loadIncompleteTasks(this.repoRoot, tjp);
      if (queue.length === 0) {
        this.state.status = "completed";
        this.state.lastError = null;
        this.state.lastTaskId = null;
        await this.saveState();
        this.log("task.json 中已全部 passes:true，队列完成。");
        break;
      }

      const head = queue[0];
      this.state.lastTaskId = head.id;
      this.state.lastError = null;
      await this.saveState();
      this.log(`开始任务 id=${head.id}：${head.title}`);

      const outcome = await this.runOneTask(head);

      if (this.resetRequested) {
        this.resetRequested = false;
        this.state.lastError = null;
        await this.saveState();
        this.log("已应用重置，worker 结束。");
        break;
      }
      if (this.state.status === "paused") {
        this.log(`已暂停（任务 id=${head.id}）。`);
        break;
      }
      if (!outcome.ok) {
        this.state.lastError =
          outcome.code === 2
            ? outcome.stderr
            : `Agent 失败：任务 id=${head.id}，退出码 ${outcome.code}。${outcome.stderr ? "\n" + outcome.stderr.slice(-2000) : ""}`;
        this.log(this.state.lastError);
        this.state.status = "idle";
        await this.saveState();
        break;
      }

      this.log(`任务 id=${head.id} 已完成（task.json 已标记 passes）。`);

      if (!this.autoAdvance) {
        this.state.status = "idle";
        const remaining = loadIncompleteTasks(this.repoRoot, tjp);
        if (remaining.length > 0) {
          this.log(
            `逐任务模式：任务 id=${head.id} 完成后已暂停。剩余 ${remaining.length} 个任务，下一个：id=${remaining[0].id}（${remaining[0].title}）。请在面板确认后点击「继续下一任务」。`,
          );
        } else {
          this.state.status = "completed";
          this.log("所有任务已完成。");
        }
        await this.saveState();
        break;
      }
    }
  }

  async workerLoop() {
    if (this.workerRunning) return;
    this.workerRunning = true;
    try {
      await this.taskExecutionLoop();
      if (this.state.status === "running") {
        this.state.status = "idle";
        await this.saveState();
      }
    } finally {
      this.workerRunning = false;
      this.lastAgentPid = undefined;
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      this.stdoutLineBuf = "";
      this.setAgentPhase("idle", "");
    }
  }

  async runDecomposition(userPrompt) {
    const decompMessage = this.buildDecompositionMessage(userPrompt);
    this.agentPromptSnapshot = { text: decompMessage, taskId: null, updatedAt: formatBeijingDateTime() };
    const header =
      (this.agentCliSnapshot.text ? "\n\n" : "") +
      `──────────────── 需求分解阶段 ────────────────\n`;
    this.agentCliSnapshot.text = (this.agentCliSnapshot.text || "") + header;
    this.agentCliSnapshot.taskId = null;
    this.agentCliSnapshot.updatedAt = formatBeijingDateTime();
    this.stdoutLineBuf = "";
    this.setAgentPhase("init", "需求分解");

    this.lastAgentPid = undefined;
    this.agentStdinStream = null;
    this.lastAgentOutputAt = Date.now();
    const hooks = {
      onSpawn: (pid, stdin) => {
        this.lastAgentPid = pid;
        this.agentStdinStream = stdin;
      },
      onStdout: (chunk) => {
        if (this.state.status !== "running") return;
        this.lastAgentOutputAt = Date.now();
        this.appendAgentCliChunk(chunk, "stdout");
        const tail = String(chunk).slice(-2000);
        if (tail.trim()) this.log(`[agent stdout] …${tail.slice(-400)}`);
      },
      onStderr: (chunk) => {
        if (this.state.status !== "running") return;
        this.lastAgentOutputAt = Date.now();
        this.appendAgentCliChunk(chunk, "stderr");
        if (isWebpackNoise(chunk)) return;
        const tail = String(chunk).slice(-2000);
        if (tail.trim()) this.log(`[agent stderr] …${tail.slice(-400)}`);
      },
    };

    const result = await runCursorAgent(this.repoRoot, decompMessage, undefined, this.agentTimeoutMs, hooks);

    if (this.state.status === "paused" || this.resetRequested) return false;

    if (result.code !== 0) {
      this.state.lastError = `需求分解失败：Agent 退出码 ${result.code}。${result.stderr ? "\n" + result.stderr.slice(-2000) : ""}`;
      this.log(this.state.lastError);
      this.state.status = "idle";
      await this.saveState();
      return false;
    }

    const tjp = this.getTaskJsonPath();
    const queue = loadIncompleteTasks(this.repoRoot, tjp);
    if (queue.length === 0) {
      this.state.lastError =
        "需求分解 Agent 已退出，但 task.json 中没有 passes: false 的新任务。请检查 CLI 输出。";
      this.log(this.state.lastError);
      this.state.status = "idle";
      await this.saveState();
      return false;
    }

    this.log(`[自定义任务] 需求分解完成，生成了 ${queue.length} 个待执行任务。`);
    return true;
  }

  async customTaskFlow(userPrompt) {
    if (this.workerRunning) return;
    this.workerRunning = true;
    try {
      this.log(`[自定义任务] 开始需求分解…`);
      const ok = await this.runDecomposition(userPrompt);
      if (!ok) {
        if (this.resetRequested) {
          this.resetRequested = false;
          this.state.lastError = null;
          await this.saveState();
          this.log("已应用重置请求，worker 结束。");
        }
        return;
      }
      if (this.state.status !== "running") return;
      this.log(`[自定义任务] 进入任务执行阶段…`);
      await this.taskExecutionLoop();
      if (this.state.status === "running") {
        this.state.status = "idle";
        await this.saveState();
      }
    } finally {
      this.workerRunning = false;
      this.lastAgentPid = undefined;
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      this.stdoutLineBuf = "";
      this.setAgentPhase("idle", "");
    }
  }

  // ── Project initialization ───────────────────────────────────────

  buildWizardAnalyzeMessage(description) {
    const filePath = this.getWizardFilePath();
    return [
      `你是项目需求分析助手。你的唯一任务是：根据用户的项目描述，生成一组有针对性的后续问题，帮助充分了解需求。`,
      ``,
      `用户的项目描述：`,
      `---`,
      description,
      `---`,
      ``,
      `请仔细分析这个项目描述，然后生成 4-8 个针对性问题。`,
      `不同类型的项目需要不同的问题，例如：`,
      `- 网页应用 → 技术栈、用户认证、数据存储、响应式需求、页面路由等`,
      `- 游戏 → 游戏引擎/框架、游戏机制、画面风格、目标平台、操作方式等`,
      `- 工具/CLI → 使用场景、输入输出格式、依赖系统、安装方式等`,
      `- API 服务 → 协议、认证方式、数据模型、部署环境等`,
      `- 移动应用 → 原生/跨平台、目标系统、离线需求、推送通知等`,
      ``,
      `请将问题列表以纯 JSON 格式写入文件：${filePath}`,
      ``,
      `JSON 格式（数组）：`,
      `[`,
      `  {`,
      `    "id": "q1",`,
      `    "label": "问题文本（中文）",`,
      `    "type": "text",`,
      `    "placeholder": "输入提示示例"`,
      `  },`,
      `  {`,
      `    "id": "q2",`,
      `    "label": "问题文本",`,
      `    "type": "textarea",`,
      `    "placeholder": "可列出多项，每行一个"`,
      `  },`,
      `  {`,
      `    "id": "q3",`,
      `    "label": "问题文本",`,
      `    "type": "select",`,
      `    "placeholder": "请选择",`,
      `    "options": ["选项1", "选项2", "选项3"]`,
      `  }`,
      `]`,
      ``,
      `type 可以是：`,
      `- "text": 单行输入`,
      `- "textarea": 多行输入（适合列表或详细描述）`,
      `- "select": 下拉选择（需额外提供 "options" 数组）`,
      ``,
      `要求：`,
      `- 只生成问题并写入上述文件，不要做其他任何事情`,
      `- 不要创建或修改任何代码文件`,
      `- 问题应该具体有针对性，根据项目类型智能选择要问的维度`,
      `- 避免过于笼统的问题（如"还有什么需求"）`,
      `- placeholder 中应给出有帮助的示例值`,
      `- 确保 JSON 格式正确`,
    ].join("\n");
  }

  buildInitMessage(wizardData) {
    const { description, answers } = wizardData;
    const tjp = this.getTaskJsonPath();

    let qaSection = "";
    if (answers && answers.length > 0) {
      qaSection = [
        ``,
        `用户回答的补充问题：`,
        ...answers.map((a) => `Q: ${a.question}\nA: ${a.answer}`),
      ].join("\n\n");
    }

    return [
      `你是本仓库的 coding agent。工作区根目录：${this.repoRoot}`,
      ``,
      `你的任务是为一个全新的项目完成完整的初始化设置。`,
      ``,
      `项目信息：`,
      `- 名称：${this.project.name}`,
      `- 目录：${this.project.dir}/（已创建，位于工作区根目录下）`,
      `- 用户描述：${description}`,
      qaSection,
      ``,
      `请按以下步骤执行：`,
      ``,
      `1. 项目脚手架：在 ${this.project.dir}/ 目录下创建完整的项目脚手架`,
      `   - 根据用户需求选择合适的技术栈初始化项目`,
      `   - 确保 package.json 包含必要的 scripts（dev, build, lint, test:e2e, test:e2e:headed 等）`,
      `   - 安装所有基础依赖（npm install），安装时设置 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 避免重复下载浏览器`,
      `   - 添加 @playwright/test（版本 ^1.59.1）为 devDependency`,
      `   - 创建 playwright.config.ts（testDir: "./e2e"，webServer 自动启动 dev server，端口与现有项目错开）`,
      `   - 创建 e2e/ 目录`,
      `   - 确保 npm run dev 可以正常启动`,
      ``,
      `2. 架构文档：在 ${this.project.dir}/ 目录下创建 architecture.md`,
      `   - 项目概述与技术栈说明`,
      `   - 目录结构规划`,
      `   - 核心模块说明`,
      ``,
      `3. 任务分解：创建 task.json（路径：${tjp}）`,
      `   格式：`,
      `   {`,
      `     "project": "${this.project.name}",`,
      `     "description": "...",`,
      `     "tasks": [`,
      `       { "id": 1, "title": "...", "description": "...", "steps": ["验收步骤1", ...], "passes": true },`,
      `       { "id": 2, "title": "...", "description": "...", "steps": ["验收步骤1", ...], "passes": false },`,
      `       ...`,
      `     ]`,
      `   }`,
      `   要求：`,
      `   - 将项目开发分解为 5-15 个具体的、可独立完成的任务`,
      `   - 第 1 个任务为「脚手架与基础配置」，因为你已完成脚手架，将其 passes 设为 true`,
      `   - 后续任务按依赖顺序排列，从基础组件到复杂功能`,
      `   - 最后一个任务为「收尾与整体验收」`,
      `   - 每个任务的 steps 应具体、可执行、可验证`,
      `   - 除第 1 个任务外，所有任务的 passes 必须为 false`,
      ``,
      `4. 验证：确保以下命令在 ${this.project.dir}/ 目录下可成功执行`,
      `   - npm install（若未执行）`,
      `   - npm run dev（启动开发服务器，确认可运行后可关闭）`,
      ``,
      `5. 完成后做一次 git commit，消息说明「初始化 ${this.project.name} 项目脚手架与任务分解」`,
      ``,
      `硬性要求：`,
      `- task.json 路径必须为 ${tjp}`,
      `- task.json 格式必须正确，可被 JSON.parse 解析`,
      `- 第一个任务（脚手架）的 passes 设为 true`,
      `- 其他所有任务的 passes 必须为 false`,
      `- 至少包含 5 个任务`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async wizardAnalyzeFlow(description) {
    if (this.workerRunning) return;
    this.workerRunning = true;
    try {
      this.wizardDescription = description;
      this.wizardQuestions = null;
      this.log(`[需求分析] 开始分析项目需求…`);

      const message = this.buildWizardAnalyzeMessage(description);
      this.agentPromptSnapshot = { text: message, taskId: null, updatedAt: formatBeijingDateTime() };
      this.agentCliSnapshot = {
        text: `──────────────── 需求分析 · ${this.project.name} ────────────────\n`,
        taskId: null,
        updatedAt: formatBeijingDateTime(),
      };
      this.stdoutLineBuf = "";
      this.setAgentPhase("init", "需求分析");

      this.lastAgentPid = undefined;
      this.agentStdinStream = null;
      this.lastAgentOutputAt = Date.now();
      const hooks = {
        onSpawn: (pid, stdin) => { this.lastAgentPid = pid; this.agentStdinStream = stdin; },
        onStdout: (chunk) => {
          if (this.state.status !== "running") return;
          this.lastAgentOutputAt = Date.now();
          this.appendAgentCliChunk(chunk, "stdout");
          const tail = String(chunk).slice(-2000);
          if (tail.trim()) this.log(`[agent stdout] …${tail.slice(-400)}`);
        },
        onStderr: (chunk) => {
          if (this.state.status !== "running") return;
          this.lastAgentOutputAt = Date.now();
          this.appendAgentCliChunk(chunk, "stderr");
          if (isWebpackNoise(chunk)) return;
          const tail = String(chunk).slice(-2000);
          if (tail.trim()) this.log(`[agent stderr] …${tail.slice(-400)}`);
        },
      };

      const result = await runCursorAgent(this.repoRoot, message, undefined, this.agentTimeoutMs, hooks);

      if (this.state.status === "paused" || this.resetRequested) {
        if (this.resetRequested) {
          this.resetRequested = false;
          this.state.lastError = null;
          await this.saveState();
          this.log("已应用重置请求，worker 结束。");
        }
        return;
      }

      if (result.code !== 0) {
        this.state.lastError = `需求分析失败：Agent 退出码 ${result.code}。${result.stderr ? "\n" + result.stderr.slice(-2000) : ""}`;
        this.log(this.state.lastError);
        this.state.status = "idle";
        await this.saveState();
        return;
      }

      const wizFile = this.getWizardFilePath();
      try {
        const raw = fs.readFileSync(wizFile, "utf8");
        this.wizardQuestions = JSON.parse(raw);
        if (!Array.isArray(this.wizardQuestions)) {
          throw new Error("问题文件内容不是 JSON 数组");
        }
        this.log(`[需求分析] 完成，生成了 ${this.wizardQuestions.length} 个针对性问题。`);
      } catch (e) {
        this.state.lastError = `需求分析完成但问题文件格式错误：${e.message}`;
        this.wizardQuestions = null;
        this.log(this.state.lastError);
      }

      this.state.status = "idle";
      await this.saveState();
    } finally {
      this.workerRunning = false;
      this.lastAgentPid = undefined;
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      this.stdoutLineBuf = "";
      this.setAgentPhase("idle", "");
    }
  }

  async initProjectFlow(wizardData) {
    if (this.workerRunning) return;
    this.workerRunning = true;
    try {
      this.log(`[项目初始化] 开始…`);
      const message = this.buildInitMessage(wizardData);
      this.agentPromptSnapshot = { text: message, taskId: null, updatedAt: formatBeijingDateTime() };
      this.agentCliSnapshot = {
        text: `──────────────── 项目初始化 · ${this.project.name} ────────────────\n`,
        taskId: null,
        updatedAt: formatBeijingDateTime(),
      };
      this.stdoutLineBuf = "";
      this.setAgentPhase("init", "项目初始化");

      this.lastAgentPid = undefined;
      this.agentStdinStream = null;
      this.lastAgentOutputAt = Date.now();
      const hooks = {
        onSpawn: (pid, stdin) => { this.lastAgentPid = pid; this.agentStdinStream = stdin; },
        onStdout: (chunk) => {
          if (this.state.status !== "running") return;
          this.lastAgentOutputAt = Date.now();
          this.appendAgentCliChunk(chunk, "stdout");
          const tail = String(chunk).slice(-2000);
          if (tail.trim()) this.log(`[agent stdout] …${tail.slice(-400)}`);
        },
        onStderr: (chunk) => {
          if (this.state.status !== "running") return;
          this.lastAgentOutputAt = Date.now();
          this.appendAgentCliChunk(chunk, "stderr");
          if (isWebpackNoise(chunk)) return;
          const tail = String(chunk).slice(-2000);
          if (tail.trim()) this.log(`[agent stderr] …${tail.slice(-400)}`);
        },
      };

      const result = await runCursorAgent(this.repoRoot, message, undefined, this.agentTimeoutMs, hooks);

      if (this.state.status === "paused" || this.resetRequested) {
        if (this.resetRequested) {
          this.resetRequested = false;
          this.state.lastError = null;
          await this.saveState();
          this.log("已应用重置请求，worker 结束。");
        }
        return;
      }

      if (result.code !== 0) {
        this.state.lastError = `项目初始化失败：Agent 退出码 ${result.code}。${result.stderr ? "\n" + result.stderr.slice(-2000) : ""}`;
        this.log(this.state.lastError);
        this.state.status = "idle";
        await this.saveState();
        return;
      }

      const tjp = this.getTaskJsonPath();
      try {
        const raw = fs.readFileSync(tjp, "utf8");
        const data = JSON.parse(raw);
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];
        const incomplete = tasks.filter((t) => t.passes === false);
        this.log(`[项目初始化] 完成！task.json 共 ${tasks.length} 个任务，${incomplete.length} 个待执行。`);
      } catch (e) {
        this.state.lastError =
          `项目初始化 Agent 已退出，但 task.json 未正确创建或格式错误。请检查 CLI 输出。\n${e.message}`;
        this.log(this.state.lastError);
      }

      this.wizardDescription = null;
      this.wizardQuestions = null;
      try { fs.unlinkSync(this.getWizardFilePath()); } catch {}

      this.state.status = "idle";
      await this.saveState();
    } finally {
      this.workerRunning = false;
      this.lastAgentPid = undefined;
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      this.stdoutLineBuf = "";
      this.setAgentPhase("idle", "");
    }
  }

  // ── Dev server management ───────────────────────────────────────

  startDevServer() {
    if (this.devServerProc && this.devServerRunning) return { ok: false, error: "开发服务器已在运行中" };
    this.stopDevServer();

    const projectDir = path.join(this.repoRoot, this.project.dir);
    const port = inferDevServerPort(projectDir);
    const killed = killProcessesListeningOnPort(port);
    if (killed.length) {
      this.log(`[dev-server] 端口 ${port} 曾被占用，已结束进程 pid=${killed.join(", ")}`);
    }

    const proc = spawn("npm", ["run", "dev"], {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: true,
    });

    this.devServerProc = proc;
    this.devServerRunning = true;
    this.devServerLog = [];
    const maxLogLines = 200;

    const pushLog = (line) => {
      this.devServerLog.push(line);
      while (this.devServerLog.length > maxLogLines) this.devServerLog.shift();
    };

    proc.stdout.on("data", (chunk) => {
      const lines = String(chunk).split(/\r?\n/).filter(Boolean);
      for (const l of lines) pushLog(l);
    });
    proc.stderr.on("data", (chunk) => {
      const lines = String(chunk).split(/\r?\n/).filter(Boolean);
      for (const l of lines) pushLog(`[stderr] ${l}`);
    });
    proc.on("error", (err) => {
      pushLog(`[error] ${err.message}`);
      this.devServerRunning = false;
      this.devServerProc = null;
    });
    proc.on("close", (code) => {
      pushLog(`[exit] 进程退出，退出码 ${code}`);
      this.devServerRunning = false;
      this.devServerProc = null;
    });

    this.log(`[dev-server] 已启动开发服务器 (pid=${proc.pid})，目录：${projectDir}`);
    return { ok: true, pid: proc.pid };
  }

  stopDevServer() {
    if (!this.devServerProc) {
      this.devServerRunning = false;
      return { ok: true, message: "开发服务器未在运行" };
    }
    const pid = this.devServerProc.pid;
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      } catch { /* ignore */ }
    } else {
      try { process.kill(pid, "SIGTERM"); } catch { /* ignore */ }
    }
    this.devServerProc = null;
    this.devServerRunning = false;
    this.log(`[dev-server] 已停止开发服务器 (pid=${pid})`);
    return { ok: true };
  }

  restartDevServer() {
    this.stopDevServer();
    return this.startDevServer();
  }

  // ── Control actions ─────────────────────────────────────────────

  async handleControl(body) {
    const action = body?.action;

    if (action === "start") {
      if (this.state.status === "running") return { ok: false, error: "已在运行中" };
      const tjp = this.getTaskJsonPath();
      if (!tjp) return { ok: false, error: `项目 ${this.project.id} 未配置 task.json，请先配置任务列表。` };
      const queue = loadIncompleteTasks(this.repoRoot, tjp);
      if (queue.length === 0) return { ok: false, error: "没有未完成任务（task.json 全部 passes:true）。" };
      this.state.status = "running";
      this.state.lastError = null;
      await this.saveState();
      this.workerLoop().catch(async (e) => {
        this.log(`worker 异常: ${e?.message || e}`);
        this.state.status = "idle";
        this.state.lastError = String(e?.message || e);
        try {
          await this.saveState();
        } catch (err) {
          this.log(`保存状态失败: ${err.message}`);
        }
      });
      return { ok: true };
    }

    if (action === "pause") {
      if (this.state.status !== "running") return { ok: true, message: "当前未在运行" };
      this.state.status = "paused";
      this.killAgentTreeBestEffort();
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      this.setAgentPhase("idle", "已暂停");
      await this.saveState();
      this.log("用户请求暂停。");
      return { ok: true };
    }

    if (action === "reset") {
      const running = this.state.status === "running";
      this.resetRequested = running;
      this.killAgentTreeBestEffort();
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      this.setAgentPhase("idle", "已重置");
      this.state.lastError = null;
      this.state.lastTaskId = null;
      this.state.status = "idle";
      this.agentPromptSnapshot = { text: "", taskId: null, updatedAt: null };
      this.agentCliSnapshot = { text: "", taskId: null, updatedAt: null };
      this.wizardDescription = null;
      this.wizardQuestions = null;
      try { fs.unlinkSync(this.getWizardFilePath()); } catch {}
      await this.saveState();
      this.log("状态已重置为空闲。");
      return { ok: true };
    }

    if (action === "reset-link-game") {
      if (this.project.id !== "link-game") return { ok: false, error: "此操作仅适用于连连看项目" };
      const running = this.state.status === "running";
      this.resetRequested = running;
      this.killAgentTreeBestEffort();
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      this.setAgentPhase("idle", "已清理连连看项目");
      this.state.lastError = null;
      this.state.lastTaskId = null;
      this.state.status = "idle";
      this.agentPromptSnapshot = { text: "", taskId: null, updatedAt: null };
      this.agentCliSnapshot = { text: "", taskId: null, updatedAt: null };
      try {
        await performLinkGameProjectReset(this.repoRoot);
      } catch (e) {
        const msg = String(e?.message || e);
        this.log(`连连看项目清理失败: ${msg}`);
        await this.saveState();
        return { ok: false, error: msg };
      }
      await this.saveState();
      this.log("已清理连连看项目并重置面板。");
      return { ok: true };
    }

    if (action === "custom-task") {
      if (this.state.status === "running") return { ok: false, error: "已在运行中" };
      const prompt = body?.prompt;
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return { ok: false, error: "请提供功能描述（prompt 字段）" };
      }
      this.state.status = "running";
      this.state.lastError = null;
      this.agentPromptSnapshot = { text: "", taskId: null, updatedAt: null };
      this.agentCliSnapshot = { text: "", taskId: null, updatedAt: null };
      await this.saveState();
      this.customTaskFlow(prompt.trim()).catch(async (e) => {
        this.log(`自定义任务流程异常: ${e?.message || e}`);
        this.state.status = "idle";
        this.state.lastError = String(e?.message || e);
        try {
          await this.saveState();
        } catch (err) {
          this.log(`保存状态失败: ${err.message}`);
        }
      });
      return { ok: true };
    }

    if (action === "wizard-analyze") {
      if (this.state.status === "running") return { ok: false, error: "已在运行中" };
      const desc = body?.description;
      if (!desc || typeof desc !== "string" || !desc.trim()) {
        return { ok: false, error: "请描述你想要构建的项目" };
      }
      this.state.status = "running";
      this.state.lastError = null;
      this.agentPromptSnapshot = { text: "", taskId: null, updatedAt: null };
      this.agentCliSnapshot = { text: "", taskId: null, updatedAt: null };
      await this.saveState();
      this.wizardAnalyzeFlow(desc.trim()).catch(async (e) => {
        this.log(`需求分析异常: ${e?.message || e}`);
        this.state.status = "idle";
        this.state.lastError = String(e?.message || e);
        try { await this.saveState(); } catch (err) { this.log(`保存状态失败: ${err.message}`); }
      });
      return { ok: true };
    }

    if (action === "wizard-reset") {
      this.wizardDescription = null;
      this.wizardQuestions = null;
      try { fs.unlinkSync(this.getWizardFilePath()); } catch {}
      this.log("向导已重置。");
      return { ok: true };
    }

    if (action === "init-project") {
      if (this.state.status === "running") return { ok: false, error: "已在运行中" };
      const description = this.wizardDescription || body?.description;
      if (!description || typeof description !== "string" || !description.trim()) {
        return { ok: false, error: "请先完成需求分析（缺少项目描述）" };
      }
      const answers = body?.answers || [];
      this.state.status = "running";
      this.state.lastError = null;
      this.agentPromptSnapshot = { text: "", taskId: null, updatedAt: null };
      this.agentCliSnapshot = { text: "", taskId: null, updatedAt: null };
      await this.saveState();
      this.initProjectFlow({
        description: description.trim(),
        answers,
      }).catch(async (e) => {
        this.log(`项目初始化异常: ${e?.message || e}`);
        this.state.status = "idle";
        this.state.lastError = String(e?.message || e);
        try { await this.saveState(); } catch (err) { this.log(`保存状态失败: ${err.message}`); }
      });
      return { ok: true };
    }

    if (action === "set-auto-advance") {
      this.autoAdvance = !!body?.value;
      this.log(`自动推进模式已${this.autoAdvance ? "开启" : "关闭"}。`);
      return { ok: true, autoAdvance: this.autoAdvance };
    }

    if (action === "start-dev-server") {
      return this.startDevServer();
    }

    if (action === "stop-dev-server") {
      return this.stopDevServer();
    }

    if (action === "restart-dev-server") {
      return this.restartDevServer();
    }

    return { ok: false, error: "未知 action" };
  }

  // ── Agent stdin ─────────────────────────────────────────────────

  handleAgentInput(text) {
    if (this.state.status !== "running") return { ok: false, error: "当前没有运行中的任务" };
    if (!this.agentStdinStream || this.agentStdinStream.destroyed) {
      return { ok: false, error: "Agent 进程的 stdin 不可用（进程可能已退出）" };
    }
    const display = text.length > 200 ? text.slice(0, 200) + "…" : text;
    try {
      const ok = this.agentStdinStream.write(text + "\n", "utf8", (err) => {
        if (err) this.log(`[stdin write callback error] ${err.message}`);
      });
      if (!ok) this.log(`[stdin] 缓冲区满，数据已排队。`);
      this.lastAgentOutputAt = Date.now();
      this.log(`[用户输入] ${display}`);
      this.appendAgentCliChunk(`\n📝 [用户输入] ${text}\n`, "stdout");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `写入 stdin 失败: ${e?.message || e}` };
    }
  }

  // ── Status ──────────────────────────────────────────────────────

  getStatus() {
    const tjp = this.getTaskJsonPath();
    let pending = [];
    let totalTaskCount = 0;
    try {
      if (tjp) {
        const raw = fs.readFileSync(tjp, "utf8");
        const data = JSON.parse(raw);
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];
        totalTaskCount = tasks.length;
        pending = tasks
          .filter((t) => t && t.passes === false)
          .sort((a, b) => Number(a.id) - Number(b.id));
      }
    } catch {
      /* ok */
    }
    const projectDirForDev = path.join(this.repoRoot, this.project.dir);
    const devServerUrl = this.devServerRunning
      ? `http://127.0.0.1:${inferDevServerPort(projectDirForDev)}/`
      : null;
    return {
      ok: true,
      projectId: this.project.id,
      repoRoot: this.repoRoot,
      totalTaskCount,
      pendingCount: pending.length,
      nextTask: pending[0] ? { id: pending[0].id, title: pending[0].title } : null,
      status: this.state.status,
      lastError: this.state.lastError,
      lastTaskId: this.state.lastTaskId,
      recentLog: this.logLines,
      agentTimeoutMs: this.agentTimeoutMs,
      agentPrompt: this.agentPromptSnapshot.text || null,
      agentPromptTaskId: this.agentPromptSnapshot.taskId,
      agentPromptUpdatedAt: this.agentPromptSnapshot.updatedAt,
      agentCliText: this.agentCliSnapshot.text || null,
      agentCliTaskId: this.agentCliSnapshot.taskId,
      agentCliUpdatedAt: this.agentCliSnapshot.updatedAt,
      agentCliMaxChars: this.maxCliChars,
      autoAdvance: this.autoAdvance,
      agentPhase: this.state.status === "running" ? this.agentPhase : null,
      agentStdinAvailable: !!(this.agentStdinStream && !this.agentStdinStream.destroyed),
      wizardDescription: this.wizardDescription || null,
      wizardQuestions: this.wizardQuestions || null,
      pausedHelp:
        this.state.status === "paused"
          ? "当前为「已暂停」：队列不会继续跑。请点击「开始全自动」继续；无需重置。"
          : null,
      devServerRunning: this.devServerRunning,
      devServerPid: this.devServerProc?.pid ?? null,
      devServerUrl,
      devServerLog: this.devServerLog.slice(-50),
    };
  }

  // ── Destroy ─────────────────────────────────────────────────────

  destroy() {
    this.killAgentTreeBestEffort();
    this.agentStdinStream = null;
    this.stopDevServer();
  }
}
