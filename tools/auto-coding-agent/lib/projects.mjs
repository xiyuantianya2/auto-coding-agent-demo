/**
 * 动态项目注册表：从 projects.json 加载/保存，支持 CRUD。
 * 首次运行时自动种子 link-game 和 hello-nextjs。
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { formatBeijingDateTime } from "./beijing-time.mjs";

/**
 * @typedef {{
 *   id: string;
 *   name: string;
 *   description: string;
 *   dir: string;
 *   framework: string;
 *   icon: string;
 *   taskJsonPath: string | null;
 *   createdAt: string;
 * }} ProjectDef
 */

const DEFAULT_PROJECTS = [
  {
    id: "link-game",
    name: "连连看",
    description: "Next.js 网页连连看（计时、提示、多关卡）",
    dir: "link-game",
    framework: "Next.js + Tailwind CSS",
    icon: "🀄",
    taskJsonPath: "task.json",
    createdAt: "2025-01-01T00:00:00+08:00",
  },
  {
    id: "hello-nextjs",
    name: "AI 视频生成",
    description: "AI 视频生成应用 Demo（前后端、Supabase、火山引擎视频 API）",
    dir: "hello-nextjs",
    framework: "Next.js + Supabase",
    icon: "🎬",
    taskJsonPath: null,
    createdAt: "2025-01-01T00:00:00+08:00",
  },
];

/** @type {ProjectDef[]} */
let _projects = [];
let _filePath = "";
let _repoRoot = "";

/**
 * @param {string} dataDir  .auto-coding-agent 目录
 * @param {string} repoRoot 仓库根目录
 */
export async function initRegistry(dataDir, repoRoot) {
  _filePath = path.join(dataDir, "projects.json");
  _repoRoot = repoRoot;
  await fsp.mkdir(dataDir, { recursive: true });
  try {
    const raw = await fsp.readFile(_filePath, "utf8");
    _projects = JSON.parse(raw).projects || [];
  } catch {
    _projects = DEFAULT_PROJECTS.map((p) => ({ ...p }));
    await _saveRegistry();
  }
}

async function _saveRegistry() {
  await fsp.writeFile(_filePath, JSON.stringify({ projects: _projects }, null, 2) + "\n", "utf8");
}

/** @returns {ProjectDef[]} */
export function listProjects() {
  return _projects;
}

/** @param {string} id @returns {ProjectDef | undefined} */
export function getProject(id) {
  return _projects.find((p) => p.id === id);
}

/**
 * 新增项目：创建目录和空 task.json，写入注册表。
 * @param {{ name: string; dir: string; description?: string; framework?: string; icon?: string }} opts
 * @returns {Promise<ProjectDef>}
 */
export async function addProject(opts) {
  const id = opts.dir.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
  if (getProject(id)) throw new Error(`项目 ID "${id}" 已存在`);

  const projectDir = path.join(_repoRoot, opts.dir);
  await fsp.mkdir(projectDir, { recursive: true });

  const taskJsonPath = path.join(opts.dir, "task.json");
  const taskJsonAbs = path.join(_repoRoot, taskJsonPath);
  try {
    await fsp.access(taskJsonAbs);
  } catch {
    const seed = {
      project: opts.name,
      description: opts.description || "",
      tasks: [],
    };
    await fsp.writeFile(taskJsonAbs, JSON.stringify(seed, null, 2) + "\n", "utf8");
  }

  /** @type {ProjectDef} */
  const proj = {
    id,
    name: opts.name,
    description: opts.description || "",
    dir: opts.dir,
    framework: opts.framework || "",
    icon: opts.icon || "📦",
    taskJsonPath,
    createdAt: formatBeijingDateTime(),
  };
  _projects.push(proj);
  await _saveRegistry();
  return proj;
}

/**
 * 删除项目：从注册表移除并删除项目目录。
 * @param {string} id
 * @param {{ deleteFiles?: boolean }} [opts]
 */
export async function removeProject(id, opts = {}) {
  const proj = getProject(id);
  if (!proj) throw new Error(`项目 "${id}" 不存在`);

  if (opts.deleteFiles !== false) {
    const projectDir = path.join(_repoRoot, proj.dir);
    await fsp.rm(projectDir, { recursive: true, force: true });
  }

  _projects = _projects.filter((p) => p.id !== id);
  await _saveRegistry();
}

/**
 * 获取项目的任务摘要。
 * @param {string} repoRoot
 * @param {ProjectDef} project
 */
export function getProjectTaskSummary(repoRoot, project) {
  if (!project.taskJsonPath) return { total: 0, done: 0, pending: 0, configured: false };
  try {
    const raw = fs.readFileSync(path.join(repoRoot, project.taskJsonPath), "utf8");
    const data = JSON.parse(raw);
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    const done = tasks.filter((t) => t.passes === true).length;
    return { total: tasks.length, done, pending: tasks.length - done, configured: true };
  } catch {
    return { total: 0, done: 0, pending: 0, configured: false };
  }
}
