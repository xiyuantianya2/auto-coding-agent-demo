import fsp from "node:fs/promises";
import path from "node:path";
import { formatBeijingDateOnly } from "./beijing-time.mjs";

/** 与「从头自动化」一致的占位首页 */
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
 * 将连连看相关仓库状态恢复为「从零全自动」起点（不停止本 Node 进程）。
 * @param {string} repoRoot
 */
export async function performLinkGameProjectReset(repoRoot) {
  const root = path.resolve(repoRoot);

  const taskPath = path.join(root, "task.json");
  const raw = await fsp.readFile(taskPath, "utf8");
  const data = JSON.parse(raw);
  if (Array.isArray(data.tasks)) {
    for (const t of data.tasks) {
      if (t && typeof t === "object") t.passes = false;
    }
  }
  await fsp.writeFile(taskPath, JSON.stringify(data, null, 2) + "\n", "utf8");

  const gameLib = path.join(root, "link-game", "lib", "game");
  await fsp.rm(gameLib, { recursive: true, force: true }).catch(() => {});

  const pagePath = path.join(root, "link-game", "app", "page.tsx");
  await fsp.writeFile(pagePath, LINK_GAME_HOME_PLACEHOLDER, "utf8");

  const progressPath = path.join(root, "progress.txt");
  let existing = "";
  try {
    existing = await fsp.readFile(progressPath, "utf8");
  } catch {
    existing = "";
  }

  const stamp = formatBeijingDateOnly();
  const body = `### What was done:
- 根目录 \`task.json\`：全部任务 \`passes\` 已设为 \`false\`。
- \`link-game/lib/game/\`：若存在则已删除。
- \`link-game/app/page.tsx\`：已恢复为干净起点占位页。
- 面板：运行中的 agent 已终止，提示词/CLI 缓冲已清空（由服务端与「重置状态」一致处理）。

### Notes:
- 从 \`task.json\` 任务 1 起可重新全自动推进。`;

  const block = `## ${stamp} - 面板：连连看项目清理（一键重置）

${body}

---

`;

  if (existing.startsWith("# Progress Log")) {
    const rest = existing.replace(/^# Progress Log\s*\n+/, "");
    await fsp.writeFile(progressPath, `# Progress Log\n\n${block}${rest}`, "utf8");
  } else {
    await fsp.writeFile(progressPath, `# Progress Log\n\n${block}${existing}`, "utf8");
  }
}
