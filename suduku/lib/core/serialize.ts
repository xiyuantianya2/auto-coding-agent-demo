import { BOARD_SIZE, DIGIT_MAX, DIGIT_MIN, GAME_STATE_FORMAT_VERSION } from "./constants";
import type {
  CellState,
  DifficultyTier,
  GameArchiveSlice,
  GameMode,
  GameState,
} from "./types";

/** Thrown when {@link deserializeGameState} rejects input (invalid JSON, shape, or values). */
export class GameStateSerializationError extends Error {
  override readonly name = "GameStateSerializationError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

type SerializedCell = {
  given?: number;
  value?: number;
  /** Pencil marks, sorted ascending in persisted form. */
  notes?: number[];
};

type SerializedGameState = {
  formatVersion: number;
  cells: SerializedCell[][];
  mode: GameMode;
  archive: GameArchiveSlice;
  puzzleSeed?: string;
  startedAtMs?: number;
  elapsedMs?: number;
  inputMode?: "fill" | "notes";
};

function assertSupportedFormatVersion(v: unknown): asserts v is number {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new GameStateSerializationError(`formatVersion must be an integer, got ${String(v)}`);
  }
  if (v !== GAME_STATE_FORMAT_VERSION) {
    throw new GameStateSerializationError(
      `Unsupported formatVersion ${v} (supported: ${GAME_STATE_FORMAT_VERSION})`,
    );
  }
}

function assertDigitField(name: string, n: unknown): asserts n is number {
  if (typeof n !== "number" || !Number.isInteger(n) || n < DIGIT_MIN || n > DIGIT_MAX) {
    throw new GameStateSerializationError(`${name} must be an integer ${DIGIT_MIN}–${DIGIT_MAX}`);
  }
}

function serializeCell(cell: CellState): SerializedCell {
  const out: SerializedCell = {};
  if (cell.given !== undefined) out.given = cell.given;
  if (cell.value !== undefined) out.value = cell.value;
  const notes = cell.notes ?? new Set<number>();
  out.notes = [...notes].sort((a, b) => a - b);
  return out;
}

/**
 * JSON snapshot of {@link GameState}. Cell `notes` are stored as ascending `number[]` (not JSON `Set`).
 */
export function serializeGameState(state: GameState): string {
  const payload: SerializedGameState = {
    formatVersion: state.formatVersion,
    cells: state.cells.map((row) => row.map(serializeCell)),
    mode: state.mode,
    archive: state.archive,
  };
  if (state.puzzleSeed !== undefined) payload.puzzleSeed = state.puzzleSeed;
  if (state.startedAtMs !== undefined) payload.startedAtMs = state.startedAtMs;
  if (state.elapsedMs !== undefined) payload.elapsedMs = state.elapsedMs;
  if (state.inputMode !== undefined) payload.inputMode = state.inputMode;
  return JSON.stringify(payload);
}

function parseNotesArray(raw: unknown, ctx: string): number[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new GameStateSerializationError(`${ctx}: notes must be an array of integers`);
  }
  const seen = new Set<number>();
  for (const x of raw) {
    if (typeof x !== "number" || !Number.isInteger(x) || x < DIGIT_MIN || x > DIGIT_MAX) {
      throw new GameStateSerializationError(
        `${ctx}: each note must be an integer ${DIGIT_MIN}–${DIGIT_MAX}`,
      );
    }
    if (seen.has(x)) {
      throw new GameStateSerializationError(`${ctx}: duplicate note ${x}`);
    }
    seen.add(x);
  }
  return [...seen].sort((a, b) => a - b);
}

function deserializeCell(raw: unknown, r: number, c: number): CellState {
  const ctx = `cells[${r}][${c}]`;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new GameStateSerializationError(`${ctx} must be an object`);
  }
  const o = raw as Record<string, unknown>;
  const given = o.given;
  const value = o.value;
  const hasGiven = given !== undefined;
  const hasValue = value !== undefined;
  if (hasGiven) assertDigitField(`${ctx}.given`, given);
  if (hasValue) assertDigitField(`${ctx}.value`, value);
  if (hasGiven && hasValue) {
    throw new GameStateSerializationError(`${ctx}: cannot set both given and value`);
  }
  const notesArr = parseNotesArray(o.notes, ctx);
  const cell: CellState = {};
  if (hasGiven) cell.given = given as number;
  if (hasValue) cell.value = value as number;
  cell.notes = new Set(notesArr);
  return cell;
}

