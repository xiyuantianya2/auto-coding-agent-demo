/**
 * 调用 Cursor Agent CLI（与 curriculum-cursor-check 同源参数风格）
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * @param {string} command
 */
function resolveExecutable(command) {
  if (path.isAbsolute(command) || command.includes(path.sep)) {
    return command;
  }
  if (process.platform === "win32") {
    const lower = String(command).toLowerCase();
    if (lower === "agent") {
      const dir = path.join(process.env.LOCALAPPDATA || "", "cursor-agent");
      const exeFile = path.join(dir, "agent.exe");
      if (existsSync(exeFile)) {
        return exeFile;
      }
      const cmdFile = path.join(dir, "agent.cmd");
      if (existsSync(cmdFile)) {
        return cmdFile;
      }
    }
    if (lower === "cursor") {
      const cursorExe = path.join(process.env.LOCALAPPDATA || "", "Programs", "cursor", "Cursor.exe");
      if (existsSync(cursorExe)) {
        return cursorExe;
      }
    }
  }
  return command;
}

/**
 * @returns {NodeJS.ProcessEnv}
 */
function envForAgentChild() {
  if (process.env.AUTOCODING_PASS_NODE_OPTIONS === "1" || process.env.AUTOCODING_PASS_NODE_OPTIONS === "true") {
    return process.env;
  }
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  return env;
}

function cmdQuotedToken(arg) {
  const s = String(arg);
  if (/[ \t\n\r"*&|<>^%]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCmdOneLine(executable, argv) {
  return [cmdQuotedToken(executable), ...argv.map(cmdQuotedToken)].join(" ");
}

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
  }
}

function isAgentExecutable(executable) {
  const base = path.basename(executable, path.extname(executable)).toLowerCase();
  return base === "agent";
}

/**
 * @param {string} hostCommand
 * @param {string[]} standaloneArgs
 * @returns {string[]}
 */
function argvForHost(hostCommand, standaloneArgs) {
  const resolved = resolveExecutable(hostCommand);
  const base = path.basename(resolved, path.extname(resolved)).toLowerCase();
  if (base === "cursor") {
    return ["agent", "--", ...standaloneArgs];
  }
  return standaloneArgs;
}

/**
 * 组装 agent CLI 参数。默认显式传 `--model auto`，与 IDE 中「Auto」路由一致；
 * 若省略 `--model`，当前 CLI 往往会落到 `composer-2-fast` 等固定模型。
 *
 * 若某环境对 `--model auto` 报错，可设环境变量 `AUTOCODING_AGENT_MODEL=omit`（不传 --model，恢复旧行为）。
 *
 * @param {string} modelRaw 来自 override 或 AUTOCODING_AGENT_MODEL；空则视为 auto
 * @param {string} workspaceRoot
 * @param {string} agentMessage
 */
function buildStandaloneArgs(modelRaw, workspaceRoot, agentMessage) {
  const args = ["-p", "-f", "--trust"];
  let resolved = String(modelRaw ?? "").trim();
  if (!resolved) {
    resolved = "auto";
  }
  const m = resolved.toLowerCase();
  if (m === "omit" || m === "legacy" || m === "none") {
    /* 不传 --model，由 CLI 自选（常为 composer-2-fast） */
  } else {
    args.push("--model", resolved);
  }
  args.push("--workspace", workspaceRoot, agentMessage);
  return args;
}

/**
 * @param {string} workspaceRoot
 * @param {string} agentMessage
 * @param {string} [modelOverride]
 * @param {number} timeoutMs
 * @param {{ onStdout?: (s: string) => void; onStderr?: (s: string) => void; onSpawn?: (pid: number | undefined, stdin: import("node:stream").Writable | null) => void }} [hooks]
 * @returns {Promise<{ code: number; stdout: string; stderr: string }>}
 */
