/**
 * 各子项目「一键清理」：重置 task.json 完成标记、按项目规则删除生成代码、恢复占位首页、写入 progress.txt。
 */
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { formatBeijingDateOnly } from "./beijing-time.mjs";
import { deriveModulePlanPath } from "./module-scheduler.mjs";

const AGENT_PANEL_PORT = Number(process.env.PORT) || 3910;
const AGENT_PANEL_HOST = process.env.HOST || "127.0.0.1";
const AGENT_PANEL_URL = `http://${AGENT_PANEL_HOST}:${AGENT_PANEL_PORT}/agent.html`;

/**
 * @param {string} slug 项目 id（URL 参数）
 * @param {string} title 页面主标题
 * @param {string} codeLabel 小写英文名（与目录名一致即可）
 */
function nextPlaceholderHome(slug, title, codeLabel) {
  const agentHref = `${AGENT_PANEL_URL}?project=${encodeURIComponent(slug)}`;
  return `import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <main className="max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">
          ${codeLabel}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          ${title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-400">
          项目已重置为干净起点。请在本机启动{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
            tools/auto-coding-agent
          </code>{" "}
          后，从本项目的{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
            task.json
          </code>{" "}
          第 1 条任务起推进。
        </p>
        <p className="mt-8">
          <Link
            href="${agentHref}"
            className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-950/40 px-5 py-2.5 text-sm font-medium text-emerald-300/95 hover:bg-emerald-900/50"
          >
            一键全自动开发（面板）
          </Link>
        </p>
      </main>
    </div>
  );
}
`;
}

const LINK_GAME_HOME_PLACEHOLDER = `import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <main className="max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">
          link-game
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          连连看
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-400">
          项目已重置为干净起点。请在本机启动{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
            tools/auto-coding-agent
          </code>{" "}
          后，从仓库根目录{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
            task.json
          </code>{" "}
          第 1 条任务起推进。
        </p>
        <p className="mt-8">
          <Link
            href="/dev/agent"
            className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-950/40 px-5 py-2.5 text-sm font-medium text-emerald-300/95 hover:bg-emerald-900/50"
          >
            一键全自动开发（Cursor CLI）
          </Link>
        </p>
      </main>
    </div>
  );
}
`;

/**
 * @param {string} absTaskPath
 */
