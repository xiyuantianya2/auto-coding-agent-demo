import { GRID_SIZE, isFilledDigit, isGridDigit } from "./constants";
import { getEffectiveCellDigit } from "./placement";
import type { CellState, FillNotesMode, GameState, Grid9 } from "./types";

/** 当前存档 JSON 的 `schemaVersion`，演进时递增并保持向后兼容策略在反序列化中显式分支。 */
export const SERIALIZATION_SCHEMA_VERSION = 1;

/** 反序列化失败时抛出，便于调用方与测试识别。 */
export class DeserializeGameStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeserializeGameStateError";
  }
}

/** 拒绝明显过大的输入，避免恶意超大字符串占用过多内存与时间。 */
const MAX_DESERIALIZE_JSON_CHARS = 512 * 1024;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new DeserializeGameStateError(message);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateGrid9Shape(grid: unknown): asserts grid is number[][] {
  assert(Array.isArray(grid), "deserializeGameState: grid must be an array");
  assert(
    grid.length === GRID_SIZE,
    `deserializeGameState: grid must have ${GRID_SIZE} rows`,
  );
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = grid[r];
    assert(
      Array.isArray(row),
      `deserializeGameState: grid row ${r} must be an array`,
    );
    assert(
      row.length === GRID_SIZE,
      `deserializeGameState: grid row ${r} must have ${GRID_SIZE} columns`,
    );
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = row[c];
      assert(
        typeof v === "number" && Number.isInteger(v),
        `deserializeGameState: grid[${r}][${c}] must be an integer`,
      );
      assert(
        isGridDigit(v),
        `deserializeGameState: grid[${r}][${c}] out of range (expected 0–9)`,
      );
    }
  }
}

function parseNotes(
  raw: unknown,
  r: number,
  c: number,
): Set<number> | undefined {
  if (raw === undefined) {
    return undefined;
  }
  assert(
    Array.isArray(raw),
    `deserializeGameState: cells[${r}][${c}].notes must be an array when present`,
  );
  const set = new Set<number>();
  for (let i = 0; i < raw.length; i++) {
    const n = raw[i];
    assert(
      typeof n === "number" && Number.isInteger(n),
      `deserializeGameState: cells[${r}][${c}].notes[${i}] must be an integer`,
    );
    assert(
      isFilledDigit(n),
      `deserializeGameState: cells[${r}][${c}].notes[${i}] out of range (expected 1–9)`,
    );
    set.add(n);
  }
  return set.size > 0 ? set : undefined;
}

function parseCells(wire: unknown): CellState[][] {
  assert(Array.isArray(wire), "deserializeGameState: cells must be an array");
  assert(
    wire.length === GRID_SIZE,
    `deserializeGameState: cells must have ${GRID_SIZE} rows`,
  );
  const cells: CellState[][] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = wire[r];
    assert(
      Array.isArray(row),
      `deserializeGameState: cells row ${r} must be an array`,
    );
    assert(
      row.length === GRID_SIZE,
      `deserializeGameState: cells row ${r} must have ${GRID_SIZE} columns`,
    );
    const outRow: CellState[] = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = row[c];
      assert(
        isPlainObject(cell),
        `deserializeGameState: cells[${r}][${c}] must be a plain object`,
      );
      const keys = Object.keys(cell);
      for (const k of keys) {
        assert(
          k === "given" || k === "value" || k === "notes",
          `deserializeGameState: cells[${r}][${c}] has unknown key "${k}"`,
        );
      }
      if (cell.given !== undefined) {
        assert(
          typeof cell.given === "number" && Number.isInteger(cell.given),
          `deserializeGameState: cells[${r}][${c}].given must be an integer when present`,
        );
        assert(
          isFilledDigit(cell.given),
          `deserializeGameState: cells[${r}][${c}].given out of range (expected 1–9)`,
        );
      }
      if (cell.value !== undefined) {
        assert(
          typeof cell.value === "number" && Number.isInteger(cell.value),
          `deserializeGameState: cells[${r}][${c}].value must be an integer when present`,
        );
        assert(
          isFilledDigit(cell.value),
          `deserializeGameState: cells[${r}][${c}].value out of range (expected 1–9)`,
        );
      }
      const notes = parseNotes(cell.notes, r, c);
      const cs: CellState = {};
      if (cell.given !== undefined) cs.given = cell.given;
      if (cell.value !== undefined) cs.value = cell.value;
      if (notes !== undefined) cs.notes = notes;
      outRow.push(cs);
    }
    cells.push(outRow);
  }
  return cells;
}

function assertGridMatchesCells(grid: Grid9, cells: CellState[][]): void {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const expected = getEffectiveCellDigit(cells[r][c]);
      assert(
        grid[r][c] === expected,
        `deserializeGameState: grid[${r}][${c}] (${grid[r][c]}) does not match cells effective digit (${expected})`,
      );
    }
  }
}

/**
 * 将 {@link GameState} 序列化为 JSON 字符串：`CellState.notes` 以升序数字数组存储；
 * 包含 `schemaVersion` 供后续格式演进。
 */
export function serializeGameState(state: GameState): string {
  const cellsWire = state.cells.map((row) =>
    row.map((cell) => {
      const o: {
        given?: number;
        value?: number;
        notes?: number[];
      } = {};
      if (cell.given !== undefined) o.given = cell.given;
      if (cell.value !== undefined) o.value = cell.value;
      if (cell.notes !== undefined && cell.notes.size > 0) {
        o.notes = [...cell.notes].sort((a, b) => a - b);
      }
      return o;
    }),
  );

  const payload = {
    schemaVersion: SERIALIZATION_SCHEMA_VERSION,
    mode: state.mode,
    grid: state.grid.map((row) => [...row]),
    cells: cellsWire,
  };

  return JSON.stringify(payload);
}

/**
 * 从 JSON 字符串恢复 {@link GameState}。非法或版本不兼容的输入抛出 {@link DeserializeGameStateError}。
 */
export function deserializeGameState(json: string): GameState {
  assert(typeof json === "string", "deserializeGameState: input must be a string");
  assert(
    json.length <= MAX_DESERIALIZE_JSON_CHARS,
    `deserializeGameState: input exceeds maximum length (${MAX_DESERIALIZE_JSON_CHARS} characters)`,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new DeserializeGameStateError("deserializeGameState: invalid JSON");
  }

  assert(isPlainObject(parsed), "deserializeGameState: root must be a JSON object");

  const { schemaVersion, mode, grid, cells } = parsed;

  assert(
    typeof schemaVersion === "number" && Number.isInteger(schemaVersion),
    "deserializeGameState: schemaVersion must be an integer",
  );
  assert(
    schemaVersion === SERIALIZATION_SCHEMA_VERSION,
    `deserializeGameState: unsupported schemaVersion ${schemaVersion} (expected ${SERIALIZATION_SCHEMA_VERSION})`,
  );

  assert(
    mode === "fill" || mode === "notes",
    "deserializeGameState: mode must be 'fill' or 'notes'",
  );

  validateGrid9Shape(grid);
  const cellStates = parseCells(cells);

  assertGridMatchesCells(grid, cellStates);

  const result: GameState = {
    grid: grid.map((row) => row.slice()),
    cells: cellStates,
    mode: mode as FillNotesMode,
  };

  return result;
}
