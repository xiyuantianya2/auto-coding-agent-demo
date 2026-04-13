/**
 * 本地 Web：按 task.json 中 passes:false 的任务顺序调用 Cursor Agent CLI 全自动实现。
 * 参考 tools/curriculum-cursor-check 的 agent-runner 与 HTTP 控制模式。
 */
import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { runCursorAgent } from "./lib/agent-runner.mjs";
import { loadIncompleteTasks, isTaskDone } from "./lib/task-queue.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = __dirname;
const DEFAULT_REPO = path.resolve(TOOL_ROOT, "..", "..");

const REPO_ROOT = path.resolve(process.env.AUTO_CODING_REPO_ROOT || DEFAULT_REPO);
const DATA_DIR = path.join(REPO_ROOT, ".auto-coding-agent");
const STATE_PATH = path.join(DATA_DIR, "state.json");
const PUBLIC_DIR = path.join(TOOL_ROOT, "public");

const PREFERRED_PORT = Number(process.env.PORT) || 3910;
const HOST = process.env.HOST || "127.0.0.1";
let httpPort = PREFERRED_PORT;

const AGENT_TIMEOUT_MS = Math.max(
  60_000,
  Number(process.env.AUTOCODING_AGENT_TIMEOUT_MS) || 45 * 60 * 1000,
);

/** @type {{ status: string; lastError: string | null; updatedAt: string; lastTaskId: number | null }} */
let state = {
  status: "idle",
  lastError: null,
  updatedAt: new Date().toISOString(),
  lastTaskId: null,
};

let workerRunning = false;
let resetRequested = false;
/** @type {number | undefined} */
let lastAgentPid;

const logLines = [];
const MAX_LOG_LINES = 900;

function log(line) {
  const t = new Date().toISOString();
  const s = `[${t}] ${line}\n`;
  logLines.unshift(s);
  while (logLines.length > MAX_LOG_LINES) logLines.pop();
  process.stdout.write(s);
}

/**
 * @param {string} chunk
 */
function isWebpackNoise(chunk) {
  if (chunk.length < 80) return false;
  if (
    chunk.includes("__webpack_require__") ||
    chunk.includes("node_modules/.pnpm/") ||
    chunk.includes("dist/cjs/internal/")
  ) {
    return true;
  }
  const sample = chunk.slice(0, 600);
  const codeChars = (sample.match(/[{}();=>,[\]]/g) || []).length;
  if (sample.length > 200 && codeChars / sample.length > 0.08) {
    return true;
  }
  return false;
}

