/**
 * 将用户在各流程中提交的原文追加到子项目目录下的 requirements-archive.md。
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { formatBeijingDateTime } from "./beijing-time.mjs";

export const REQUIREMENTS_ARCHIVE_BASENAME = "requirements-archive.md";

/**
 * @param {string} repoRoot
 * @param {string} projectDir 子项目相对仓库根的路径
 */
export function getRequirementsArchivePath(repoRoot, projectDir) {
  return path.join(repoRoot, projectDir, REQUIREMENTS_ARCHIVE_BASENAME);
}

/**
 * @param {string} s
 * @returns {string} 不与内容冲突的 fence
 */
function chooseFence(s) {
  const str = String(s);
  for (let n = 3; n <= 8; n++) {
    const fence = "`".repeat(n);
    if (!str.includes(fence)) return fence;
  }
  return "`".repeat(8);
}

/**
 * @param {string} content
 */
function fencedBlock(content) {
  const fence = chooseFence(content);
  return `${fence}text\n${content}\n${fence}`;
}

const FILE_HEADER = `# 需求留档（自动生成）

本文件由 **auto-coding-agent** 按时间**追加**条目，记录新建向导、新增/重构、模块化分解等场景中的**用户原文**。
请勿删除历史条目；如需补充说明可在文末手动追加。

`;

/**
 * @param {string} repoRoot
 * @param {string} projectDir
 * @param {{ kind: string; blocks: Array<{ title: string; body: string }> }} entry
 */
export async function appendRequirementsArchive(repoRoot, projectDir, entry) {
  if (!projectDir || typeof projectDir !== "string") {
    throw new Error("appendRequirementsArchive: projectDir required");
  }
  const abs = getRequirementsArchivePath(repoRoot, projectDir);
  await fsp.mkdir(path.dirname(abs), { recursive: true });

  let exists = true;
  try {
    await fsp.access(abs);
  } catch {
    exists = false;
  }

  const when = formatBeijingDateTime();
  const lines = [];
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`## ${when} · ${entry.kind}`);
  lines.push("");
  for (const b of entry.blocks) {
    lines.push(`### ${b.title}`);
    lines.push("");
    lines.push(fencedBlock(b.body));
    lines.push("");
  }

  const chunk = (exists ? "" : FILE_HEADER) + lines.join("\n");
  await fsp.appendFile(abs, chunk, "utf8");
}
