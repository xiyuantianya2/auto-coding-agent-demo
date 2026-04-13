/**
 * 稳定化管线（任务 6）：三消与「两格对碰合并」共用同一套「检测 → 结算 → 重力 → 补位」流程。
 *
 * ## 两格对碰合并（pair merge）
 *
 * - 仅针对**横向或竖向极大连续段长度恰好为 2** 的同色非空格对（即「一对」相邻同色，且该方向上不存在第三个同色相连）。
 * - 与三消不重叠：凡已落入「≥3 连线」检测的格子，只走三消消除，不参与对碰合并。
 * - 若同一局面同时存在横向与竖向可合并对（典型为 2×2 同色块），优先处理**横向对**，再在剩余格子上处理**竖向对**，并在每一方向内按「上行优先、同行则左列优先」贪心选取互不重叠的对。
 * - 合并结果：锚点取该对上「行小优先，列小优先」的一格；另一格置空。锚点符号变为 `min(symbol + 1, …)` 的下一阶；若两者已为最高阶（Amethyst），则两格均视为消除（皆置空）。
 *
 * ## 重力与补位
 *
 * - 重力：每列非空块下落至底部，中间不留空（row 0 为顶部，row 增大为向下）。
 * - 补位：空位自每列**自上而下**依次用符号池中的随机符号填充；随机序由调用方提供的 `random()` 决定，便于传入 `mulberry32(seed)` 复现。
 */

import {
  CellSymbol,
  DEFAULT_CELL_SYMBOLS,
  EMPTY_CELL,
  type Board,
  type CellValue,
  isEmptyCell,
} from "./board-types";
import { BASE_SCORE_PER_CELL, findAllMatchPositions } from "./match-clear";
import { mulberry32 } from "./seeded-random";

export const MERGE_PAIR_SCORE = 2 * BASE_SCORE_PER_CELL;

function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

function parseKey(key: string): readonly [number, number] {
  const [rs, cs] = key.split(",").map(Number) as [number, number];
  return [rs, cs];
}

function cloneBoardMutable(board: Board): number[][] {
  return board.map((row) => [...row]);
}

function freezeBoard(grid: number[][]): Board {
  return grid.map((row) => Object.freeze([...row])) as Board;
}

/** 两格同色合并后的锚点符号；最高阶合并视为双消（返回 EMPTY） */
export function mergedSymbolAfterPair(symbol: CellSymbol): CellValue {
  if (symbol >= CellSymbol.Amethyst) {
    return EMPTY_CELL;
  }
  return (symbol + 1) as CellSymbol;
}

interface PairMergeEdge {
  readonly aRow: number;
  readonly aCol: number;
  readonly bRow: number;
  readonly bCol: number;
  readonly kind: "H" | "V";
}

/** 横向连续段：返回 [左端列, 长度] */
function horizontalRun(board: Board, row: number, col: number): readonly [number, number] {
  const cols = board[0]?.length ?? 0;
  const v = board[row]![col]!;
  if (isEmptyCell(v)) {
    return [col, 0];
  }
  let c = col;
  while (c > 0 && board[row]![c - 1] === v) {
    c -= 1;
  }
  let len = 0;
  while (c + len < cols && board[row]![c + len] === v) {
    len += 1;
  }
  return [c, len];
}

/** 竖向连续段：返回 [顶端行, 长度] */
function verticalRun(board: Board, row: number, col: number): readonly [number, number] {
  const rows = board.length;
  const v = board[row]![col]!;
  if (isEmptyCell(v)) {
    return [row, 0];
  }
  let r = row;
  while (r > 0 && board[r - 1]![col] === v) {
    r -= 1;
  }
  let len = 0;
  while (r + len < rows && board[r + len]![col] === v) {
    len += 1;
  }
  return [r, len];
}

function collectHorizontalPairEdges(board: Board, blocked: ReadonlySet<string>): PairMergeEdge[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const out: PairMergeEdge[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const v = board[r]![c]!;
      if (isEmptyCell(v)) {
        continue;
      }
      const [start, len] = horizontalRun(board, r, c);
      if (start !== c) {
        continue;
      }
      if (len !== 2) {
        continue;
      }
      const k0 = posKey(r, c);
      const k1 = posKey(r, c + 1);
      if (blocked.has(k0) || blocked.has(k1)) {
        continue;
      }
      out.push({ aRow: r, aCol: c, bRow: r, bCol: c + 1, kind: "H" });
    }
  }
  return out;
}

function collectVerticalPairEdges(board: Board, blocked: ReadonlySet<string>): PairMergeEdge[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const out: PairMergeEdge[] = [];
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) {
      const v = board[r]![c]!;
      if (isEmptyCell(v)) {
        continue;
      }
      const [start, len] = verticalRun(board, r, c);
      if (start !== r) {
        continue;
      }
      if (len !== 2) {
        continue;
      }
      const k0 = posKey(r, c);
      const k1 = posKey(r + 1, c);
      if (blocked.has(k0) || blocked.has(k1)) {
        continue;
      }
      out.push({ aRow: r, aCol: c, bRow: r + 1, bCol: c, kind: "V" });
    }
  }
  return out;
}

function sortEdgesPrimary(edges: PairMergeEdge[]): PairMergeEdge[] {
  return [...edges].sort((x, y) => {
    const ar = x.aRow - y.aRow;
    if (ar !== 0) {
      return ar;
    }
    return x.aCol - y.aCol;
  });
}

/**
 * 在已排除三消格子的前提下，选取互不重叠的对碰边（横优先于竖，同向按锚点排序贪心）。
 */
