import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} repoRoot
 * @returns {{ id: number; title: string; description?: string; steps: string[]; passes: boolean }[]}
 */
export function loadIncompleteTasks(repoRoot) {
  const p = path.join(repoRoot, "task.json");
  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw);
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  return tasks
    .filter((t) => t && t.passes === false)
    .sort((a, b) => Number(a.id) - Number(b.id));
}

/**
 * @param {string} repoRoot
 * @param {number} taskId
 */
export function isTaskDone(repoRoot, taskId) {
  const p = path.join(repoRoot, "task.json");
  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw);
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const t = tasks.find((x) => Number(x.id) === Number(taskId));
  return !!(t && t.passes === true);
}