async function resetAllPassesInTaskJson(absTaskPath) {
  const raw = await fsp.readFile(absTaskPath, "utf8");
  const data = JSON.parse(raw);
  if (Array.isArray(data.tasks)) {
    for (const t of data.tasks) {
      if (t && typeof t === "object") t.passes = false;
    }
  }
  await fsp.writeFile(absTaskPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * @param {string} repoRoot
 * @param {string} headingLine 含日期的标题行
 * @param {string} bodyMarkdown progress 正文（Markdown）
 */
async function appendProgressCleanupBlock(repoRoot, headingLine, bodyMarkdown) {
  const progressPath = path.join(repoRoot, "progress.txt");
  let existing = "";
  try {
    existing = await fsp.readFile(progressPath, "utf8");
  } catch {
    existing = "";
  }

  const block = `## ${headingLine}

${bodyMarkdown}

---

`;

  if (existing.startsWith("# Progress Log")) {
    const rest = existing.replace(/^# Progress Log\s*\n+/, "");
    await fsp.writeFile(progressPath, `# Progress Log\n\n${block}${rest}`, "utf8");
  } else {
    await fsp.writeFile(progressPath, `# Progress Log\n\n${block}${existing}`, "utf8");
  }
}

/**
 * @param {string} repoRoot
 * @param {{ id: string; name?: string; dir: string; taskJsonPath: string | null }} project
 */
async function cleanupLinkGame(repoRoot) {
  const root = path.resolve(repoRoot);
  const taskPath = path.join(root, "task.json");
  await resetAllPassesInTaskJson(taskPath);

  const gameLib = path.join(root, "link-game", "lib", "game");
  await fsp.rm(gameLib, { recursive: true, force: true }).catch(() => {});

  const pagePath = path.join(root, "link-game", "app", "page.tsx");
  await fsp.writeFile(pagePath, LINK_GAME_HOME_PLACEHOLDER, "utf8");

  const stamp = formatBeijingDateOnly();
  const body = `### What was done:
- 根目录 \`task.json\`：全部任务 \`passes\` 已设为 \`false\`。
- \`link-game/lib/game/\`：若存在则已删除。
- \`link-game/app/page.tsx\`：已恢复为干净起点占位页。
- 面板：运行中的 agent 已终止，提示词/CLI 缓冲已清空（由服务端与「重置状态」一致处理）。

### Notes:
- 从 \`task.json\` 任务 1 起可重新全自动推进。`;

  await appendProgressCleanupBlock(repoRoot, `${stamp} - 面板：连连看项目清理（一键重置）`, body);
}

/**
 * @param {string} repoRoot
 * @param {{ id: string; dir: string; taskJsonPath: string }} project
 */
async function cleanupDuiduipeng(repoRoot, project) {
  const root = path.resolve(repoRoot);
  const projRoot = path.join(root, project.dir);
  const taskPath = path.join(root, project.taskJsonPath);
  await resetAllPassesInTaskJson(taskPath);

  await fsp.rm(path.join(projRoot, "lib"), { recursive: true, force: true }).catch(() => {});
  await fsp.rm(path.join(projRoot, "components"), { recursive: true, force: true }).catch(() => {});

  const pagePath = path.join(projRoot, "app", "page.tsx");
  await fsp.mkdir(path.dirname(pagePath), { recursive: true });
  await fsp.writeFile(pagePath, nextPlaceholderHome("duiduipeng", "对对碰", "duiduipeng"), "utf8");

  const stamp = formatBeijingDateOnly();
  const body = `### What was done:
- \`${project.taskJsonPath}\`：全部任务 \`passes\` 已设为 \`false\`。
- \`${project.dir}/lib/\`、\`${project.dir}/components/\`：若存在则已删除。
- \`${project.dir}/app/page.tsx\`：已恢复为占位首页。
- 面板：与「重置状态」一致处理。

### Notes:
- 从 \`${project.taskJsonPath}\` 任务 1 起可重新全自动推进。`;

  await appendProgressCleanupBlock(repoRoot, `${stamp} - 面板：对对碰项目清理（一键重置）`, body);
}

/**
 * @param {string} repoRoot
 * @param {{ id: string; dir: string; taskJsonPath: string }} project
 */
async function cleanupSuduku(repoRoot, project) {
  const root = path.resolve(repoRoot);
  const projRoot = path.join(root, project.dir);
  const taskPath = path.join(root, project.taskJsonPath);
  await resetAllPassesInTaskJson(taskPath);

  const planRel = deriveModulePlanPath(project.taskJsonPath);
  const planPath = path.join(root, planRel);

  /** @type {{ modules?: Array<{ dir?: string; status?: string; error?: string }> } | null} */
  let plan = null;
  try {
    const raw = await fsp.readFile(planPath, "utf8");
    plan = JSON.parse(raw);
  } catch {
    plan = null;
  }

  if (plan && Array.isArray(plan.modules)) {
    for (const m of plan.modules) {
      m.status = "pending";
      delete m.error;
    }
    await fsp.writeFile(planPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
  }

  await fsp.rm(path.join(projRoot, "modules"), { recursive: true, force: true }).catch(() => {});
  await fsp.rm(path.join(projRoot, "components"), { recursive: true, force: true }).catch(() => {});

  if (plan && Array.isArray(plan.modules)) {
    const tops = new Set();
    for (const m of plan.modules) {
      if (m && typeof m.dir === "string" && m.dir.trim()) {
        tops.add(m.dir.split(/[/\\]/)[0]);
      }
    }
    for (const top of tops) {
      if (top === "app") continue;
      await fsp.rm(path.join(projRoot, top), { recursive: true, force: true }).catch(() => {});
    }
  }

  const pagePath = path.join(projRoot, "app", "page.tsx");
  await fsp.mkdir(path.dirname(pagePath), { recursive: true });
  await fsp.writeFile(pagePath, nextPlaceholderHome("suduku", "数独", "suduku"), "utf8");

  const stamp = formatBeijingDateOnly();
  const planNote = plan ? `、\`${planRel}\` 模块状态已重置为 pending` : "";
  const body = `### What was done:
- \`${project.taskJsonPath}\`：全部任务 \`passes\` 已设为 \`false\`${planNote}。
- \`${project.dir}/modules/\`：若存在则已删除。
- 按 \`module-plan.json\` 中各模块目录清理实现代码（\`app/\` 仅恢复 \`page.tsx\` 占位）；\`components/\` 若存在则已删除。
- 面板：与「重置状态」一致处理。

### Notes:
- 请从模块化任务或 \`${project.taskJsonPath}\` 重新推进。`;

  await appendProgressCleanupBlock(repoRoot, `${stamp} - 面板：数独项目清理（一键重置）`, body);
}

/**
 * @param {string} repoRoot
 * @param {{ id: string; name?: string; taskJsonPath: string }} project
 */
async function cleanupGeneric(repoRoot, project) {
  const taskPath = path.join(repoRoot, project.taskJsonPath);
  await resetAllPassesInTaskJson(taskPath);
  const stamp = formatBeijingDateOnly();
  const label = project.name || project.id;
  const body = `### What was done:
- \`${project.taskJsonPath}\`：全部任务 \`passes\` 已设为 \`false\`。
- 未对此项目执行额外目录删除（非内置项目类型请在仓库内手动清理或使用专用脚本）。
- 面板：与「重置状态」一致处理。`;

  await appendProgressCleanupBlock(repoRoot, `${stamp} - 面板：${label} 项目清理（任务标记重置）`, body);
}

/**
 * @param {string} repoRoot
 * @param {{ id: string; name?: string; dir: string; taskJsonPath: string | null }} project
 */
export async function performProjectCleanup(repoRoot, project) {
  if (!project?.taskJsonPath) {
    throw new Error("该项目未配置 task.json，无法执行代码清理。可使用「重置状态」仅清空面板。");
  }
  const taskAbs = path.join(repoRoot, project.taskJsonPath);
  if (!fs.existsSync(taskAbs)) {
    throw new Error(`找不到任务文件：${project.taskJsonPath}`);
  }

  switch (project.id) {
    case "link-game":
      await cleanupLinkGame(repoRoot);
      return;
    case "duiduipeng":
      await cleanupDuiduipeng(repoRoot, /** @type {any} */ (project));
      return;
    case "suduku":
      await cleanupSuduku(repoRoot, /** @type {any} */ (project));
      return;
    default:
      await cleanupGeneric(repoRoot, /** @type {any} */ (project));
  }
}

/** @deprecated 使用 performProjectCleanup */
export async function performLinkGameProjectReset(repoRoot) {
  await cleanupLinkGame(repoRoot);
}
