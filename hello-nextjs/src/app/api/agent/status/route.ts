import { readFileSync, existsSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

import { getAutomationRepoRoot } from "@/lib/agent/repo-paths";

export const runtime = "nodejs";

const PROGRESS_MAX_BYTES = 120_000;

type TaskItem = {
  id: number;
  title: string;
  passes: boolean;
};

export async function GET() {
  const root = getAutomationRepoRoot();
  if (!root) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "未找到含 task.json 的仓库根目录。本地开发时应与 hello-nextjs 同级；也可设置环境变量 AUTOMATION_REPO_ROOT。",
      },
      { status: 404 },
    );
  }

  const taskPath = path.join(root, "task.json");
  const progressPath = path.join(root, "progress.txt");

  if (!existsSync(taskPath)) {
    return NextResponse.json(
      { ok: false, error: `task.json 不存在: ${taskPath}` },
      { status: 404 },
    );
  }

  let taskJson: {
    project?: string;
    description?: string;
    tasks?: TaskItem[];
  };
  try {
    taskJson = JSON.parse(readFileSync(taskPath, "utf8")) as typeof taskJson;
  } catch {
    return NextResponse.json(
      { ok: false, error: "task.json 解析失败" },
      { status: 500 },
    );
  }

  const tasks = taskJson.tasks ?? [];
  const done = tasks.filter((t) => t.passes).length;
  const pending = tasks.filter((t) => !t.passes);
  const nextTask = pending[0] ?? null;

  let progressTail = "";
  let progressTruncated = false;
  if (existsSync(progressPath)) {
    const raw = readFileSync(progressPath, "utf8");
    if (raw.length > PROGRESS_MAX_BYTES) {
      progressTruncated = true;
      progressTail = raw.slice(-PROGRESS_MAX_BYTES);
    } else {
      progressTail = raw;
    }
  }

  return NextResponse.json({
    ok: true,
    repoRoot: root,
    project: taskJson.project ?? "",
    description: taskJson.description ?? "",
    stats: {
      total: tasks.length,
      done,
      remaining: pending.length,
    },
    nextTask,
    pendingTitles: pending.slice(0, 15).map((t) => ({
      id: t.id,
      title: t.title,
    })),
    progressTail,
    progressTruncated,
    hasProgressFile: existsSync(progressPath),
  });
}
