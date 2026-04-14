/**
 * 将 {@link SolveStep} 中的 `highlights` 转为 {@link HintResult} 所需的几何字段（`cells` / `highlightCandidates`）。
 *
 * **单位（`kind: 'unit'`）展开约定（与棋盘高亮组件对齐）：**
 * `HighlightUnitRef`（行 / 列 / 宫）展开为**该单位内全部 9 个格子坐标**（含已填数格），
 * 不依赖盘面状态；若将来需要「仅空格」语义，需在调用侧传入 `GameState` 并另建 API。
 *
 * **候选（`kind: 'candidate'`）：** 多条 `ref` 按 `(r,c)` 聚合为 `digits`，去重后升序。
 *
 * **格子（`kind: 'cell'`）：** 直接并入 `cells`。
 *
 * 全程不调用 `findTechniques`，仅做结构转换；坐标用 `Set` 去重，输出按行优先排序以保证稳定。
 */

import type { SolveStep } from "@/lib/solver";

/** 与 `HintResult` 的 `cells` / `highlightCandidates` 字段形状一致（供 UI 高亮使用）。 */
export type HintHighlightFields = {
  cells: Array<{ r: number; c: number }>;
  highlightCandidates?: Array<{ r: number; c: number; digits: number[] }>;
};

const cellKey = (r: number, c: number) => `${r},${c}`;

/** 宫号 0…8，行优先遍历 9 个 3×3 宫（与 `lib/core` `boxIndexFromCell` 一致）。 */
function cellsInBox(boxIndex: number): Array<{ r: number; c: number }> {
  const br = Math.floor(boxIndex / 3) * 3;
  const bc = (boxIndex % 3) * 3;
  const out: Array<{ r: number; c: number }> = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out.push({ r: br + i, c: bc + j });
    }
  }
  return out;
}

/** 将 `unit` 高亮展开为 9 个坐标（见模块注释：始终为全格）。 */
function expandUnit(ref: {
  unit: "row" | "col" | "box";
  index: number;
}): Array<{ r: number; c: number }> {
  if (ref.unit === "row") {
    return Array.from({ length: 9 }, (_, c) => ({ r: ref.index, c }));
  }
  if (ref.unit === "col") {
    return Array.from({ length: 9 }, (_, r) => ({ r, c: ref.index }));
  }
  return cellsInBox(ref.index);
}

function sortCells(cells: Array<{ r: number; c: number }>): Array<{ r: number; c: number }> {
  return [...cells].sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c));
}

/**
 * 从单条求解步骤的高亮列表得到 `HintResult` 的 `cells` 与可选的 `highlightCandidates`。
 */
export function solveStepHighlightsToHintFields(step: SolveStep): HintHighlightFields {
  const cellSet = new Set<string>();
  const candMap = new Map<string, Set<number>>();

  for (const h of step.highlights) {
    if (h.kind === "cell") {
      cellSet.add(cellKey(h.ref.r, h.ref.c));
    } else if (h.kind === "unit") {
      for (const p of expandUnit(h.ref)) {
        cellSet.add(cellKey(p.r, p.c));
      }
    } else {
      const k = cellKey(h.ref.r, h.ref.c);
      let set = candMap.get(k);
      if (!set) {
        set = new Set<number>();
        candMap.set(k, set);
      }
      set.add(h.ref.digit);
    }
  }

  const cells = sortCells(
    [...cellSet].map((key) => {
      const [rs, cs] = key.split(",");
      return { r: Number(rs), c: Number(cs) };
    }),
  );

  if (candMap.size === 0) {
    return { cells };
  }

  const highlightCandidates = [...candMap.entries()]
    .map(([key, digits]) => {
      const [rs, cs] = key.split(",");
      return {
        r: Number(rs),
        c: Number(cs),
        digits: [...digits].sort((a, b) => a - b),
      };
    })
    .sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c));

  return { cells, highlightCandidates };
}
