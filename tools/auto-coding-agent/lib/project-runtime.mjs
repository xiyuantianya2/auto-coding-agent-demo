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
import {
  loadIncompleteTasks,
  isTaskDoneSafe,
  isTaskIncomplete,
  tryLoadIncompleteTasks,
  isLastPlannedTask,
} from "./task-queue.mjs";
import { performProjectCleanup } from "./project-cleanup.mjs";
import { formatBeijingDateTime } from "./beijing-time.mjs";
import { appendRequirementsArchive } from "./requirements-archive.mjs";
import {
  loadModulePlan,
  saveModulePlan,
  hasModulePlan,
  deriveModuleTaskJsonPath,
  getNextPendingModule,
  areDependenciesMet,
  setModuleStatus,
  getModulePlanSummary,
  topologicalSort,
} from "./module-scheduler.mjs";
import {
  buildProjectDecompositionPrompt,
  buildModuleInitializerPrompt,
  buildModuleTaskMessage,
} from "./module-prompts.mjs";

const MAX_LOG_LINES = 900;

/** 单次 Agent 调用墙上时钟默认上限（大型项目 lint/build/Playwright 常超过 45 分钟）。 */
export const DEFAULT_AGENT_TIMEOUT_MS = 90 * 60 * 1000;

/** 无 CLI 输出时触发看门狗终止的默认阈值；长时间 E2E 可能许久无新行。 */
const DEFAULT_AGENT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * 解析单次 Agent 超时：显式参数优先，否则 `AUTOCODING_AGENT_TIMEOUT_MS`，否则 {@link DEFAULT_AGENT_TIMEOUT_MS}。
 * @param {number | undefined} explicit
 * @returns {number}
 */
export function resolveAgentTimeoutMs(explicit) {
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit > 0) {
    return Math.max(60_000, explicit);
  }
  const fromEnv = Number(process.env.AUTOCODING_AGENT_TIMEOUT_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.max(60_000, fromEnv);
  }
  return DEFAULT_AGENT_TIMEOUT_MS;
}

/**
 * `AUTOCODING_AGENT_IDLE_TIMEOUT_MS`：无输出多久后强杀；`0` 表示禁用。
 * @returns {number}
 */
function resolveAgentIdleTimeoutMs() {
  const raw = process.env.AUTOCODING_AGENT_IDLE_TIMEOUT_MS;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_AGENT_IDLE_TIMEOUT_MS;
}

// ── project-specific agent prompt builders ──────────────────────────

const CUSTOM_AGENT_BUILDERS = {
  "link-game": (repoRoot, project, task, lastInPlan) => {
    const steps = Array.isArray(task.steps) ? task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "";
    const testBlock = lastInPlan
      ? [
          `4. 单元/集成测试：在 link-game 目录执行 \`npm test\` 确保全部通过（仅含快速单元/集成测试，不含 Playwright E2E）。先跑单元测试再跑 E2E。`,
          `5. 浏览器自动化验收（Playwright E2E）：在 link-game/ 目录下执行 \`npm run test:e2e\`，它会自动启动 dev server 并运行 E2E 测试。如果浏览器未安装，先执行 \`npx playwright install chromium\`。全部测试通过才算验收成功。`,
          `6. **以上全部通过后**，才可以修改仓库根目录下的 task.json（路径：${path.join(repoRoot, "task.json")}），将 id=${task.id} 的 passes 改为 true；不要只改子目录里的副本。`,
        ]
      : [
          `4. 单元/集成测试（**仅本任务范围**）：针对本任务新增或修改的代码，只运行相关的 Vitest 文件（\`npx vitest run <路径>\`），**不要**执行完整的 \`npm test\`。`,
          `5. 浏览器 E2E（**仅本任务范围**）：若本任务涉及 UI/浏览器，只运行相关的 Playwright 文件（\`npx playwright test <路径>\`），**不要**执行完整的 \`npm run test:e2e\`。若本任务纯逻辑、不涉及页面，可跳过 E2E。`,
          `6. **以上全部通过后**，才可以修改仓库根目录下的 task.json（路径：${path.join(repoRoot, "task.json")}），将 id=${task.id} 的 passes 改为 true；不要只改子目录里的副本。`,
        ];
    const effNote = lastInPlan
      ? [
          `- **禁止重复跑全量测试**：步骤 4 的 \`npm test\` 和步骤 5 的 \`npm run test:e2e\` 各只需运行**一次**。不要在修复代码后从头重新跑全量——只重跑失败的那个步骤即可。`,
          `- **不要在 vitest 测试中嵌套 Playwright**：不要编写通过 spawn/exec 调用 \`npx playwright test\` 的 vitest 测试。vitest 只做纯逻辑单元测试，E2E 由 Playwright 自身运行。`,
          `- **修复失败时只重跑最小范围**：如果某个特定测试文件失败，只跑该文件，不要反复跑全量套件。`,
        ]
      : [
          `- **本任务不是需求列表中的最后一项**：不要运行完整 \`npm test\` 或全量 \`npm run test:e2e\`；整体验收在最后一项任务执行。`,
          `- **不要在 vitest 测试中嵌套 Playwright**：不要编写通过 spawn/exec 调用 \`npx playwright test\` 的 vitest 测试。`,
          `- **修复失败时只重跑最小范围**：只跑与本任务相关的测试文件。`,
        ];
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
      `硬性要求（必须按顺序执行，且仅在前置步骤全部通过后才进入下一步）：`,
      `- 严格按 CLAUDE.md 的会话流程：先确认基线（init 或 link-game 下 dev），再实现本任务。`,
      `1. 实现本任务的功能代码。`,
      `2. 更新 progress.txt 记录本任务。`,
      `3. 在 link-game 目录执行 npm run lint 与 npm run build，修复直至通过。`,
      ...testBlock,
      `   ⚠️ 如果 lint、build、单元测试或 E2E 测试有任何一项未通过，**绝对不要**将 passes 改为 true。宁可留 passes: false 让自动化系统重试，也不要在测试未通过时标记为 true。`,
      `- 单次 git commit 包含本任务相关变更（若使用 git）。`,
      ``,
      `实现策略原则：`,
      `- **先跑通再优化**：优先选择简单、可靠、性能可控的实现，宁可牺牲理论最优性也要保证在合理时间内（单次调用通常 < 5 秒）产出合格结果。例如：随机生成类功能不必追求极限参数（最少给定数、最高压缩率等），保留适量冗余既能大幅加速生成又不影响功能正确性。`,
      `- **不要自行添加极限约束**：若任务描述中没有明确要求「最少」「最小」「最优」等极限目标，实现时不要自行引入。生成/搜索/优化类算法应以「足够好且快速」为目标，而非「理论最优但可能超时」。`,
      `- **耗时操作要有保底退出**：任何可能长时间运行的循环/递归（生成器重试、回溯搜索、迭代优化），必须设置合理的最大尝试次数和/或墙上时钟超时（如 maxAttempts、maxElapsedMs），超限时返回当前最优可用结果或抛出明确错误，绝不能无限循环。`,
      ``,
      `测试编写注意事项：`,
      `- 性能敏感路径：若被测功能有已知的高耗时路径，测试应仅对快速路径做全量断言，对慢路径仅做结构冒烟或跳过，并设置充裕的 timeout。`,
      `- Mock 可靠性：对 Node 内置模块做 spy/mock 时，ESM 具名导入绑定的是导入时引用，vi.spyOn 不会生效。应使用命名空间导入或 vi.mock 整体替换。`,
      `- E2E flaky：若并行下偶发失败，优先标记 retries 或降低并发，而非忽略。`,
      ``,
      `测试执行效率（严格遵守，防止超时）：`,
      ...effNote,
    ]
      .filter(Boolean)
      .join("\n");
  },
};