function isDifficultyTier(x: unknown): x is DifficultyTier {
  return x === "easy" || x === "normal" || x === "hard" || x === "hell";
}

function deserializeMode(raw: unknown): GameMode {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new GameStateSerializationError("mode must be an object");
  }
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind === "classic") {
    return { kind: "classic" };
  }
  if (kind === "endless") {
    const tier = o.tier;
    const levelIndex = o.levelIndex;
    if (!isDifficultyTier(tier)) {
      throw new GameStateSerializationError("mode.endless.tier must be a valid DifficultyTier");
    }
    if (typeof levelIndex !== "number" || !Number.isInteger(levelIndex) || levelIndex < 0) {
      throw new GameStateSerializationError("mode.endless.levelIndex must be a non-negative integer");
    }
    return { kind: "endless", tier, levelIndex };
  }
  if (kind === "tutorial") {
    const chapterId = o.chapterId;
    const stepIndex = o.stepIndex;
    if (typeof chapterId !== "string") {
      throw new GameStateSerializationError("mode.tutorial.chapterId must be a string");
    }
    if (typeof stepIndex !== "number" || !Number.isInteger(stepIndex) || stepIndex < 0) {
      throw new GameStateSerializationError("mode.tutorial.stepIndex must be a non-negative integer");
    }
    return { kind: "tutorial", chapterId, stepIndex };
  }
  if (kind === "practice") {
    const techniqueId = o.techniqueId;
    if (typeof techniqueId !== "string") {
      throw new GameStateSerializationError("mode.practice.techniqueId must be a string");
    }
    return { kind: "practice", techniqueId };
  }
  throw new GameStateSerializationError(`mode.kind is missing or unsupported: ${String(kind)}`);
}

function deserializeArchive(raw: unknown): GameArchiveSlice {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new GameStateSerializationError("archive must be an object");
  }
  const o = raw as Record<string, unknown>;
  const endlessProgress = o.endlessProgress;
  const practiceProgress = o.practiceProgress;
  const tutorialProgress = o.tutorialProgress;
  if (endlessProgress === null || typeof endlessProgress !== "object" || Array.isArray(endlessProgress)) {
    throw new GameStateSerializationError("archive.endlessProgress must be an object");
  }
  if (practiceProgress === null || typeof practiceProgress !== "object" || Array.isArray(practiceProgress)) {
    throw new GameStateSerializationError("archive.practiceProgress must be an object");
  }
  if (tutorialProgress === null || typeof tutorialProgress !== "object" || Array.isArray(tutorialProgress)) {
    throw new GameStateSerializationError("archive.tutorialProgress must be an object");
  }

  const endlessOut: GameArchiveSlice["endlessProgress"] = {};
  for (const [tierKey, tierVal] of Object.entries(endlessProgress)) {
    if (tierVal === null || typeof tierVal !== "object" || Array.isArray(tierVal)) {
      throw new GameStateSerializationError(`archive.endlessProgress[${tierKey}] must be an object`);
    }
    const tv = tierVal as Record<string, unknown>;
    const currentLevel = tv.currentLevel;
    const bestTimesMs = tv.bestTimesMs;
    if (typeof currentLevel !== "number" || !Number.isInteger(currentLevel) || currentLevel < 0) {
      throw new GameStateSerializationError(
        `archive.endlessProgress[${tierKey}].currentLevel must be a non-negative integer`,
      );
    }
    if (bestTimesMs === null || typeof bestTimesMs !== "object" || Array.isArray(bestTimesMs)) {
      throw new GameStateSerializationError(
        `archive.endlessProgress[${tierKey}].bestTimesMs must be an object`,
      );
    }
    const bestOut: Record<number, number> = {};
    for (const [lvl, ms] of Object.entries(bestTimesMs)) {
      const li = Number(lvl);
      if (!Number.isInteger(li) || li < 0) {
        throw new GameStateSerializationError(
          `archive.endlessProgress[${tierKey}].bestTimesMs keys must be non-negative integer indices`,
        );
      }
      if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
        throw new GameStateSerializationError(
          `archive.endlessProgress[${tierKey}].bestTimesMs[${lvl}] must be a non-negative finite number`,
        );
      }
      bestOut[li] = ms;
    }
    endlessOut[tierKey] = { currentLevel, bestTimesMs: bestOut };
  }

  const practiceOut: GameArchiveSlice["practiceProgress"] = {};
  for (const [pid, pv] of Object.entries(practiceProgress)) {
    if (pv === null || typeof pv !== "object" || Array.isArray(pv)) {
      throw new GameStateSerializationError(`archive.practiceProgress[${pid}] must be an object`);
    }
    const p = pv as Record<string, unknown>;
    const unlocked = p.unlocked;
    const streak = p.streak;
    const bestTimeMs = p.bestTimeMs;
    if (typeof unlocked !== "boolean") {
      throw new GameStateSerializationError(`archive.practiceProgress[${pid}].unlocked must be boolean`);
    }
    if (typeof streak !== "number" || !Number.isInteger(streak) || streak < 0) {
      throw new GameStateSerializationError(
        `archive.practiceProgress[${pid}].streak must be a non-negative integer`,
      );
    }
    if (bestTimeMs !== undefined) {
      if (typeof bestTimeMs !== "number" || !Number.isFinite(bestTimeMs) || bestTimeMs < 0) {
        throw new GameStateSerializationError(
          `archive.practiceProgress[${pid}].bestTimeMs must be a non-negative finite number`,
        );
      }
    }
    practiceOut[pid] =
      bestTimeMs !== undefined
        ? { unlocked, streak, bestTimeMs }
        : { unlocked, streak };
  }

  const tutorialOut: Record<string, boolean> = {};
  for (const [tid, done] of Object.entries(tutorialProgress)) {
    if (typeof done !== "boolean") {
      throw new GameStateSerializationError(`archive.tutorialProgress[${tid}] must be boolean`);
    }
    tutorialOut[tid] = done;
  }

  return {
    endlessProgress: endlessOut,
    practiceProgress: practiceOut,
    tutorialProgress: tutorialOut,
  };
}

