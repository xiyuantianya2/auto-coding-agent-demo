import {
  BOX_HEIGHT,
  BOX_WIDTH,
  GRID_SIZE,
  isFilledDigit,
  isValidCellCoord,
} from "@/lib/core";
import type { HighlightKind, SolveStep } from "@/lib/solver";

/** 与 UI 展示对齐的格坐标（0–8）。 */
export type HighlightCellCoord = { r: number; c: number };

/** `kind: "candidate"` 高亮解析结果，供后续候选强调使用。 */
export type HighlightCandidateCoord = { r: number; c: number; digit: number };

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function parseCellRef(ref: unknown): HighlightCellCoord | null {
  if (ref === null || typeof ref !== "object") {
    return null;
  }
  const r = (ref as { r?: unknown }).r;
  const c = (ref as { c?: unknown }).c;
  if (typeof r !== "number" || typeof c !== "number") {
    return null;
  }
  if (!Number.isInteger(r) || !Number.isInteger(c)) {
    return null;
  }
  if (!isValidCellCoord(r, c)) {
    return null;
  }
  return { r, c };
}

function parseUnitRef(ref: unknown): { type: "row" | "col" | "box"; index: number } | null {
  if (ref === null || typeof ref !== "object") {
    return null;
  }
  const type = (ref as { type?: unknown }).type;
  const index = (ref as { index?: unknown }).index;
  if (type !== "row" && type !== "col" && type !== "box") {
    return null;
  }
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= GRID_SIZE) {
    return null;
  }
  return { type, index };
}

/**
 * 将 `unit` 引用展开为该 unit 内全部 9 个格（行优先遍历顺序）。
 * 仅在 `parseUnitRef` 已校验 `index` 的前提下调用。
 */
function expandUnitToCells(unit: { type: "row" | "col" | "box"; index: number }): HighlightCellCoord[] {
  const out: HighlightCellCoord[] = [];
  if (unit.type === "row") {
    const r = unit.index;
    for (let c = 0; c < GRID_SIZE; c++) {
      out.push({ r, c });
    }
  } else if (unit.type === "col") {
    const c = unit.index;
    for (let r = 0; r < GRID_SIZE; r++) {
      out.push({ r, c });
    }
  } else {
    const b = unit.index;
    const br = Math.floor(b / 3) * BOX_HEIGHT;
    const bc = (b % 3) * BOX_WIDTH;
    for (let dr = 0; dr < BOX_HEIGHT; dr++) {
      for (let dc = 0; dc < BOX_WIDTH; dc++) {
        out.push({ r: br + dr, c: bc + dc });
      }
    }
  }
  return out;
}

function parseCandidateRef(ref: unknown): HighlightCandidateCoord | null {
  const cell = parseCellRef(ref);
  if (!cell) {
    return null;
  }
  const digit = (ref as { digit?: unknown }).digit;
  if (typeof digit !== "number" || !Number.isInteger(digit) || !isFilledDigit(digit)) {
    return null;
  }
  return { r: cell.r, c: cell.c, digit };
}

/**
 * 将 {@link SolveStep} 的 `highlights` 归并为去重后的格列表（含 `cell`、`unit` 展开、`candidate` 的 `(r,c)`），
 * 按行优先 `(r,c)` 稳定排序。
 *
 * 未知或缺字段的 `ref` 会被跳过，不抛错。
 */
export function mapHighlightsToCells(
  highlights: SolveStep["highlights"] | ReadonlyArray<{ kind: HighlightKind; ref: unknown }>,
): HighlightCellCoord[] {
  const seen = new Set<string>();

  const addCell = (r: number, c: number): void => {
    if (!isValidCellCoord(r, c)) {
      return;
    }
    seen.add(cellKey(r, c));
  };

  for (const h of highlights) {
    try {
      if (h.kind === "cell") {
        const p = parseCellRef(h.ref);
        if (p) {
          addCell(p.r, p.c);
        }
      } else if (h.kind === "unit") {
        const u = parseUnitRef(h.ref);
        if (u) {
          for (const { r, c } of expandUnitToCells(u)) {
            addCell(r, c);
          }
        }
      } else if (h.kind === "candidate") {
        const cand = parseCandidateRef(h.ref);
        if (cand) {
          addCell(cand.r, cand.c);
        }
      }
    } catch {
      /* 显式容错：跳过该项 */
    }
  }

  return [...seen]
    .map((k) => {
      const [rs, cs] = k.split(",");
      return { r: Number(rs), c: Number(cs) } as HighlightCellCoord;
    })
    .sort((a, b) => a.r - b.r || a.c - b.c);
}

/**
 * 提取 `kind: "candidate"` 条目的 `{ r, c, digit }`（无效项跳过，不抛错）。
 */
export function extractHighlightCandidateRefs(
  highlights: SolveStep["highlights"] | ReadonlyArray<{ kind: HighlightKind; ref: unknown }>,
): HighlightCandidateCoord[] {
  const out: HighlightCandidateCoord[] = [];
  for (const h of highlights) {
    if (h.kind !== "candidate") {
      continue;
    }
    try {
      const p = parseCandidateRef(h.ref);
      if (p) {
        out.push(p);
      }
    } catch {
      /* 显式容错 */
    }
  }
  return out;
}

/**
 * 一次遍历得到合并格集与候选高亮引用（供后续 `highlightCandidates` 组装使用）。
 */
export function normalizeSolveStepHighlights(
  highlights: SolveStep["highlights"] | ReadonlyArray<{ kind: HighlightKind; ref: unknown }>,
): { cells: HighlightCellCoord[]; candidateHighlights: HighlightCandidateCoord[] } {
  return {
    cells: mapHighlightsToCells(highlights),
    candidateHighlights: extractHighlightCandidateRefs(highlights),
  };
}