// ── pure utility functions ──────────────────────────────────────────

function shouldTrustZeroExit() {
  const v = process.env.AUTOCODING_TRUST_ZERO_EXIT;
  return v === "1" || v === "true";
}

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

/**
 * Extract task objects from agent CLI text output when the agent failed to
 * write task.json but did produce the tasks as text/JSON in its response.
 *
 * Strategies (tried in order):
 *   1. Find a complete task.json-shaped object with a "tasks" array.
 *   2. Find individual task-like JSON objects (have id/title/steps/passes).
 *
 * @param {string} text
 * @returns {Array<{id: number; title: string; description?: string; steps: string[]; passes: boolean}>}
 */
function extractTasksFromText(text) {
  // Strategy 1: Look for ```json ... ``` blocks containing a full task.json
  const codeBlockPattern = /```(?:json)?\s*\n([\s\S]*?)```/g;
  for (const match of text.matchAll(codeBlockPattern)) {
    const block = match[1].trim();
    try {
      const parsed = JSON.parse(block);
      if (parsed && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        const valid = parsed.tasks.filter(
          (t) => t && typeof t.title === "string" && Array.isArray(t.steps),
        );
        if (valid.length > 0) return valid;
      }
      // Might be a single task object
      if (parsed && typeof parsed.title === "string" && Array.isArray(parsed.steps)) {
        return [parsed];
      }
      // Might be a bare array of tasks
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.title && parsed[0]?.steps) {
        return parsed.filter((t) => t && typeof t.title === "string" && Array.isArray(t.steps));
      }
    } catch {
      // not valid JSON, continue
    }
  }

  // Strategy 2: Look for individual task-shaped JSON objects in the text
  const objectPattern = /\{[^{}]*"title"\s*:\s*"[^"]+?"[^{}]*"steps"\s*:\s*\[[^\]]*\][^{}]*\}/g;
  const candidates = [];
  for (const m of text.matchAll(objectPattern)) {
    try {
      const obj = JSON.parse(m[0]);
      if (obj && typeof obj.title === "string" && Array.isArray(obj.steps)) {
        candidates.push(obj);
      }
    } catch {
      // skip invalid
    }
  }
  if (candidates.length > 0) return candidates;

  // Strategy 3: Try to find the largest JSON-like block containing "tasks"
  const braceBlocks = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    // Quick check: does the text near this brace mention "tasks"?
    const lookahead = text.slice(i, i + 200);
    if (!lookahead.includes('"tasks"')) continue;
    let depth = 0;
    let end = -1;
    for (let j = i; j < text.length && j < i + 500_000; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end > i) braceBlocks.push(text.slice(i, end + 1));
  }
  for (const block of braceBlocks) {
    try {
      const parsed = JSON.parse(block);
      if (parsed && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
        const valid = parsed.tasks.filter(
          (t) => t && typeof t.title === "string" && Array.isArray(t.steps),
        );
        if (valid.length > 0) return valid;
      }
    } catch {
      // skip
    }
  }

  return [];
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
    this.agentTimeoutMs = resolveAgentTimeoutMs(config.agentTimeoutMs);
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
    this.agentIdleTimeoutMs = resolveAgentIdleTimeoutMs();
    /** @type {ReturnType<typeof setInterval> | null} */
    this.idleWatchdog = null;
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

  startIdleWatchdog() {
    this.stopIdleWatchdog();
    if (this.agentIdleTimeoutMs <= 0) return;
    const checkIntervalMs = Math.min(30_000, Math.max(5_000, this.agentIdleTimeoutMs / 4));
    this.idleWatchdog = setInterval(() => {
      if (this.state.status !== "running" || !this.lastAgentPid || this.lastAgentOutputAt === 0) return;
      const silentMs = Date.now() - this.lastAgentOutputAt;
      if (silentMs >= this.agentIdleTimeoutMs) {
        const mins = (silentMs / 60_000).toFixed(1);
        this.log(
          `[idle-watchdog] Agent 已 ${mins} 分钟无输出（阈值 ${(this.agentIdleTimeoutMs / 60_000).toFixed(0)} 分钟），强制终止。`,
        );
        this.killAgentTreeBestEffort();
      }
    }, checkIntervalMs);
  }

  stopIdleWatchdog() {
    if (this.idleWatchdog) {
      clearInterval(this.idleWatchdog);
      this.idleWatchdog = null;
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

  /**
   * 将用户原文追加到子项目目录下的 requirements-archive.md。
   * @param {string} kind 条目标题中的类型说明
   * @param {Array<{ title: string; body: string }>} blocks
   */
  async writeRequirementsArchive(kind, blocks) {
    try {
      await appendRequirementsArchive(this.repoRoot, this.project.dir, { kind, blocks });
      this.log(`[需求留档] 已追加 ${this.project.dir}/requirements-archive.md（${kind}）`);
    } catch (e) {
      this.log(`[需求留档] 写入失败：${e?.message || e}`);
    }
  }

  // ── Agent message building ──────────────────────────────────────

  buildAgentMessage(task, lastInPlanArg) {
    let lastInPlan = lastInPlanArg;
    if (lastInPlan === undefined) {
      try {
        lastInPlan = isLastPlannedTask(this.repoRoot, this.project.taskJsonPath, task.id);
      } catch {
        lastInPlan = false;
      }
    }
    const custom = CUSTOM_AGENT_BUILDERS[this.project.id];
    if (custom) return custom(this.repoRoot, this.project, task, lastInPlan);

    const steps = Array.isArray(task.steps) ? task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "";
    const tjp = this.getTaskJsonPath();
    const testSteps = lastInPlan
      ? [
          `3. 单元/集成测试：在 ${this.project.dir} 目录执行 \`npm test\` 确保全部通过。这只会运行快速的单元/集成测试（vitest），不含 Playwright E2E。先跑单元测试再跑 E2E——单元测试更快、反馈更精准，优先用它定位问题。`,
          `4. 浏览器自动化验收（Playwright E2E）：在 ${this.project.dir}/ 目录下执行 \`npm run test:e2e\`，它会自动启动 dev server 并打开浏览器运行 E2E 测试。Playwright 配置已内置 webServer 自动启动。如果浏览器未安装，先执行 \`npx playwright install chromium\`（系统级缓存，不要重复下载）。若 e2e/ 目录下尚无 *.spec.ts 测试文件，需为当前任务的功能编写 Playwright 测试用例。全部测试通过才算验收成功。`,
          `5. **以上全部通过后**，才可以修改 task.json（路径：${tjp}），将 id=${task.id} 的 passes 改为 true。`,
        ]
      : [
          `3. 单元/集成测试（**仅本任务范围**）：针对本任务新增或修改的代码，只运行相关的 Vitest 文件（\`npx vitest run <路径>\`），**不要**执行完整的 \`npm test\`。`,
          `4. 浏览器 E2E（**仅本任务范围**）：若本任务涉及 UI/浏览器，只运行相关的 Playwright 文件（\`npx playwright test <路径>\`），**不要**执行完整的 \`npm run test:e2e\`。若本任务纯逻辑、不涉及页面，可跳过 E2E。`,
          `5. **以上全部通过后**，才可以修改 task.json（路径：${tjp}），将 id=${task.id} 的 passes 改为 true。`,
        ];
    const effLines = lastInPlan
      ? [
          `- **禁止重复跑全量测试**：步骤 3 的 \`npm test\` 和步骤 4 的 \`npm run test:e2e\` 各只需运行**一次**。不要在修复代码后从步骤 1 重新跑全量——只重跑失败的那个步骤即可。`,
          `- **不要在 vitest 测试中嵌套 Playwright**：不要编写通过 spawn/exec 调用 \`npx playwright test\` 的 vitest 测试。vitest 只做纯逻辑单元测试，E2E 由 Playwright 自身运行。`,
          `- **单次测试超时上限**：单个 vitest 用例不应超过 30 秒（含 setup），单个 Playwright 用例不应超过 2 分钟。若需更长时间，应拆分或简化。`,
          `- **修复失败时只重跑最小范围**：如果某个特定测试文件失败，使用 \`npx vitest run path/to/file.test.ts\` 或 \`npx playwright test path/to/file.spec.ts\` 只跑该文件，不要反复跑全量套件。`,
        ]
      : [
          `- **本任务不是需求列表中的最后一项**：不要运行完整 \`npm test\` 或全量 \`npm run test:e2e\`；整体验收在最后一项任务执行。`,
          `- **不要在 vitest 测试中嵌套 Playwright**：不要编写通过 spawn/exec 调用 \`npx playwright test\` 的 vitest 测试。`,
          `- **修复失败时只重跑最小范围**：只跑与本任务相关的测试文件。`,
        ];
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
      `硬性要求（必须按顺序执行，且仅在前置步骤全部通过后才进入下一步）：`,
      `1. 实现本任务的功能代码。`,
      `2. 在 ${this.project.dir} 目录执行 npm run lint 与 npm run build，修复直至通过。`,
      ...testSteps,
      `   ⚠️ 如果 lint、build、单元测试或 E2E 测试有任何一项未通过，**绝对不要**将 passes 改为 true。宁可留 passes: false 让自动化系统重试，也不要在测试未通过时标记为 true。`,
      `- 单次 git commit 包含本任务相关变更（若使用 git）。`,
      ``,
      `实现策略原则：`,
      `- **先跑通再优化**：优先选择简单、可靠、性能可控的实现，宁可牺牲理论最优性也要保证在合理时间内（单次调用通常 < 5 秒）产出合格结果。例如：随机生成类功能不必追求极限参数（最少给定数、最高压缩率等），保留适量冗余既能大幅加速生成又不影响功能正确性。`,
      `- **不要自行添加极限约束**：若任务描述中没有明确要求「最少」「最小」「最优」等极限目标，实现时不要自行引入。生成/搜索/优化类算法应以「足够好且快速」为目标，而非「理论最优但可能超时」。`,
      `- **耗时操作要有保底退出**：任何可能长时间运行的循环/递归（生成器重试、回溯搜索、迭代优化），必须设置合理的最大尝试次数和/或墙上时钟超时（如 maxAttempts、maxElapsedMs），超限时返回当前最优可用结果或抛出明确错误，绝不能无限循环。`,
      ``,
      `测试编写注意事项：`,
      `- 性能敏感路径：若被测功能有已知的高耗时路径（如高难度档位的生成/求解，大量迭代的算法），测试应仅对快速路径做全量断言，对慢路径仅做结构冒烟或跳过，并设置充裕的 timeout。避免在一个 it() 中串行运行多个高耗时操作。`,
      `- Mock 可靠性：对 Node 内置模块（如 crypto、fs）做 spy/mock 时，ESM 具名导入（\`import { randomUUID } from "node:crypto"\`）绑定的是导入时引用，\`vi.spyOn\` 不会生效。应在被测模块中使用命名空间导入（\`import crypto from "node:crypto"\`），或使用 \`vi.mock\` 整体替换。`,
      `- E2E flaky：若并行下偶发失败，优先标记 retries 或降低并发（\`--workers=1\`），而非忽略。`,
      ``,
      `测试执行效率（严格遵守，防止超时）：`,
      ...effLines,
    ]
      .filter(Boolean)
      .join("\n");
  }

  buildDecompositionMessage(userPrompt) {
    const tjp = this.getTaskJsonPath();
    let taskJsonContent = "";
    try {
      taskJsonContent = fs.readFileSync(tjp, "utf8");
    } catch {
      taskJsonContent = '{"project":"","description":"","tasks":[]}';
    }
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
      `用户本次提交的需求原文已追加到 ${this.project.dir}/requirements-archive.md；分解任务时请勿偏离该原文。`,
      ``,
      `当前 task.json 内容（路径：${tjp}）：`,
      `\`\`\`json`,
      taskJsonContent,
      `\`\`\``,
      ``,
      `执行步骤：`,
      `1. 浏览 ${this.project.dir}/ 目录的代码结构，了解项目背景。`,
      `2. 上面已提供当前 task.json 的完整内容，不需要再读取文件。`,
      `3. 将用户需求分解为若干个可独立完成和验证的开发任务（通常 3-10 个）。`,
      `4. 用 Edit 或 Write 工具修改 task.json（路径：${tjp}）：`,
      `   - 保留已有 passes: true 的任务不变`,
      `   - 删除已有 passes: false 的旧任务（它们将被新任务替代）`,
      `   - 新任务追加到 tasks 数组末尾`,
      `   - 新任务的 id 从现有最大 id + 1 开始递增`,
      `   - 每个新任务格式：{ "id": N, "title": "简短标题", "description": "说明", "steps": ["验收步骤1", "验收步骤2", ...], "passes": false }`,
      `   - 任务应按依赖顺序排列`,
      `   ⚠️ 必须使用工具实际写入文件。如果 Edit/Write 工具失败，请重试或换用 Shell 工具写入。不要只在对话中输出 JSON 而不写入文件。`,
      ``,
      `任务分解原则：`,
      `- **先跑通再优化**：任务描述中的算法/生成策略应优先选择简单、可靠、性能可控的方案。例如：生成类任务应要求「单次调用 < 5 秒完成」，宁可保留冗余数据也不追求理论最优导致生成超时。`,
      `- **禁止自行添加极限约束**：若用户需求中没有明确要求「最少」「最小」「最优」等极限目标，任务描述不要自行引入。例如数独出题无需追求最少提示数、图片压缩无需追求最小体积——「足够好且快速」优先于「理论最优但可能超时」。`,
      `- **耗时操作必须有上限**：涉及循环/重试/搜索的任务，description 中应明确要求设置 maxAttempts 或超时保底，不能无限循环。`,
      `- **测试验收范围**：除 tasks 数组中**最后一项**外，各任务的 steps 只应要求针对本任务变更的测试（如 \`npx vitest run <路径>\` / 相关 Playwright 文件）；**最后一项**再要求完整 \`npm test\` 与全量 E2E（若项目有）。`,
      ``,
      `硬性要求：`,
      `- 只修改 task.json（路径：${tjp}），不要修改任何应用代码或其他文件`,
      `- 确保 task.json 格式正确，可被 JSON.parse 解析`,
      `- 所有新任务的 passes 必须为 false`,
    ].join("\n");
  }

  // ── Task execution ──────────────────────────────────────────────

  async runOneTask(task) {
    let lastInPlan = false;
    try {
      lastInPlan = isLastPlannedTask(this.repoRoot, this.project.taskJsonPath, task.id);
    } catch {
      lastInPlan = false;
    }
    const agentMessage = this.buildAgentMessage(task, lastInPlan);
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
      const tjp = this.getTaskJsonPath();
      const autoFixed = this.tryAutoVerifyAndMark(tjp, task.id, lastInPlan);
      if (autoFixed) {
        this.log(
          `[auto-verify] Agent 漏标 passes，但 ${lastInPlan ? "lint/build/test" : "lint/build"} 全部通过，已自动标记 id=${task.id} passes: true。`,
        );
        this.appendCliText(`\n[auto-verify] ✅ Agent 漏标 passes，自动验收通过并标记。\n`);
        return { ok: true, code: 0 };
      }
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
      if (isTaskDoneSafe(this.repoRoot, taskId, tjp)) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    if (isTaskDoneSafe(this.repoRoot, taskId, tjp)) return true;
    if (shouldTrustZeroExit()) {
      this.log(`[trust-zero-exit] Agent 退出码为 0 但 passes 未变，AUTOCODING_TRUST_ZERO_EXIT=1 视为成功。`);
      return true;
    }
    return false;
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
    this.startIdleWatchdog();
    try {
      await this.taskExecutionLoop();
      if (this.state.status === "running") {
        this.state.status = "idle";
        await this.saveState();
      }
    } finally {
      this.stopIdleWatchdog();
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
    let queue = loadIncompleteTasks(this.repoRoot, tjp);
    if (queue.length === 0) {
      // Agent exited successfully but didn't update task.json.
      // Try to extract tasks from the agent's CLI output and apply programmatically.
      const rescued = this.tryRescueDecompositionFromOutput(tjp);
      if (rescued) {
        queue = loadIncompleteTasks(this.repoRoot, tjp);
      }
    }
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

  /**
   * When the decomposition agent fails to write task.json, scan its CLI output
   * for JSON task objects and merge them into task.json programmatically.
   * @param {string} tjp Absolute path to task.json
   * @returns {boolean} Whether the rescue succeeded
   */
  tryRescueDecompositionFromOutput(tjp) {
    const cliText = this.agentCliSnapshot.text || "";
    if (!cliText) return false;

    this.log("[decomp-rescue] Agent 未更新 task.json，尝试从 CLI 输出提取任务…");
    this.appendCliText("\n[decomp-rescue] 检测到 Agent 未写入文件，尝试从输出中提取任务…\n");

    const newTasks = extractTasksFromText(cliText);
    if (newTasks.length === 0) {
      this.log("[decomp-rescue] 未能从 CLI 输出中提取到有效任务。");
      this.appendCliText("[decomp-rescue] ❌ 未找到可提取的任务 JSON。\n");
      return false;
    }

    try {
      let data;
      try {
        const raw = fs.readFileSync(tjp, "utf8");
        data = JSON.parse(raw);
      } catch {
        data = { project: this.project.name || "", description: "", tasks: [] };
      }
      if (!Array.isArray(data.tasks)) data.tasks = [];

      const kept = data.tasks.filter((t) => t.passes === true);
      const maxId = kept.reduce((mx, t) => Math.max(mx, Number(t.id) || 0), 0);

      const renumbered = newTasks.map((t, i) => ({
        ...t,
        id: maxId + 1 + i,
        passes: false,
      }));

      data.tasks = [...kept, ...renumbered];
      fs.writeFileSync(tjp, JSON.stringify(data, null, 2) + "\n", "utf8");

      this.log(`[decomp-rescue] ✅ 成功提取并写入 ${renumbered.length} 个新任务到 task.json。`);
      this.appendCliText(`[decomp-rescue] ✅ 成功提取 ${renumbered.length} 个任务并写入 task.json。\n`);
      return true;
    } catch (e) {
      this.log(`[decomp-rescue] 写入 task.json 失败：${e?.message || e}`);
      this.appendCliText(`[decomp-rescue] ❌ 写入失败：${e?.message || e}\n`);
      return false;
    }
  }

  async customTaskFlow(userPrompt) {
    if (this.workerRunning) return;
    this.workerRunning = true;
    this.startIdleWatchdog();
    try {
      this.log(`[自定义任务] 开始需求分解…`);
      await this.writeRequirementsArchive("新增 / 重构功能", [
        { title: "用户提交的完整描述（原文）", body: userPrompt },
      ]);
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
      this.stopIdleWatchdog();
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
      `    "placeholder": "单行示例草稿（将预填在输入框内，用户可直接改）"`,
      `  },`,
      `  {`,
      `    "id": "q2",`,
      `    "label": "问题文本",`,
      `    "type": "textarea",`,
      `    "placeholder": "多行示例草稿（将预填在文本框内，用户可直接改）"`,
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
      `- placeholder 字段填写「建议答案草稿」：会作为输入框/文本框的默认文本展示，用户可直接在其上修改（不是鼠标悬停提示）`,
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
      `- 需求原文留档：${this.project.dir}/requirements-archive.md（已由系统记录向导原文；请勿清空历史，实现须与之一致）`,
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
    this.startIdleWatchdog();
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

      await this.writeRequirementsArchive("新建项目向导 · 需求分析（初稿）", [
        { title: "用户提交的项目描述（原文）", body: description },
      ]);

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
      this.stopIdleWatchdog();
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
    this.startIdleWatchdog();
    try {
      this.log(`[项目初始化] 开始…`);
      const initBlocks = [
        { title: "原始项目描述（原文）", body: wizardData.description },
      ];
      const ans = wizardData.answers;
      if (Array.isArray(ans) && ans.length > 0) {
        const qaText = ans
          .map((a) => {
            const q = a.question != null ? String(a.question) : "";
            const av = a.answer != null ? String(a.answer) : "";
            return `Q: ${q}\nA: ${av}`;
          })
          .join("\n\n---\n\n");
        initBlocks.push({ title: "向导追问与回答（完整）", body: qaText });
      }
      if (this.wizardQuestions && this.wizardQuestions.length > 0) {
        initBlocks.push({
          title: "AI 生成的追问模板（JSON，含 id / label / placeholder 等）",
          body: JSON.stringify(this.wizardQuestions, null, 2),
        });
      }
      await this.writeRequirementsArchive("新建项目向导 · 项目初始化（完整）", initBlocks);
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
        const incomplete = tasks.filter((t) => isTaskIncomplete(t));
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
      this.stopIdleWatchdog();
      this.workerRunning = false;
      this.lastAgentPid = undefined;
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      this.stdoutLineBuf = "";
      this.setAgentPhase("idle", "");
    }
  }

  // ── Module decomposition layer ─────────────────────────────────

  getModulePlan() {
    const tjp = this.project.taskJsonPath;
    if (!tjp) return null;
    return loadModulePlan(this.repoRoot, tjp);
  }

  hasModulePlan() {
    const tjp = this.project.taskJsonPath;
    if (!tjp) return false;
    return hasModulePlan(this.repoRoot, tjp);
  }

  async runAgentSession(message, phaseLabel) {
    this.agentPromptSnapshot = { text: message, taskId: null, updatedAt: formatBeijingDateTime() };
    const header =
      (this.agentCliSnapshot.text ? "\n\n" : "") +
      `──────────────── ${phaseLabel} ────────────────\n`;
    this.agentCliSnapshot.text = (this.agentCliSnapshot.text || "") + header;
    this.agentCliSnapshot.taskId = null;
    this.agentCliSnapshot.updatedAt = formatBeijingDateTime();
    this.stdoutLineBuf = "";
    this.setAgentPhase("init", phaseLabel);

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

    return runCursorAgent(this.repoRoot, message, undefined, this.agentTimeoutMs, hooks);
  }

  /**
   * 将项目需求分解为模块（生成 module-plan.json）。
   */
  async runModuleDecomposition(userPrompt) {
    await this.writeRequirementsArchive("模块化开发 · 模块分解", [
      { title: "用户提交的完整描述（原文）", body: userPrompt },
    ]);
    const tjp = this.project.taskJsonPath;
    if (!tjp) {
      this.state.lastError = "项目未配置 taskJsonPath，无法进行模块分解。";
      this.log(this.state.lastError);
      this.state.status = "idle";
      await this.saveState();
      return false;
    }

    const message = buildProjectDecompositionPrompt(
      this.repoRoot, this.project, tjp, userPrompt,
    );

    const result = await this.runAgentSession(message, "模块分解");

    if (this.state.status === "paused" || this.resetRequested) return false;

    if (result.code !== 0) {
      this.state.lastError = `模块分解失败：Agent 退出码 ${result.code}。${result.stderr ? "\n" + result.stderr.slice(-2000) : ""}`;
      this.log(this.state.lastError);
      this.state.status = "idle";
      await this.saveState();
      return false;
    }

    const plan = loadModulePlan(this.repoRoot, tjp);
    if (!plan || !plan.modules || plan.modules.length === 0) {
      this.state.lastError =
        "模块分解 Agent 已退出，但 module-plan.json 未正确创建或格式错误。请检查 CLI 输出。";
      this.log(this.state.lastError);
      this.state.status = "idle";
      await this.saveState();
      return false;
    }

    this.log(`[模块分解] 完成，生成了 ${plan.modules.length} 个模块。`);
    return true;
  }

  /**
   * 为单个模块生成 task.json（模块初始化）。
   */
  async runModuleInitializer(modulePlan, targetModule) {
    const tjp = this.project.taskJsonPath;
    const message = buildModuleInitializerPrompt(
      this.repoRoot, this.project, tjp, modulePlan, targetModule,
    );

    const result = await this.runAgentSession(
      message,
      `模块初始化 · ${targetModule.title}`,
    );

    if (this.state.status === "paused" || this.resetRequested) return false;

    if (result.code !== 0) {
      this.state.lastError = `模块「${targetModule.title}」初始化失败：Agent 退出码 ${result.code}。`;
      this.log(this.state.lastError);
      return false;
    }

    const moduleTaskPath = path.join(
      this.repoRoot,
      deriveModuleTaskJsonPath(tjp, targetModule.id),
    );
    try {
      fs.accessSync(moduleTaskPath);
    } catch {
      this.state.lastError = `模块「${targetModule.title}」初始化后未生成 task.json（Agent 未创建文件 ${moduleTaskPath}）。请重试。`;
      this.log(this.state.lastError);
      return false;
    }
    try {
      const raw = fs.readFileSync(moduleTaskPath, "utf8");
      const data = JSON.parse(raw);
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      if (tasks.length === 0) {
        this.state.lastError = `模块「${targetModule.title}」的 task.json 任务列表为空。`;
        this.log(this.state.lastError);
        return false;
      }
      this.log(`[模块初始化] 「${targetModule.title}」完成，生成了 ${tasks.length} 个任务。`);
      return true;
    } catch (e) {
      this.state.lastError = `模块「${targetModule.title}」的 task.json 格式错误：${e.message}`;
      this.log(this.state.lastError);
      return false;
    }
  }

  /**
   * 执行单个模块内的一个任务。
   */
  async runOneModuleTask(modulePlan, targetModule, task) {
    const tjp = this.project.taskJsonPath;
    const moduleTaskRel = deriveModuleTaskJsonPath(tjp, targetModule.id);
    let lastInPlan = false;
    try {
      lastInPlan = isLastPlannedTask(this.repoRoot, moduleTaskRel, task.id);
    } catch {
      lastInPlan = false;
    }
    const agentMessage = buildModuleTaskMessage(
      this.repoRoot, this.project, tjp, modulePlan, targetModule, task, lastInPlan,
    );
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

    const moduleTaskJsonPath = deriveModuleTaskJsonPath(tjp, targetModule.id);
    const marked = await this.waitUntilModuleTaskDone(moduleTaskJsonPath, task.id);
    if (!marked) {
      const autoFixed = this.tryAutoVerifyAndMark(moduleTaskJsonPath, task.id, lastInPlan);
      if (autoFixed) {
        this.log(
          `[auto-verify] Agent 漏标 passes，但 ${lastInPlan ? "lint/build/test" : "lint/build"} 全部通过，已自动标记 id=${task.id} passes: true。`,
        );
        this.appendCliText(`\n[auto-verify] ✅ Agent 漏标 passes，自动验收通过并标记。\n`);
        return { ok: true, code: 0 };
      }
      return {
        ok: false,
        code: 2,
        stderr:
          `Agent 退出码为 0，但模块 task.json 中 id=${task.id} 的 passes 仍为 false。\n` +
          "可能原因：agent 完成了实现但漏改标记。\n" +
          "请检查 CLI 输出，必要时手动标记 passes: true 后继续。",
      };
    }
    return { ok: true, code: 0 };
  }

  /**
   * 当 Agent 退出码为 0 但未标记 passes 时，自动运行 lint/build（及最后一项任务时的 test）验证。
   * 若全部通过，自动将 passes 标记为 true。
   * @param {string} moduleTaskJsonRelPath
   * @param {number} taskId
   * @param {boolean} [isLastPlannedTask=true] 非最后一项任务时不跑全量 npm test，与 Agent 提示一致。
   * @returns {boolean} 是否自动标记成功
   */
  tryAutoVerifyAndMark(moduleTaskJsonRelPath, taskId, isLastPlannedTask = true) {
    const projectDir = path.join(this.repoRoot, this.project.dir);
    const absTaskPath = path.join(this.repoRoot, moduleTaskJsonRelPath);
    const timeoutMs = 120_000;

    const runNpm = (script) => {
      try {
        execFileSync("npm", ["run", script], {
          cwd: projectDir,
          stdio: "pipe",
          shell: true,
          windowsHide: true,
          timeout: timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
        });
        return true;
      } catch {
        return false;
      }
    };

    const verifyLabel = isLastPlannedTask ? "lint/build/test" : "lint/build（非最后一项任务跳过全量 test）";
    this.log(`[auto-verify] Agent 未标记 passes，尝试自动验收 ${verifyLabel}…`);
    this.appendCliText(`\n[auto-verify] 尝试自动验收…\n`);

    if (!runNpm("lint")) {
      this.log(`[auto-verify] lint 失败，无法自动标记。`);
      this.appendCliText(`[auto-verify] ❌ lint 失败\n`);
      return false;
    }
    this.appendCliText(`[auto-verify] ✅ lint 通过\n`);

    if (!runNpm("build")) {
      this.log(`[auto-verify] build 失败，无法自动标记。`);
      this.appendCliText(`[auto-verify] ❌ build 失败\n`);
      return false;
    }
    this.appendCliText(`[auto-verify] ✅ build 通过\n`);

    if (isLastPlannedTask) {
      if (!runNpm("test")) {
        this.log(`[auto-verify] test 失败，无法自动标记。`);
        this.appendCliText(`[auto-verify] ❌ test 失败\n`);
        return false;
      }
      this.appendCliText(`[auto-verify] ✅ test 通过\n`);
    } else {
      this.appendCliText(`[auto-verify] ⏭️ 跳过全量 test（非最后一项任务）\n`);
    }

    try {
      const raw = fs.readFileSync(absTaskPath, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data.tasks)) {
        const task = data.tasks.find((t) => Number(t.id) === Number(taskId));
        if (task) {
          task.passes = true;
          fs.writeFileSync(absTaskPath, JSON.stringify(data, null, 2) + "\n", "utf8");
          return true;
        }
      }
    } catch (e) {
      this.log(`[auto-verify] 更新 task.json 失败：${e?.message || e}`);
    }
    return false;
  }

  async waitUntilModuleTaskDone(moduleTaskJsonRelPath, taskId) {
    const attempts = Math.max(1, Math.min(20, Number(process.env.AUTOCODING_PASS_POLL_ATTEMPTS) || 8));
    const delayMs = Math.max(50, Math.min(2000, Number(process.env.AUTOCODING_PASS_POLL_MS) || 250));
    const absPath = path.join(this.repoRoot, moduleTaskJsonRelPath);
    for (let i = 0; i < attempts; i++) {
      if (isTaskDoneSafe(this.repoRoot, taskId, absPath)) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    if (isTaskDoneSafe(this.repoRoot, taskId, absPath)) return true;
    if (shouldTrustZeroExit()) {
      this.log(`[trust-zero-exit] Agent 退出码为 0 但 passes 未变，AUTOCODING_TRUST_ZERO_EXIT=1 视为成功。`);
      return true;
    }
    return false;
  }

  /**
   * 模块化执行主循环：按拓扑序依次初始化并执行每个模块的任务。
   */
  async moduleExecutionLoop() {
    const tjp = this.project.taskJsonPath;
    if (!tjp) {
      this.state.lastError = "项目未配置 taskJsonPath。";
      this.log(this.state.lastError);
      return;
    }

    for (;;) {
      if (this.state.status !== "running") break;
      if (this.resetRequested) {
        this.resetRequested = false;
        this.state.lastError = null;
        await this.saveState();
        this.log("已应用重置请求，模块执行结束。");
        break;
      }

      const plan = loadModulePlan(this.repoRoot, tjp);
      if (!plan) {
        this.state.lastError = "未找到 module-plan.json，无法继续模块化执行。";
        this.log(this.state.lastError);
        this.state.status = "idle";
        await this.saveState();
        break;
      }

      const next = getNextPendingModule(plan);
      if (!next) {
        this.state.status = "completed";
        this.state.lastError = null;
        await this.saveState();
        this.log("所有模块已完成！");
        break;
      }

      const mod = next.module;

      if (!areDependenciesMet(plan, mod.id)) {
        this.state.lastError = `模块「${mod.title}」的依赖未满足，请检查 module-plan.json。`;
        this.log(this.state.lastError);
        this.state.status = "idle";
        await this.saveState();
        break;
      }

      // Phase 1: Module initialization (generate task.json if needed)
      const moduleTaskRelPath = deriveModuleTaskJsonPath(tjp, mod.id);
      const moduleTaskAbsPath = path.join(this.repoRoot, moduleTaskRelPath);
      let needsInit = false;
      try {
        fs.accessSync(moduleTaskAbsPath);
        const raw = fs.readFileSync(moduleTaskAbsPath, "utf8");
        const data = JSON.parse(raw);
        if (!Array.isArray(data.tasks) || data.tasks.length === 0) needsInit = true;
      } catch {
        needsInit = true;
      }

      if (needsInit && mod.status !== "completed") {
        this.log(`[模块] 开始初始化模块「${mod.title}」…`);
        setModuleStatus(plan, mod.id, "initializing");
        await saveModulePlan(this.repoRoot, tjp, plan);

        const initOk = await this.runModuleInitializer(plan, mod);

        if (this.resetRequested || this.state.status !== "running") break;

        if (!initOk) {
          setModuleStatus(plan, mod.id, "failed", this.state.lastError || "初始化失败");
          await saveModulePlan(this.repoRoot, tjp, plan);
          this.state.status = "idle";
          await this.saveState();
          break;
        }
      }

      // Phase 2: Execute module tasks
      if (mod.status === "failed") {
        this.log(`[模块] 恢复模块「${mod.title}」：上次为 failed/中断，将按 task.json 中未完成项继续（见下一条日志）。`);
      }
      this.log(`[模块] 开始执行模块「${mod.title}」的任务…`);
      setModuleStatus(plan, mod.id, "running");
      await saveModulePlan(this.repoRoot, tjp, plan);

      const loadResult = tryLoadIncompleteTasks(this.repoRoot, moduleTaskAbsPath);
      if (!loadResult.ok) {
        this.state.lastError = `无法读取模块「${mod.title}」的任务文件：${loadResult.error}`;
        this.log(this.state.lastError);
        setModuleStatus(plan, mod.id, "failed", this.state.lastError);
        await saveModulePlan(this.repoRoot, tjp, plan);
        this.state.status = "idle";
        await this.saveState();
        break;
      }
      const moduleTaskQueue = loadResult.tasks;
      if (moduleTaskQueue.length === 0) {
        this.log(`[模块] 模块「${mod.title}」的所有任务已完成。`);
        setModuleStatus(plan, mod.id, "completed");
        await saveModulePlan(this.repoRoot, tjp, plan);
        continue;
      }

      for (const task of moduleTaskQueue) {
        if (this.state.status !== "running") break;
        if (this.resetRequested) break;

        this.state.lastTaskId = task.id;
        this.state.lastError = null;
        await this.saveState();
        this.log(`[模块·${mod.id}] 开始任务 id=${task.id}：${task.title}`);

        const outcome = await this.runOneModuleTask(plan, mod, task);

        if (this.resetRequested || this.state.status === "paused") break;

        if (!outcome.ok) {
          this.state.lastError =
            outcome.code === 2
              ? outcome.stderr
              : `Agent 失败：模块「${mod.title}」任务 id=${task.id}，退出码 ${outcome.code}。${outcome.stderr ? "\n" + outcome.stderr.slice(-2000) : ""}`;
          this.log(this.state.lastError);
          setModuleStatus(plan, mod.id, "failed", this.state.lastError);
          await saveModulePlan(this.repoRoot, tjp, plan);
          this.state.status = "idle";
          await this.saveState();
          break;
        }

        this.log(`[模块·${mod.id}] 任务 id=${task.id} 已完成。`);

        if (!this.autoAdvance) {
          const rem = tryLoadIncompleteTasks(this.repoRoot, moduleTaskAbsPath);
          const remaining = rem.ok ? rem.tasks : [];
          if (rem.ok && remaining.length > 0) {
            this.state.status = "idle";
            this.log(
              `逐任务模式：任务 id=${task.id} 完成后已暂停。模块「${mod.title}」剩余 ${remaining.length} 个任务。`,
            );
            await this.saveState();
            return;
          }
        }
      }

      if (this.resetRequested || this.state.status !== "running") break;

      // Check if all tasks in the module are done
      const remFinal = tryLoadIncompleteTasks(this.repoRoot, moduleTaskAbsPath);
      if (!remFinal.ok) {
        this.state.lastError = `无法读取模块「${mod.title}」的任务文件：${remFinal.error}`;
        this.log(this.state.lastError);
        setModuleStatus(plan, mod.id, "failed", this.state.lastError);
        await saveModulePlan(this.repoRoot, tjp, plan);
        this.state.status = "idle";
        await this.saveState();
        break;
      }
      const remaining = remFinal.tasks;
      if (remaining.length === 0) {
        this.log(`[模块] 模块「${mod.title}」全部任务已完成！`);
        setModuleStatus(plan, mod.id, "completed");
        await saveModulePlan(this.repoRoot, tjp, plan);
      }
    }
  }

  /**
   * 模块化开发完整流程：分解 → 逐模块初始化 + 执行。
   */
  async moduleFlow(userPrompt) {
    if (this.workerRunning) return;
    this.workerRunning = true;
    this.startIdleWatchdog();
    try {
      if (!this.hasModulePlan()) {
        this.log(`[模块化开发] 开始项目模块分解…`);
        const ok = await this.runModuleDecomposition(userPrompt);
        if (!ok) {
          if (this.resetRequested) {
            this.resetRequested = false;
            this.state.lastError = null;
            await this.saveState();
            this.log("已应用重置请求，worker 结束。");
          } else if (this.state.status === "running") {
            this.state.status = "idle";
            await this.saveState();
          }
          return;
        }
        this.wizardDescription = null;
        this.wizardQuestions = null;
        try { fs.unlinkSync(this.getWizardFilePath()); } catch {}
        if (this.state.status !== "running") return;
      } else {
        this.log(`[模块化开发] 检测到已有 module-plan.json，跳过模块分解，继续执行…`);
      }

      this.log(`[模块化开发] 进入模块执行阶段…`);
      await this.moduleExecutionLoop();

      if (this.state.status === "running") {
        this.state.status = "idle";
        await this.saveState();
      }
    } finally {
      this.stopIdleWatchdog();
      this.workerRunning = false;
      this.lastAgentPid = undefined;
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      this.stdoutLineBuf = "";
      this.setAgentPhase("idle", "");
    }
  }

  /**
   * 仅执行模块队列（module-plan.json 已存在时）。
   */
  async moduleResumeFlow() {
    if (this.workerRunning) return;
    this.workerRunning = true;
    this.startIdleWatchdog();
    try {
      await this.moduleExecutionLoop();
      if (this.state.status === "running") {
        this.state.status = "idle";
        await this.saveState();
      }
    } finally {
      this.stopIdleWatchdog();
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

    if (action === "cleanup-project" || action === "reset-link-game") {
      if (action === "reset-link-game" && this.project.id !== "link-game") {
        return { ok: false, error: "reset-link-game 仅兼容连连看；请使用 cleanup-project。" };
      }
      if (!this.project.taskJsonPath) {
        return { ok: false, error: "该项目未配置 task.json，无法清理代码目录。请使用「重置状态」仅清空面板。" };
      }
      const running = this.state.status === "running";
      this.resetRequested = running;
      this.killAgentTreeBestEffort();
      this.agentStdinStream = null;
      this.lastAgentOutputAt = 0;
      const projLabel = this.project.name || this.project.id;
      this.setAgentPhase("idle", `已清理 ${projLabel}`);
      this.state.lastError = null;
      this.state.lastTaskId = null;
      this.state.status = "idle";
      this.agentPromptSnapshot = { text: "", taskId: null, updatedAt: null };
      this.agentCliSnapshot = { text: "", taskId: null, updatedAt: null };
      try {
        await performProjectCleanup(this.repoRoot, this.project);
      } catch (e) {
        const msg = String(e?.message || e);
        this.log(`项目清理失败（${projLabel}）: ${msg}`);
        await this.saveState();
        return { ok: false, error: msg };
      }
      await this.saveState();
      this.log(`已清理 ${projLabel} 并重置面板。`);
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

    if (action === "module-decompose") {
      if (this.state.status === "running") return { ok: false, error: "已在运行中" };
      const prompt = body?.prompt;
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return { ok: false, error: "请提供项目描述（prompt 字段）" };
      }
      this.state.status = "running";
      this.state.lastError = null;
      this.agentPromptSnapshot = { text: "", taskId: null, updatedAt: null };
      this.agentCliSnapshot = { text: "", taskId: null, updatedAt: null };
      await this.saveState();
      this.moduleFlow(prompt.trim()).catch(async (e) => {
        this.log(`模块化开发流程异常: ${e?.message || e}`);
        this.state.status = "idle";
        this.state.lastError = String(e?.message || e);
        try { await this.saveState(); } catch (err) { this.log(`保存状态失败: ${err.message}`); }
      });
      return { ok: true };
    }

    if (action === "module-start") {
      if (this.state.status === "running") return { ok: false, error: "已在运行中" };
      if (!this.hasModulePlan()) {
        return { ok: false, error: "未找到 module-plan.json，请先进行模块分解。" };
      }
      this.state.status = "running";
      this.state.lastError = null;
      await this.saveState();
      this.moduleResumeFlow().catch(async (e) => {
        this.log(`模块执行流程异常: ${e?.message || e}`);
        this.state.status = "idle";
        this.state.lastError = String(e?.message || e);
        try { await this.saveState(); } catch (err) { this.log(`保存状态失败: ${err.message}`); }
      });
      return { ok: true };
    }

    if (action === "module-reset") {
      const tjp = this.project.taskJsonPath;
      if (tjp) {
        const plan = loadModulePlan(this.repoRoot, tjp);
        if (plan) {
          for (const mod of plan.modules) {
            mod.status = "pending";
            delete mod.error;
          }
          await saveModulePlan(this.repoRoot, tjp, plan);
          this.log("所有模块状态已重置为 pending。");
        }
      }
      return { ok: true };
    }

    if (action === "module-reset-one") {
      const moduleId = body?.moduleId;
      if (!moduleId || typeof moduleId !== "string") {
        return { ok: false, error: "请提供 moduleId 字段" };
      }
      const tjp = this.project.taskJsonPath;
      if (!tjp) return { ok: false, error: "项目未配置 taskJsonPath。" };
      const plan = loadModulePlan(this.repoRoot, tjp);
      if (!plan) return { ok: false, error: "未找到 module-plan.json。" };
      const mod = plan.modules.find((m) => m.id === moduleId);
      if (!mod) return { ok: false, error: `未找到模块 "${moduleId}"。` };

      mod.status = "pending";
      delete mod.error;
      await saveModulePlan(this.repoRoot, tjp, plan);

      const resetTasks = body?.resetTasks !== false;
      if (resetTasks) {
        const moduleTaskPath = path.join(
          this.repoRoot,
          deriveModuleTaskJsonPath(tjp, moduleId),
        );
        try {
          const raw = fs.readFileSync(moduleTaskPath, "utf8");
          const data = JSON.parse(raw);
          if (Array.isArray(data.tasks)) {
            for (const t of data.tasks) {
              if (t && typeof t === "object") t.passes = false;
            }
            fs.writeFileSync(moduleTaskPath, JSON.stringify(data, null, 2) + "\n", "utf8");
            this.log(`模块「${mod.title}」的所有任务 passes 已重置为 false。`);
          }
        } catch {
          this.log(`模块「${mod.title}」的任务文件不存在或无法读取，跳过 passes 重置。`);
        }
      }

      this.log(`模块「${mod.title}」状态已重置为 pending。`);
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
          .filter((t) => isTaskIncomplete(t))
          .sort((a, b) => Number(a.id) - Number(b.id));
      }
    } catch {
      /* ok */
    }
    // ── Module plan info ──
    let modulePlanInfo = null;
    const tjp2 = this.project.taskJsonPath;
    if (tjp2) {
      const plan = loadModulePlan(this.repoRoot, tjp2);
      if (plan) {
        let sorted;
        try { sorted = topologicalSort(plan.modules); } catch { sorted = plan.modules; }
        const modulesWithTasks = sorted.map((m) => {
          const mtPath = path.join(this.repoRoot, deriveModuleTaskJsonPath(tjp2, m.id));
          let taskStats = { total: 0, done: 0, pending: 0 };
          try {
            const raw = fs.readFileSync(mtPath, "utf8");
            const data = JSON.parse(raw);
            const tasks = Array.isArray(data.tasks) ? data.tasks : [];
            const done = tasks.filter((t) => t.passes === true).length;
            taskStats = { total: tasks.length, done, pending: tasks.length - done };
          } catch { /* no task file yet */ }
          return { ...m, tasks: taskStats };
        });
        modulePlanInfo = {
          project: plan.project,
          description: plan.description,
          summary: getModulePlanSummary(plan),
          modules: modulesWithTasks,
        };
      }
    }

    // Aggregate pending tasks from module task files so that
    // "待办任务数" reflects the real workload for modular projects.
    let modulePendingCount = 0;
    /** @type {{ id: string|number; title: string } | null} */
    let firstModuleTask = null;
    if (modulePlanInfo) {
      for (const m of modulePlanInfo.modules) {
        totalTaskCount += m.tasks.total;
        modulePendingCount += m.tasks.pending;
        if (!firstModuleTask && m.tasks.pending > 0) {
          const mtPath = path.join(this.repoRoot, deriveModuleTaskJsonPath(this.project.taskJsonPath, m.id));
          try {
            const raw = fs.readFileSync(mtPath, "utf8");
            const data = JSON.parse(raw);
            const tasks = Array.isArray(data.tasks) ? data.tasks : [];
            const incompleteMod = tasks
              .filter((t) => isTaskIncomplete(t))
              .sort((a, b) => Number(a.id) - Number(b.id));
            const first = incompleteMod[0];
            if (first) {
              firstModuleTask = { id: `${m.id}/${first.id}`, title: `[${m.id}] ${first.title}` };
            }
          } catch { /* ok */ }
        }
      }
    }
    const totalPendingCount = pending.length + modulePendingCount;
    const nextTask = pending.length > 0
      ? { id: pending[0].id, title: pending[0].title }
      : firstModuleTask;

    const projectDirForDev = path.join(this.repoRoot, this.project.dir);
    const devServerUrl = this.devServerRunning
      ? `http://127.0.0.1:${inferDevServerPort(projectDirForDev)}/`
      : null;
    return {
      ok: true,
      projectId: this.project.id,
      cleanupAvailable: !!this.project.taskJsonPath,
      repoRoot: this.repoRoot,
      totalTaskCount,
      pendingCount: totalPendingCount,
      nextTask: nextTask || null,
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
      modulePlan: modulePlanInfo,
    };
  }

  // ── Destroy ─────────────────────────────────────────────────────

  destroy() {
    this.stopIdleWatchdog();
    this.killAgentTreeBestEffort();
    this.agentStdinStream = null;
    this.stopDevServer();
  }
}