function killAgentTreeBestEffort() {
  const pid = lastAgentPid;
  if (!pid || pid < 1) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
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

async function ensureDirs() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function loadState() {
  try {
    const raw = await fsp.readFile(STATE_PATH, "utf8");
    const j = JSON.parse(raw);
    if (j.status === "running" || j.status === "paused" || j.status === "idle" || j.status === "completed") {
      state.status = j.status === "running" ? "paused" : j.status;
    }
    if (typeof j.lastError === "string" || j.lastError === null) {
      state.lastError = j.lastError;
    }
    if (typeof j.lastTaskId === "number" || j.lastTaskId === null) {
      state.lastTaskId = j.lastTaskId ?? null;
    }
  } catch {
    /* 首次 */
  }
  state.updatedAt = new Date().toISOString();
}

async function saveState() {
  state.updatedAt = new Date().toISOString();
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

/**
 * @param {{ id: number; title: string; description?: string; steps: string[] }} task
 */
function buildAgentMessage(task) {
  const steps = Array.isArray(task.steps) ? task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n") : "";
  return [
    `你是本仓库的 coding agent。工作区根目录：${REPO_ROOT}`,
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
    `- 实现完成后：必须修改仓库根目录下的 task.json（路径：${path.join(REPO_ROOT, "task.json")}），将 id=${task.id} 的 passes 改为 true；不要只改子目录里的副本。`,
    `- 更新 progress.txt 记录本任务。`,
    `- 在 link-game 目录执行 npm run lint 与 npm run build，修复直至通过。`,
    `- 单次 git commit 包含本任务相关变更（若使用 git）。`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {{ id: number; title: string; description?: string; steps: string[] }} task
 */
async function runOneTask(task) {
  const agentMessage = buildAgentMessage(task);
  lastAgentPid = undefined;
  const hooks = {
    onSpawn: (pid) => {
      lastAgentPid = pid;
    },
    onStdout: (chunk) => {
      if (state.status !== "running") return;
      const tail = String(chunk).slice(-2000);
      if (tail.trim()) log(`[agent stdout] …${tail.slice(-400)}`);
    },
    onStderr: (chunk) => {
      if (state.status !== "running") return;
      if (isWebpackNoise(chunk)) return;
      const tail = String(chunk).slice(-2000);
      if (tail.trim()) log(`[agent stderr] …${tail.slice(-400)}`);
    },
  };

  const result = await runCursorAgent(REPO_ROOT, agentMessage, undefined, AGENT_TIMEOUT_MS, hooks);

  if (result.code !== 0) {
    return { ok: false, code: result.code, stderr: result.stderr };
  }

  const marked = await waitUntilTaskMarkedDone(REPO_ROOT, task.id);
  if (!marked) {
    const trust =
      process.env.AUTOCODING_TRUST_ZERO_EXIT === "1" ||
      process.env.AUTOCODING_TRUST_ZERO_EXIT === "true";
    if (trust) {
      log(
        `[警告] task id=${task.id} 在 task.json 中仍为 passes:false，已设 AUTOCODING_TRUST_ZERO_EXIT=1，按成功继续；请人工核对仓库根目录 task.json。`,
      );
      return { ok: true, code: 0 };
    }
    return {
      ok: false,
      code: 2,
      stderr:
        "Agent 退出码为 0，但根目录 task.json 中该任务 passes 仍为 false。" +
        "请确认 Agent 保存的是「仓库根」的 task.json（不是子目录拷贝），或在本机手动将对应 id 的 passes 改为 true。" +
        "若确认 Agent 已完成实现仅漏改标记，可设环境变量 AUTOCODING_TRUST_ZERO_EXIT=1 跳过此检查；亦可稍等 2 秒后点「重置状态」再「开始」重试（已内置多次重读）。",
    };
  }

  return { ok: true, code: 0 };
}

/**
 * Agent 可能在进程结束前刚写入 task.json，磁盘与 Node 读缓存之间偶发不同步，故多次重试。
 * @param {string} repoRoot
 * @param {number} taskId
 */
async function waitUntilTaskMarkedDone(repoRoot, taskId) {
  const attempts = Math.max(1, Math.min(20, Number(process.env.AUTOCODING_PASS_POLL_ATTEMPTS) || 8));
  const delayMs = Math.max(50, Math.min(2000, Number(process.env.AUTOCODING_PASS_POLL_MS) || 250));
  for (let i = 0; i < attempts; i++) {
    if (isTaskDone(repoRoot, taskId)) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return isTaskDone(repoRoot, taskId);
}

async function workerLoop() {
  if (workerRunning) return;
  workerRunning = true;
  try {
    for (;;) {
      if (state.status !== "running") break;
      if (resetRequested) {
        resetRequested = false;
        state.lastError = null;
        await saveState();
        log("已应用重置请求，worker 结束。");
        break;
      }

      const queue = loadIncompleteTasks(REPO_ROOT);
      if (queue.length === 0) {
        state.status = "completed";
        state.lastError = null;
        state.lastTaskId = null;
        await saveState();
        log("task.json 中已全部 passes:true，队列完成。");
        break;
      }

      const head = queue[0];
      state.lastTaskId = head.id;
      state.lastError = null;
      await saveState();
      log(`开始任务 id=${head.id}：${head.title}`);

      const outcome = await runOneTask(head);

      if (resetRequested) {
        resetRequested = false;
        state.lastError = null;
        await saveState();
        log("已应用重置，worker 结束。");
        break;
      }

      if (state.status === "paused") {
        log(`已暂停（任务 id=${head.id}）。`);
        break;
      }

      if (!outcome.ok) {
        state.lastError =
          outcome.code === 2
            ? outcome.stderr
            : `Agent 失败：任务 id=${head.id}，退出码 ${outcome.code}。${outcome.stderr ? "\n" + outcome.stderr.slice(-2000) : ""}`;
        log(state.lastError);
        state.status = "idle";
        await saveState();
        break;
      }

      log(`任务 id=${head.id} 已完成（task.json 已标记 passes）。`);
    }

    if (state.status === "running") {
      state.status = "idle";
      await saveState();
    }
  } finally {
    workerRunning = false;
    lastAgentPid = undefined;
  }
}

function json(res, code, obj, cors = true) {
  const body = JSON.stringify(obj);
  /** @type {import("node:http").OutgoingHttpHeaders} */
  const h = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (cors) {
    h["Access-Control-Allow-Origin"] = "*";
  }
  res.writeHead(code, h);
  res.end(body);
}

async function handleControl(body) {
  const action = body?.action;

  if (action === "start") {
    if (state.status === "running") {
      return { ok: false, error: "已在运行中" };
    }
    const queue = loadIncompleteTasks(REPO_ROOT);
    if (queue.length === 0) {
      return { ok: false, error: "没有未完成任务（task.json 全部 passes:true）。" };
    }
    state.status = "running";
    state.lastError = null;
    await saveState();
    workerLoop().catch(async (e) => {
      log(`worker 异常: ${e?.message || e}`);
      state.status = "idle";
      state.lastError = String(e?.message || e);
      try {
        await saveState();
      } catch (err) {
        log(`保存状态失败: ${/** @type {Error} */ (err).message}`);
      }
    });
    return { ok: true };
  }

  if (action === "pause") {
    if (state.status !== "running") {
      return { ok: true, message: "当前未在运行" };
    }
    state.status = "paused";
    killAgentTreeBestEffort();
    await saveState();
    log("用户请求暂停。");
    return { ok: true };
  }

  if (action === "reset") {
    const running = state.status === "running";
    resetRequested = running;
    killAgentTreeBestEffort();
    state.lastError = null;
    state.lastTaskId = null;
    state.status = "idle";
    await saveState();
    log("状态已重置为空闲。");
    return { ok: true };
  }

  return { ok: false, error: "未知 action" };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function listenWithPortFallback(server) {
  const strict =
    process.env.PORT_STRICT === "1" ||
    process.env.PORT_STRICT === "true";
  const maxTries = strict ? 1 : 30;
  return new Promise((resolve, reject) => {
    let offset = 0;
    const attempt = () => {
      const requestedPort = PREFERRED_PORT + offset;

      const cleanup = () => {
        server.removeListener("listening", onListening);
        server.removeListener("error", onError);
      };

      const onListening = () => {
        cleanup();
        const addr = server.address();
        const actual =
          addr && typeof addr === "object" && "port" in addr ? addr.port : requestedPort;
        resolve(actual);
      };

      const onError = (err) => {
        cleanup();
        if (err.code === "EADDRINUSE" && offset < maxTries - 1) {
          offset += 1;
          const next = PREFERRED_PORT + offset;
          log(`端口 ${requestedPort} 占用，尝试 ${next} …`);
          server.close(() => attempt());
        } else {
          reject(err);
        }
      };

      server.once("listening", onListening);
      server.once("error", onError);
      server.listen(requestedPort, HOST);
    };
    attempt();
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${HOST}:${httpPort}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    try {
      const html = await fsp.readFile(path.join(PUBLIC_DIR, "index.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/status") {
    let pending = [];
    try {
      pending = loadIncompleteTasks(REPO_ROOT);
    } catch (e) {
      return json(res, 500, { ok: false, error: String(/** @type {Error} */ (e).message || e) }, true);
    }
    json(
      res,
      200,
      {
        ok: true,
        repoRoot: REPO_ROOT,
        pendingCount: pending.length,
        nextTask: pending[0]
          ? { id: pending[0].id, title: pending[0].title }
          : null,
        status: state.status,
        lastError: state.lastError,
        lastTaskId: state.lastTaskId,
        recentLog: logLines,
        agentTimeoutMs: AGENT_TIMEOUT_MS,
      },
      true,
    );
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/control") {
    const body = await readBody(req);
    const out = await handleControl(body);
    json(res, out.ok ? 200 : 400, out, true);
    return;
  }

  json(res, 404, { ok: false, error: "Not found" }, true);
}

async function main() {
  await ensureDirs();
  await loadState();
  await saveState();

  log(`仓库根目录: ${REPO_ROOT}`);
  log(`未完成 task 数: ${loadIncompleteTasks(REPO_ROOT).length}；面板状态: ${state.status}`);

  const nodeMajor = Number(String(process.versions.node || "0").split(".")[0]);
  if (Number.isFinite(nodeMajor) && nodeMajor >= 24) {
    log(
      `提示: 当前 Node 为 ${process.version}。若 Agent 异常，可改用 Node 20/22 LTS；并确保已执行 agent login。`,
    );
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((e) => {
      json(res, 500, { ok: false, error: String(e?.message || e) }, true);
    });
  });

  try {
    httpPort = await listenWithPortFallback(server);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
  if (httpPort !== PREFERRED_PORT) {
    log(`已改用端口 ${httpPort}（首选 ${PREFERRED_PORT} 不可用）`);
  }
  log(`监听 http://${HOST}:${httpPort}/ （建议仅本机）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
