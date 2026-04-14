/**
 * 模块调度器：加载 module-plan.json、拓扑排序、状态管理。
 * 为大型项目提供模块级分解能力，使每个模块拥有独立的 task.json。
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

/**
 * @typedef {{
 *   id: string;
 *   title: string;
 *   description: string;
 *   dir: string;
 *   dependencies: string[];
 *   interface: string;
 *   status: "pending" | "initializing" | "running" | "completed" | "failed";
 *   error?: string;
 * }} ModuleDef
 *
 * @typedef {{
 *   project: string;
 *   description: string;
 *   modules: ModuleDef[];
 * }} ModulePlan
 */

/**
 * 从 task.json 路径推导 module-plan.json 路径。
 * 例: "sudoku/task.json" → "sudoku/module-plan.json"
 * @param {string} taskJsonPath 相对于 repoRoot 的 task.json 路径
 * @returns {string}
 */
export function deriveModulePlanPath(taskJsonPath) {
  const dir = path.dirname(taskJsonPath);
  return path.join(dir, "module-plan.json");
}

/**
 * 推导某个模块的 task.json 路径。
 * 例: taskJsonPath="sudoku/task.json", moduleId="solver" → "sudoku/modules/solver.task.json"
 * @param {string} taskJsonPath
 * @param {string} moduleId
 * @returns {string}
 */
export function deriveModuleTaskJsonPath(taskJsonPath, moduleId) {
  const dir = path.dirname(taskJsonPath);
  return path.join(dir, "modules", `${moduleId}.task.json`);
}

/**
 * @param {string} repoRoot
 * @param {string} taskJsonPath
 * @returns {ModulePlan | null}
 */
export function loadModulePlan(repoRoot, taskJsonPath) {
  const planPath = path.join(repoRoot, deriveModulePlanPath(taskJsonPath));
  try {
    const raw = fs.readFileSync(planPath, "utf8");
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.modules)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * @param {string} repoRoot
 * @param {string} taskJsonPath
 * @param {ModulePlan} plan
 */
export async function saveModulePlan(repoRoot, taskJsonPath, plan) {
  const planPath = path.join(repoRoot, deriveModulePlanPath(taskJsonPath));
  await fsp.mkdir(path.dirname(planPath), { recursive: true });
  await fsp.writeFile(planPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
}

/**
 * 检查 module-plan.json 是否存在。
 * @param {string} repoRoot
 * @param {string} taskJsonPath
 * @returns {boolean}
 */
export function hasModulePlan(repoRoot, taskJsonPath) {
  const planPath = path.join(repoRoot, deriveModulePlanPath(taskJsonPath));
  try {
    fs.accessSync(planPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 拓扑排序：按依赖顺序排列模块。若存在环则抛出错误。
 * @param {ModuleDef[]} modules
 * @returns {ModuleDef[]}
 */
export function topologicalSort(modules) {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const visited = new Set();
  const temp = new Set();
  /** @type {ModuleDef[]} */
  const result = [];

  function visit(id) {
    if (visited.has(id)) return;
    if (temp.has(id)) {
      throw new Error(`模块依赖存在循环：${id}`);
    }
    temp.add(id);
    const mod = byId.get(id);
    if (mod) {
      for (const dep of mod.dependencies || []) {
        if (byId.has(dep)) visit(dep);
      }
    }
    temp.delete(id);
    visited.add(id);
    if (mod) result.push(mod);
  }

  for (const m of modules) visit(m.id);
  return result;
}

/**
 * 获取下一个需要处理的模块（按拓扑序，跳过 completed）。
 * @param {ModulePlan} plan
 * @returns {{ module: ModuleDef; index: number } | null}
 */
export function getNextPendingModule(plan) {
  const sorted = topologicalSort(plan.modules);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].status !== "completed") {
      return { module: sorted[i], index: i };
    }
  }
  return null;
}

/**
 * 检查模块的所有依赖是否已完成。
 * @param {ModulePlan} plan
 * @param {string} moduleId
 * @returns {boolean}
 */
export function areDependenciesMet(plan, moduleId) {
  const mod = plan.modules.find((m) => m.id === moduleId);
  if (!mod) return false;
  for (const depId of mod.dependencies || []) {
    const dep = plan.modules.find((m) => m.id === depId);
    if (!dep) return false;
    if (dep.status !== "completed") return false;
  }
  return true;
}

/**
 * 更新模块状态。
 * @param {ModulePlan} plan
 * @param {string} moduleId
 * @param {"pending" | "initializing" | "running" | "completed" | "failed"} status
 * @param {string} [error]
 */
export function setModuleStatus(plan, moduleId, status, error) {
  const mod = plan.modules.find((m) => m.id === moduleId);
  if (!mod) return;
  mod.status = status;
  if (error !== undefined) mod.error = error;
  else delete mod.error;
}

/**
 * 获取模块计划的概要统计。
 * @param {ModulePlan} plan
 */
export function getModulePlanSummary(plan) {
  const total = plan.modules.length;
  const completed = plan.modules.filter((m) => m.status === "completed").length;
  const failed = plan.modules.filter((m) => m.status === "failed").length;
  const running = plan.modules.filter((m) => m.status === "running" || m.status === "initializing").length;
  const pending = total - completed - failed - running;
  return { total, completed, failed, running, pending };
}

/**
 * 获取已完成模块的接口摘要（供后续模块初始化时参考）。
 * @param {ModulePlan} plan
 * @returns {string}
 */
export function getCompletedModulesSummary(plan) {
  const completed = plan.modules.filter((m) => m.status === "completed");
  if (completed.length === 0) return "（尚无已完成的模块）";
  return completed
    .map((m) => {
      const importHint = m.dir ? `import from "@/${m.dir}"` : "";
      return `- ${m.title}（${m.id}）：目录 ${m.dir}${importHint ? `，引用方式：\`${importHint}\`` : ""}，接口：${m.interface}`;
    })
    .join("\n");
}
