/**
 * 本地 Web：多项目管理 + 按 task.json 中 passes:false 的任务顺序调用 Cursor Agent CLI 全自动实现。
 * 每个子项目拥有独立的运行时状态，可并行执行 agent。
 */
import http from "node:http";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initRegistry, listProjects, getProject, addProject, removeProject, getProjectTaskSummary } from "./lib/projects.mjs";
import { ProjectRuntime } from "./lib/project-runtime.mjs";
import { formatBeijingDateTime } from "./lib/beijing-time.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOOL_ROOT = __dirname;
const DEFAULT_REPO = path.resolve(TOOL_ROOT, "..", "..");

const REPO_ROOT = path.resolve(process.env.AUTO_CODING_REPO_ROOT || DEFAULT_REPO);
const DATA_DIR = path.join(REPO_ROOT, ".auto-coding-agent");
const PUBLIC_DIR = path.join(TOOL_ROOT, "public");

const PREFERRED_PORT = Number(process.env.PORT) || 3910;
const HOST = process.env.HOST || "127.0.0.1";
let httpPort = PREFERRED_PORT;

const AGENT_TIMEOUT_MS = Math.max(60_000, Number(process.env.AUTOCODING_AGENT_TIMEOUT_MS) || 45 * 60 * 1000);
const MAX_AGENT_CLI_CHARS = Math.max(
  50_000,
  Math.min(4 * 1024 * 1024, Number(process.env.AUTOCODING_AGENT_CLI_MAX_CHARS) || 900_000),
);

// ── Per-project runtime instances ───────────────────────────────────

/** @type {Map<string, ProjectRuntime>} */
const runtimes = new Map();

/**
 * 获取或创建项目的运行时实例。
 * @param {string} projectId
 * @returns {Promise<ProjectRuntime | null>}
 */
async function getRuntime(projectId) {
  if (runtimes.has(projectId)) return runtimes.get(projectId);
  const proj = getProject(projectId);
  if (!proj) return null;
  const rt = new ProjectRuntime(proj, REPO_ROOT, DATA_DIR, {
    agentTimeoutMs: AGENT_TIMEOUT_MS,
    maxCliChars: MAX_AGENT_CLI_CHARS,
  });
  await rt.loadState();
  await rt.saveState();
  runtimes.set(projectId, rt);
  return rt;
}

/** 为所有已注册项目初始化 runtime */
async function initAllRuntimes() {
  for (const proj of listProjects()) {
    const rt = await getRuntime(proj.id);
    if (rt && rt.startupRecoveredRunningToPaused) {
      rt.log(
        `[启动说明] 磁盘上次记录为「运行中」，但本服务刚重启，已自动改为「已暂停」。请点「开始全自动」继续。`,
      );
    }
  }
}

// ── HTTP helpers ────────────────────────────────────────────────────

function json(res, code, obj, cors = true) {
  const body = JSON.stringify(obj);
  const h = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (cors) h["Access-Control-Allow-Origin"] = "*";
  res.writeHead(code, h);
  res.end(body);
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

function serveHtml(res, filePath) {
  return fsp
    .readFile(filePath, "utf8")
    .then((html) => {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      });
      res.end(html);
    })
    .catch((e) => {
      res.writeHead(500).end(String(e));
    });
}

// ── Port fallback ───────────────────────────────────────────────────

