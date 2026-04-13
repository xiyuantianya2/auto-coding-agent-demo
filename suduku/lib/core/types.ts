/**
 * 9×9 matrix of digits. Each entry is {@link EMPTY_CELL} or a digit 1–9.
 * This is the compact “numbers only” view (e.g. puzzle givens).
 */
export type Grid9 = number[][] & { length: 9 };

/**
 * One playable cell. **Semantics (do not mix incorrectly):**
 *
 * - **`given`** — Original puzzle clue (1–9). Immutable for the session when present.
 *   Cells with a given are not player-authored.
 * - **`value`** — Digit the **player** placed in an empty cell (1–9). Mutually exclusive
 *   with `given`: a clue cell uses `given` only; a blank cell may gain `value` and/or `notes`.
 * - **`notes`** — Pencil marks (candidates); only meaningful when the cell is not solved
 *   by a single digit (`given` or `value`).
 */
export type CellState = {
  /** Puzzle clue digit (1–9). If set, the cell is fixed for this game. */
  given?: number;
  /** Player-entered digit (1–9) for a non-clue cell. */
  value?: number;
  /** Pencil marks; typically empty when `given` or `value` is set. */
  notes?: Set<number>;
};

/** Difficulty tier for generated / endless puzzles (see `ProgressPayload` in server module). */
export type DifficultyTier = "easy" | "normal" | "hard" | "hell";

/**
 * High-level play mode. Used for routing, UI, and what gets persisted in {@link GameArchiveSlice}.
 */
export type GameMode =
  | { kind: "classic" }
  | { kind: "endless"; tier: DifficultyTier; levelIndex: number }
  | { kind: "tutorial"; chapterId: string; stepIndex: number }
  | { kind: "practice"; techniqueId: string };

/**
 * Subset of long-term progress that the core model carries for save/load and mode switching.
 * Mirrors the shape used by persistence APIs without importing server code.
 */
export type GameArchiveSlice = {
  /** Endless mode: keyed by difficulty tier string. */
  endlessProgress: Record<
    string,
    { currentLevel: number; bestTimesMs: Record<number, number> }
  >;
  /** Technique / practice drills. */
  practiceProgress: Record<
    string,
    { unlocked: boolean; streak: number; bestTimeMs?: number }
  >;
  /** Tutorial chapter completion flags. */
  tutorialProgress: Record<string, boolean>;
};

/**
 * Full in-memory game snapshot: board + mode + archival fields + optional timing metadata.
 */
export type GameState = {
  formatVersion: number;
  /** Row-major 9×9 playable cells (with notes as `Set`s). */
  cells: CellState[][];
  mode: GameMode;
  archive: GameArchiveSlice;
  /** Seed for the active generated puzzle (endless / practice), if any. */
  puzzleSeed?: string;
  /** Monotonic session clock anchors (optional until UI wires timer). */
  startedAtMs?: number;
  elapsedMs?: number;
};