/**
 * Parses JSON produced by {@link serializeGameState} and returns a fresh {@link GameState}.
 * On any validation failure throws {@link GameStateSerializationError}.
 */
export function deserializeGameState(json: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new GameStateSerializationError("Input is not valid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GameStateSerializationError("Root must be a JSON object");
  }
  const root = parsed as Record<string, unknown>;
  assertSupportedFormatVersion(root.formatVersion);

  const cellsRaw = root.cells;
  if (!Array.isArray(cellsRaw) || cellsRaw.length !== BOARD_SIZE) {
    throw new GameStateSerializationError(`cells must be a ${BOARD_SIZE}×${BOARD_SIZE} array`);
  }
  const cells: CellState[][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = cellsRaw[r];
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) {
      throw new GameStateSerializationError(`cells[${r}] must have length ${BOARD_SIZE}`);
    }
    const outRow: CellState[] = [];
    for (let c = 0; c < BOARD_SIZE; c++) {
      outRow.push(deserializeCell(row[c], r, c));
    }
    cells.push(outRow);
  }

  const mode = deserializeMode(root.mode);
  const archive = deserializeArchive(root.archive);

  const out: GameState = {
    formatVersion: root.formatVersion as number,
    cells,
    mode,
    archive,
  };

  if (root.puzzleSeed !== undefined) {
    if (typeof root.puzzleSeed !== "string") {
      throw new GameStateSerializationError("puzzleSeed must be a string when present");
    }
    out.puzzleSeed = root.puzzleSeed;
  }
  if (root.startedAtMs !== undefined) {
    if (typeof root.startedAtMs !== "number" || !Number.isFinite(root.startedAtMs)) {
      throw new GameStateSerializationError("startedAtMs must be a finite number when present");
    }
    out.startedAtMs = root.startedAtMs;
  }
  if (root.elapsedMs !== undefined) {
    if (typeof root.elapsedMs !== "number" || !Number.isFinite(root.elapsedMs)) {
      throw new GameStateSerializationError("elapsedMs must be a finite number when present");
    }
    out.elapsedMs = root.elapsedMs;
  }

  if (root.inputMode !== undefined) {
    const im = root.inputMode;
    if (im !== "fill" && im !== "notes") {
      throw new GameStateSerializationError("inputMode must be 'fill' or 'notes' when present");
    }
    out.inputMode = im;
  }

  return out;
}