export function findNonOverlappingPairMergeEdges(
  board: Board,
  triplePositions: ReadonlySet<string>,
): readonly PairMergeEdge[] {
  const h = sortEdgesPrimary(collectHorizontalPairEdges(board, triplePositions));
  const used = new Set<string>();
  const picked: PairMergeEdge[] = [];

  for (const e of h) {
    const k0 = posKey(e.aRow, e.aCol);
    const k1 = posKey(e.bRow, e.bCol);
    if (used.has(k0) || used.has(k1)) {
      continue;
    }
    picked.push(e);
    used.add(k0);
    used.add(k1);
  }

  const v = sortEdgesPrimary(collectVerticalPairEdges(board, triplePositions));
  for (const e of v) {
    const k0 = posKey(e.aRow, e.aCol);
    const k1 = posKey(e.bRow, e.bCol);
    if (used.has(k0) || used.has(k1)) {
      continue;
    }
    picked.push(e);
    used.add(k0);
    used.add(k1);
  }

  return picked;
}

/**
 * 三消置空 + 对碰合并（同一检测轮次），并计算本步得分。
 */
export function applyTripleClearAndPairMerge(board: Board): {
  readonly board: Board;
  readonly score: number;
  readonly tripleClearedCells: number;
  readonly pairMergeCount: number;
} {
  const tripleKeys = findAllMatchPositions(board);
  const pairEdges = findNonOverlappingPairMergeEdges(board, tripleKeys);

  if (tripleKeys.size === 0 && pairEdges.length === 0) {
    return {
      board,
      score: 0,
      tripleClearedCells: 0,
      pairMergeCount: 0,
    };
  }

  const next = cloneBoardMutable(board);

  for (const key of tripleKeys) {
    const [r, c] = parseKey(key);
    next[r]![c] = EMPTY_CELL;
  }

  for (const e of pairEdges) {
    const ka = posKey(e.aRow, e.aCol);
    const kb = posKey(e.bRow, e.bCol);
    if (tripleKeys.has(ka) || tripleKeys.has(kb)) {
      continue;
    }
    const sym = board[e.aRow]![e.aCol]!;
    if (!Number.isInteger(sym) || sym < 0) {
      continue;
    }
    const anchorR = Math.min(e.aRow, e.bRow);
    const anchorC = Math.min(e.aCol, e.bCol);
    const otherR = e.aRow + e.bRow - anchorR;
    const otherC = e.aCol + e.bCol - anchorC;
    const merged = mergedSymbolAfterPair(sym as CellSymbol);
    next[anchorR]![anchorC] = merged;
    next[otherR]![otherC] = EMPTY_CELL;
  }

  const frozen = freezeBoard(next);
  const tripleClearedCells = tripleKeys.size;
  const pairMergeCount = pairEdges.length;
  const score =
    tripleClearedCells * BASE_SCORE_PER_CELL + pairMergeCount * MERGE_PAIR_SCORE;

  return {
    board: frozen,
    score,
    tripleClearedCells,
    pairMergeCount,
  };
}

export interface GravityRefillOptions {
  /** 参与补位的符号池，默认五种基础符号 */
  readonly symbols?: readonly CellSymbol[];
  /** 返回 [0,1) 的随机数，例如 mulberry32(seed) */
  readonly random: () => number;
}

/**
 * 列重力下落并在顶部空位补符号（单次扫描即可完成「填满」）。
 */
export function applyGravityAndRefill(board: Board, options: GravityRefillOptions): Board {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const pool = options.symbols ?? DEFAULT_CELL_SYMBOLS;
  const rnd = options.random;
  const next = cloneBoardMutable(board);

  for (let c = 0; c < cols; c += 1) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r -= 1) {
      const v = next[r]![c]!;
      if (!isEmptyCell(v)) {
        next[write]![c] = v;
        write -= 1;
      }
    }
    for (let r = write; r >= 0; r -= 1) {
      const pick = Math.floor(rnd() * pool.length);
      next[r]![c] = pool[pick]!;
    }
  }

  return freezeBoard(next);
}

export function boardHasEmpty(board: Board): boolean {
  for (const row of board) {
    for (const v of row) {
      if (isEmptyCell(v)) {
        return true;
      }
    }
  }
  return false;
}

export interface StabilizeAfterSwapOptions {
  /** 补位随机种子；与 `mulberry32(seed)` 配合可复现 */
  readonly refillSeed: number;
  readonly symbols?: readonly CellSymbol[];
}

/**
 * 交换接受后的单轮稳定化：三消 + 对碰 → 重力 + 补位直至无空位。
 * 连锁再匹配由任务 7 扩展；此处补位后**不**再次扫描三消。
 */
export function stabilizeAfterSwap(board: Board, options: StabilizeAfterSwapOptions): {
  readonly board: Board;
  readonly score: number;
  readonly tripleClearedCells: number;
  readonly pairMergeCount: number;
} {
  const cleared = applyTripleClearAndPairMerge(board);
  if (!boardHasEmpty(cleared.board)) {
    return {
      board: cleared.board,
      score: cleared.score,
      tripleClearedCells: cleared.tripleClearedCells,
      pairMergeCount: cleared.pairMergeCount,
    };
  }
  const random = mulberry32(options.refillSeed);
  const filled = applyGravityAndRefill(cleared.board, {
    random,
    symbols: options.symbols,
  });
  return {
    board: filled,
    score: cleared.score,
    tripleClearedCells: cleared.tripleClearedCells,
    pairMergeCount: cleared.pairMergeCount,
  };
}
