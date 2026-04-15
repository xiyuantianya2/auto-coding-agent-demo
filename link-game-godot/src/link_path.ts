/**
 * 连连看路径判定（与 `scripts/link_path_finder.gd` 算法一致）。
 *
 * 规则对齐 {@link ../requirements-archive.md}：8×12 网格、仅四连通、转弯 ≤2（≤3 段直线）、
 * 不可斜连；路径中间格须为空；棋盘外侧一圈视为空（padding），端点寻路时临时视为空。
 */

export const BOARD_COLS = 8;
export const BOARD_ROWS = 12;

export interface CellCoord {
  readonly row: number;
  readonly col: number;
}

export type PatternId = number;

/** `cells[r][c]`：`null` 表示已消除空位，否则为图案 id */
export interface BoardGrid {
  readonly rows: number;
  readonly cols: number;
  readonly cells: (PatternId | null)[][];
}

const DR = [-1, 0, 1, 0] as const;
const DC = [0, 1, 0, -1] as const;

export interface LinkPathResult {
  readonly ok: boolean;
  /** 简化后的折线路径顶点（含起点、终点），逻辑坐标；外侧通道为 row/col ∈ [-1, rows] / [-1, cols] */
  readonly polyline: CellCoord[];
  /** 仅折点（不含起点与终点），最多 2 个 */
  readonly bendPoints: CellCoord[];
}

type BfsState = readonly [number, number, number, number];

function stateKey(s: BfsState): string {
  return `${s[0]},${s[1]},${s[2]},${s[3]}`;
}

/** padded 坐标 → 逻辑坐标（与棋盘 cell 对齐，外侧为 -1 或 rows/cols） */
function padToLogical(pr: number, pc: number): CellCoord {
  return { row: pr - 1, col: pc - 1 };
}

/** 去掉共线中间点，只保留拐弯处与端点 */
function simplifyOrthogonal(points: CellCoord[]): CellCoord[] {
  if (points.length <= 2) {
    return points.slice();
  }
  const out: CellCoord[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const cur = points[i]!;
    const next = points[i + 1]!;
    const d1r = cur.row - prev.row;
    const d1c = cur.col - prev.col;
    const d2r = next.row - cur.row;
    const d2c = next.col - cur.col;
    if (d1r !== d2r || d1c !== d2c) {
      out.push(cur);
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * 判断两格是否可连，并给出一条合法路径的折点。
 * 若不可连，`ok` 为 false，`polyline`/`bendPoints` 为空数组。
 */
export function findLinkPath(a: CellCoord, b: CellCoord, board: BoardGrid): LinkPathResult {
  const empty: LinkPathResult = { ok: false, polyline: [], bendPoints: [] };

  if (a.row === b.row && a.col === b.col) {
    return empty;
  }
  if (
    a.row < 0 ||
    a.row >= board.rows ||
    a.col < 0 ||
    a.col >= board.cols ||
    b.row < 0 ||
    b.row >= board.rows ||
    b.col < 0 ||
    b.col >= board.cols
  ) {
    return empty;
  }

  const pa = board.cells[a.row]?.[a.col] ?? null;
  const pb = board.cells[b.row]?.[b.col] ?? null;
  if (pa === null || pb === null || pa !== pb) {
    return empty;
  }

  const rows = board.rows;
  const cols = board.cols;
  const pr = rows + 2;
  const pc = cols + 2;

  const pad: (PatternId | null)[][] = Array.from({ length: pr }, () => Array<PatternId | null>(pc).fill(null));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pad[r + 1]![c + 1] = board.cells[r]![c]!;
    }
  }
  pad[a.row + 1]![a.col + 1] = null;
  pad[b.row + 1]![b.col + 1] = null;

  const sr = a.row + 1;
  const sc = a.col + 1;
  const er = b.row + 1;
  const ec = b.col + 1;

  const queue: BfsState[] = [[sr, sc, -1, 0]];
  const seen = new Set<string>();
  const parent = new Map<string, BfsState | null>();

  const startKey = stateKey([sr, sc, -1, 0]);
  parent.set(startKey, null);

  let head = 0;
  let endState: BfsState | null = null;

  while (head < queue.length) {
    const cur = queue[head++]!;
    const [r, c, lastDir, bends] = cur;
    const ck = stateKey(cur);
    if (seen.has(ck)) {
      continue;
    }
    seen.add(ck);

    if (r === er && c === ec) {
      endState = cur;
      break;
    }

    for (let d = 0; d < 4; d++) {
      const nr = r + DR[d]!;
      const nc = c + DC[d]!;
      if (nr < 0 || nr >= pr || nc < 0 || nc >= pc) {
        continue;
      }
      if (pad[nr]![nc] !== null) {
        continue;
      }

      let nb = bends;
      if (lastDir !== -1 && d !== lastDir) {
        nb++;
      }
      if (nb > 2) {
        continue;
      }

      const next: BfsState = [nr, nc, d, nb];
      const nk = stateKey(next);
      if (!parent.has(nk)) {
        parent.set(nk, cur);
      }
      queue.push(next);
    }
  }

  if (!endState) {
    return empty;
  }

  const padCells: [number, number][] = [];
  let trace: BfsState | null = endState;
  while (trace !== null) {
    padCells.push([trace[0], trace[1]]);
    const k = stateKey(trace);
    trace = parent.get(k) ?? null;
  }
  padCells.reverse();

  const poly = padCells.map(([ppr, ppc]) => padToLogical(ppr, ppc));
  const simplified = simplifyOrthogonal(poly);
  const bendPoints = simplified.length <= 2 ? [] : simplified.slice(1, -1);

  return { ok: true, polyline: simplified, bendPoints };
}
