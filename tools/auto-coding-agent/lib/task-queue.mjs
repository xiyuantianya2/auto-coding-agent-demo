import fs from "node:fs";
import path from "node:path";

/**
 * 未完成：未显式标记为 `passes: true`（含缺失/null，避免被队列漏掉从而「跳过」当前任务）。
 * @param {object | null | undefined} t
 * @returns {boolean}
 */
export function isTaskIncomplete(t) {
  return !!(t && t.passes !== true);
}

/**
 * @param {string} repoRoot
 * @param {string} [taskJsonPath] 可选的自定义 task.json 路径，默认为 repoRoot/task.json
 * @returns {{ id: number; title: string; description?: string; steps: string[]; passes: boolean }[]}
 */
export function loadIncompleteTasks(repoRoot, taskJsonPath) {
  const p = taskJsonPath || path.join(repoRoot, "task.json");
  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw);
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  return tasks
    .filter((t) => isTaskIncomplete(t))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

/**
 * @param {string} repoRoot
 * @param {number} taskId
 * @param {string} [taskJsonPath] 可选的自定义 task.json 路径
 */
export function isTaskDone(repoRoot, taskId, taskJsonPath) {
  const p = taskJsonPath || path.join(repoRoot, "task.json");
  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw);
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const t = tasks.find((x) => Number(x.id) === Number(taskId));
  return !!(t && t.passes === true);
}

/**
 * 与 loadIncompleteTasks 相同，但任务文件不存在或解析失败时返回空数组（供模块化路径使用）。
 * @param {string} repoRoot
 * @param {string} [taskJsonPath]
 */
export function loadIncompleteTasksSafe(repoRoot, taskJsonPath) {
  try {
    return loadIncompleteTasks(repoRoot, taskJsonPath);
  } catch {
    return [];
  }
}

/**
 * 与 isTaskDone 相同，但任务文件不存在或解析失败时返回 false。
 */
export function isTaskDoneSafe(repoRoot, taskId, taskJsonPath) {
  try {
    return isTaskDone(repoRoot, taskId, taskJsonPath);
  } catch {
    return false;
  }
}

/**
 * 加载未完成任务；文件不存在、不可读或 JSON 无效时返回 { ok:false, error }，不抛错。
 * @returns {{ ok: true, tasks: object[] } | { ok: false, error: string, tasks: [] }}
 */
export function tryLoadIncompleteTasks(repoRoot, taskJsonPath) {
  try {
    const tasks = loadIncompleteTasks(repoRoot, taskJsonPath);
    return { ok: true, tasks };
  } catch (e) {
    return { ok: false, tasks: [], error: String(e?.message || e) };
  }
}

/**
 * 判断某任务是否为 task.json「tasks」数组中的最后一项（按文件中的顺序）。
 * 用于全自动化开发：仅最后一项跑全量测试，其余任务只跑与本任务相关的测试。
 * @param {string} repoRoot
 * @param {string} taskJsonPath 相对 repoRoot 的路径，或绝对路径
 * @param {number} taskId
 * @returns {boolean}
 */
export function isLastPlannedTask(repoRoot, taskJsonPath, taskId) {
  const p = path.isAbsolute(taskJsonPath) ? taskJsonPath : path.join(repoRoot, taskJsonPath);
  const raw = fs.readFileSync(p, "utf8");
  const data = JSON.parse(raw);
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  if (tasks.length === 0) return false;
  const last = tasks[tasks.length - 1];
  return Number(last?.id) === Number(taskId);
}

