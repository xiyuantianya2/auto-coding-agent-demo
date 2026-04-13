import type { CellState, GameArchiveSlice, GameMode, GameState } from "./types";

function cloneCellState(cell: CellState): CellState {
  const out: CellState = {};
  if (cell.given !== undefined) out.given = cell.given;
  if (cell.value !== undefined) out.value = cell.value;
  if (cell.notes !== undefined) {
    out.notes = new Set(cell.notes);
  }
  return out;
}

function cloneCells(cells: CellState[][]): CellState[][] {
  return cells.map((row) => row.map(cloneCellState));
}

function cloneMode(mode: GameMode): GameMode {
  switch (mode.kind) {
    case "classic":
      return { kind: "classic" };
    case "endless":
      return { kind: "endless", tier: mode.tier, levelIndex: mode.levelIndex };
    case "tutorial":
      return { kind: "tutorial", chapterId: mode.chapterId, stepIndex: mode.stepIndex };
    case "practice":
      return { kind: "practice", techniqueId: mode.techniqueId };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

function cloneArchive(archive: GameArchiveSlice): GameArchiveSlice {
  const endlessProgress: GameArchiveSlice["endlessProgress"] = {};
  for (const [k, v] of Object.entries(archive.endlessProgress)) {
    endlessProgress[k] = {
      currentLevel: v.currentLevel,
      bestTimesMs: { ...v.bestTimesMs },
    };
  }
  const practiceProgress: GameArchiveSlice["practiceProgress"] = {};
  for (const [k, v] of Object.entries(archive.practiceProgress)) {
    practiceProgress[k] = {
      unlocked: v.unlocked,
      streak: v.streak,
      bestTimeMs: v.bestTimeMs,
    };
  }
  return {
    endlessProgress,
    practiceProgress,
    tutorialProgress: { ...archive.tutorialProgress },
  };
}

/**
 * Deep-clones {@link GameState}: new row arrays, new {@link CellState} objects, and a fresh
 * {@link Set} for each cell’s `notes`. `mode` and `archive` are copied so nested objects are
 * not shared with the original.
 */
export function cloneGameState(state: GameState): GameState {
  const out: GameState = {
    formatVersion: state.formatVersion,
    cells: cloneCells(state.cells),
    mode: cloneMode(state.mode),
    archive: cloneArchive(state.archive),
  };
  if (state.puzzleSeed !== undefined) out.puzzleSeed = state.puzzleSeed;
  if (state.startedAtMs !== undefined) out.startedAtMs = state.startedAtMs;
  if (state.elapsedMs !== undefined) out.elapsedMs = state.elapsedMs;
  return out;
}
