/**
 * `unlockAfter` 依赖图校验与章节解锁判定（纯函数）。
 *
 * **进度与持久化**：「无脑无尽首通解锁下一技巧线」等规则由上层进度模块在通关后把对应
 * `ChapterId` 写入 `completedChapters`，再调用 {@link isChapterUnlocked} 即可；
 * 本模块不读写网络、本地存储或 JSON 存档。
 */

import type { ChapterId, CurriculumNode } from "./types";

export type UnlockGraphValidationError =
  | { kind: "duplicate_chapter_id"; chapterId: ChapterId }
  | { kind: "missing_prerequisite"; chapterId: ChapterId; missingId: ChapterId }
  | { kind: "self_loop"; chapterId: ChapterId };

/** 有向图中存在环；`cycle` 为沿依赖边遍历得到的一条有向环上的章节 id（首尾可相同语义上由调用方理解）。 */
export type UnlockGraphCycleError = {
  kind: "cycle";
  cycle: ChapterId[];
};

export type UnlockGraphValidationResult =
  | { ok: true }
  | {
      ok: false;
      errors: Array<
        UnlockGraphValidationError | UnlockGraphCycleError
      >;
    };

function normalizeCompleted(
  completedChapters: ReadonlySet<ChapterId> | ChapterId[],
): ReadonlySet<ChapterId> {
  return completedChapters instanceof Set
    ? completedChapters
    : new Set(completedChapters);
}

/**
 * 当且仅当 `node.unlockAfter` 中每一章均出现在 `completedChapters` 中时返回 `true`。
 * 根节点（`unlockAfter` 为空或未定义）恒为 `true`。
 */
export function isChapterUnlocked(
  node: CurriculumNode,
  completedChapters: ReadonlySet<ChapterId> | ChapterId[],
): boolean {
  const after = node.unlockAfter;
  if (after === undefined || after.length === 0) {
    return true;
  }
  const done = normalizeCompleted(completedChapters);
  for (const id of after) {
    if (!done.has(id)) {
      return false;
    }
  }
  return true;
}

/** 构建：前提章节 p → 依赖它的章节 n（`n.unlockAfter` 含 p 则 `p → n`）。 */
function buildAdjacency(
  nodes: readonly CurriculumNode[],
  idSet: ReadonlySet<string>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const id of idSet) {
    adj.set(id, []);
  }
  for (const node of nodes) {
    for (const p of node.unlockAfter ?? []) {
      if (!idSet.has(p)) {
        continue;
      }
      adj.get(p)!.push(node.id);
    }
  }
  return adj;
}

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

/**
 * 若存在有向环，返回环上节点序列（DFS 发现回边时构造）。
 */
function findDirectedCycle(
  ids: ReadonlySet<string>,
  adj: Map<string, string[]>,
): ChapterId[] | null {
  const color = new Map<string, number>();
  for (const id of ids) {
    color.set(id, WHITE);
  }
  const path: string[] = [];

  function dfs(u: string): string[] | null {
    color.set(u, GRAY);
    path.push(u);
    for (const v of adj.get(u) ?? []) {
      const c = color.get(v) ?? WHITE;
      if (c === GRAY) {
        const i = path.indexOf(v);
        return i >= 0 ? path.slice(i) : [v, u];
      }
      if (c === WHITE) {
        const cycle = dfs(v);
        if (cycle) {
          return cycle;
        }
      }
    }
    path.pop();
    color.set(u, BLACK);
    return null;
  }

  for (const id of ids) {
    if (color.get(id) === WHITE) {
      const c = dfs(id);
      if (c) {
        return c;
      }
    }
  }
  return null;
}

/**
 * 校验 `nodes` 中 `unlockAfter` 构成的依赖图：
 * - 所有节点 `id` 在列表内唯一；
 * - `unlockAfter` 中每个引用均出现在同一批节点的 `id` 中；
 * - 无自环（章节不能出现在自己的 `unlockAfter` 中）；
 * - 无环（DAG）。
 *
 * 不抛异常；失败时返回 `{ ok: false, errors }`。
 */
export function validateUnlockGraph(
  nodes: CurriculumNode[],
): UnlockGraphValidationResult {
  const errors: Array<UnlockGraphValidationError | UnlockGraphCycleError> = [];

  const seenIds = new Map<ChapterId, number>();
  for (let i = 0; i < nodes.length; i++) {
    const id = nodes[i]!.id;
    if (seenIds.has(id)) {
      errors.push({ kind: "duplicate_chapter_id", chapterId: id });
    } else {
      seenIds.set(id, i);
    }
  }

  const idSet = new Set<string>(nodes.map((n) => n.id));

  for (const node of nodes) {
    const after = node.unlockAfter;
    if (after === undefined) {
      continue;
    }
    for (const ref of after) {
      if (ref === node.id) {
        errors.push({ kind: "self_loop", chapterId: node.id });
        continue;
      }
      if (!idSet.has(ref)) {
        errors.push({
          kind: "missing_prerequisite",
          chapterId: node.id,
          missingId: ref,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const adj = buildAdjacency(nodes, idSet);
  const cycle = findDirectedCycle(idSet, adj);
  if (cycle !== null && cycle.length > 0) {
    return { ok: false, errors: [{ kind: "cycle", cycle }] };
  }

  return { ok: true };
}