function listenWithPortFallback(server) {
  const strict = process.env.PORT_STRICT === "1" || process.env.PORT_STRICT === "true";
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
        resolve(addr && typeof addr === "object" && "port" in addr ? addr.port : requestedPort);
      };
      const onError = (err) => {
        cleanup();
        if (err.code === "EADDRINUSE" && offset < maxTries - 1) {
          offset += 1;
          log(`端口 ${requestedPort} 占用，尝试 ${PREFERRED_PORT + offset} …`);
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

function log(line) {
  const t = formatBeijingDateTime();
  process.stdout.write(`[${t}] ${line}\n`);
}

// ── Request router ──────────────────────────────────────────────────

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

  // ── Static pages ──────────────────────────────────────────────

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return serveHtml(res, path.join(PUBLIC_DIR, "index.html"));
  }

  if (req.method === "GET" && url.pathname === "/agent.html") {
    return serveHtml(res, path.join(PUBLIC_DIR, "agent.html"));
  }

  // ── Project management API ────────────────────────────────────

  if (req.method === "GET" && url.pathname === "/api/projects") {
    const projects = listProjects().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      dir: p.dir,
      framework: p.framework,
      icon: p.icon,
      tasks: getProjectTaskSummary(REPO_ROOT, p),
      status: runtimes.get(p.id)?.state?.status || "idle",
    }));
    return json(res, 200, { ok: true, projects }, true);
  }

  if (req.method === "POST" && url.pathname === "/api/projects/create") {
    const body = await readBody(req);
    const name = body?.name;
    const dir = body?.dir;
    if (!name || !dir) return json(res, 400, { ok: false, error: "请提供 name 和 dir" }, true);
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(dir)) {
      return json(res, 400, { ok: false, error: "目录名只能包含字母、数字、横线和下划线" }, true);
    }
    try {
      const proj = await addProject({
        name,
        dir,
        description: body.description || "",
        framework: body.framework || "",
        icon: body.icon || "📦",
      });
      await getRuntime(proj.id);
      log(`已创建项目: ${proj.id}（${proj.name}）→ ${proj.dir}/`);
      return json(res, 200, { ok: true, project: proj }, true);
    } catch (e) {
      return json(res, 400, { ok: false, error: String(e?.message || e) }, true);
    }
  }

  if (req.method === "POST" && url.pathname === "/api/projects/delete") {
    const body = await readBody(req);
    const id = body?.id;
    if (!id) return json(res, 400, { ok: false, error: "请提供 id" }, true);
    const proj = getProject(id);
    if (!proj) return json(res, 404, { ok: false, error: `项目 "${id}" 不存在` }, true);

    const rt = runtimes.get(id);
    if (rt) {
      if (rt.state.status === "running") {
        return json(res, 400, { ok: false, error: "该项目正在运行中，请先暂停后再删除。" }, true);
      }
      rt.destroy();
      await rt.deleteStateFile();
      runtimes.delete(id);
    }
    try {
      await removeProject(id, { deleteFiles: body.deleteFiles !== false });
      log(`已删除项目: ${id}（${proj.name}），文件已清理。`);
      return json(res, 200, { ok: true }, true);
    } catch (e) {
      return json(res, 500, { ok: false, error: String(e?.message || e) }, true);
    }
  }

  // ── Per-project status API ────────────────────────────────────

  if (req.method === "GET" && url.pathname === "/api/status") {
    const projectId = url.searchParams.get("project");
    if (!projectId) return json(res, 400, { ok: false, error: "缺少 project 参数" }, true);
    const rt = await getRuntime(projectId);
    if (!rt) return json(res, 404, { ok: false, error: `项目 "${projectId}" 不存在` }, true);
    return json(res, 200, rt.getStatus(), true);
  }

  // ── Per-project control API ───────────────────────────────────

  if (req.method === "POST" && url.pathname === "/api/control") {
    const body = await readBody(req);
    const projectId = body?.project;
    if (!projectId) return json(res, 400, { ok: false, error: "缺少 project 字段" }, true);
    const rt = await getRuntime(projectId);
    if (!rt) return json(res, 404, { ok: false, error: `项目 "${projectId}" 不存在` }, true);
    const out = await rt.handleControl(body);
    return json(res, out.ok ? 200 : 400, out, true);
  }

  // ── Per-project agent input ───────────────────────────────────

  if (req.method === "POST" && url.pathname === "/api/agent-input") {
    const body = await readBody(req);
    const projectId = body?.project;
    const text = body?.text;
    if (!projectId) return json(res, 400, { ok: false, error: "缺少 project 字段" }, true);
    if (!text || typeof text !== "string") return json(res, 400, { ok: false, error: "缺少 text 字段" }, true);
    const rt = await getRuntime(projectId);
    if (!rt) return json(res, 404, { ok: false, error: `项目 "${projectId}" 不存在` }, true);
    const out = rt.handleAgentInput(text);
    return json(res, out.ok ? 200 : 400, out, true);
  }

  json(res, 404, { ok: false, error: "Not found" }, true);
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await initRegistry(DATA_DIR, REPO_ROOT);
  await initAllRuntimes();

  log(`仓库根目录: ${REPO_ROOT}`);
  log(`已注册 ${listProjects().length} 个项目: ${listProjects().map((p) => p.id).join(", ")}`);

  const nodeMajor = Number(String(process.versions.node || "0").split(".")[0]);
  if (Number.isFinite(nodeMajor) && nodeMajor >= 24) {
    log(`提示: 当前 Node 为 ${process.version}。若 Agent 异常，可改用 Node 20/22 LTS。`);
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