export async function runCursorAgent(workspaceRoot, agentMessage, modelOverride, timeoutMs, hooks) {
  const root = path.resolve(workspaceRoot);
  const model = modelOverride !== undefined && modelOverride !== null
    ? String(modelOverride)
    : process.env.AUTOCODING_AGENT_MODEL ?? "";

  const standaloneArgs = buildStandaloneArgs(model, root, agentMessage);

  /** @type {{ cmd: string; args: string[] }[]} */
  let attempts;
  const custom = process.env.CURSOR_CLI?.trim();
  if (custom) {
    attempts = [
      {
        cmd: custom,
        args: isAgentExecutable(custom)
          ? argvForHost(custom, standaloneArgs)
          : (() => {
              const resolved = resolveExecutable(custom);
              const base = path.basename(resolved, path.extname(resolved)).toLowerCase();
              return base === "cursor"
                ? ["agent", "--", ...standaloneArgs]
                : ["agent", ...standaloneArgs];
            })(),
      },
    ];
  } else {
    attempts = [{ cmd: "agent", args: argvForHost("agent", standaloneArgs) }];
    const useCursorExeFallback =
      process.env.AUTOCODING_USE_CURSOR_EXE_FALLBACK === "1" ||
      process.env.AUTOCODING_USE_CURSOR_EXE_FALLBACK === "true";
    if (process.platform !== "win32" || useCursorExeFallback) {
      attempts.push({ cmd: "cursor", args: argvForHost("cursor", standaloneArgs) });
    }
  }

  let lastStderr = "";
  for (const { cmd, args } of attempts) {
    const result = await runChild(cmd, args, root, timeoutMs, hooks);
    if (result.code === 0) {
      return result;
    }
    lastStderr = result.stderr || `命令 ${cmd} 退出码 ${result.code}`;
  }
  return { code: 1, stdout: "", stderr: lastStderr || "无法启动 Cursor Agent CLI" };
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @param {number} timeoutMs
 * @param {{ onStdout?: (s: string) => void; onStderr?: (s: string) => void; onSpawn?: (pid: number | undefined, stdin: import("node:stream").Writable | null) => void }} [hooks]
 */
function runChild(command, args, cwd, timeoutMs, hooks) {
  return new Promise((resolve) => {
    const exe = resolveExecutable(command);
    const low = exe.toLowerCase();
    const win = process.platform === "win32";
    const isDirectExe = win && low.endsWith(".exe");
    const isCmdScript = win && (low.endsWith(".cmd") || low.endsWith(".bat"));

    let child;
    const childEnv = envForAgentChild();
    if (isDirectExe) {
      child = spawn(exe, args, {
        cwd,
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
      });
    } else if (isCmdScript || (win && !exe.includes(path.sep) && !path.isAbsolute(exe))) {
      const line = buildCmdOneLine(exe, args);
      child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", line], {
        cwd,
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
      });
    } else {
      child = spawn(exe, args, {
        cwd,
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
      });
    }

    hooks?.onSpawn?.(child.pid, child.stdin ?? null);

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        const pid = child.pid;
        if (process.platform === "win32" && pid) {
          killProcessTreeBestEffort(pid);
        } else {
          try {
            child.kill("SIGTERM");
          } catch {
            /* ignore */
          }
          setTimeout(() => {
            try {
              child.kill("SIGKILL");
            } catch {
              /* ignore */
            }
          }, 5000);
        }
      }, timeoutMs);
    }

    const MAX_STDERR_BYTES = 64 * 1024;
    const MAX_STDOUT_BYTES = 4 * 1024 * 1024;
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      const s = String(chunk);
      const room = MAX_STDOUT_BYTES - stdout.length;
      if (room > 0) {
        stdout += s.length > room ? s.slice(0, room) : s;
      }
      hooks?.onStdout?.(s);
    });
    child.stderr?.on("data", (chunk) => {
      const s = String(chunk);
      const room = MAX_STDERR_BYTES - stderr.length;
      if (room > 0) {
        stderr += s.length > room ? s.slice(0, room) : s;
      }
      hooks?.onStderr?.(s);
    });
    child.on("error", (err) => {
      const msg = err?.message || String(err);
      stderr += (stderr ? "\n" : "") + `[spawn error] ${msg}`;
      settle({ code: 1, stdout, stderr });
    });
    child.on("close", (code) => {
      if (timedOut) {
        settle({
          code: 124,
          stdout,
          stderr: stderr + `\n[超时] Agent 超过 ${Math.round(timeoutMs / 1000)}s 未完成，已终止。`,
        });
      } else {
        settle({ code: code ?? 1, stdout, stderr });
      }
    });
  });
}
