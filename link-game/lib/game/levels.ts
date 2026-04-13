import type { LevelConfig } from "./types";

/**
 * Built-in levels: grid grows and pattern variety increases (task 2 sample data).
 * Each level uses every pattern exactly twice; `rows * cols === 2 * tileKindCount`.
 */
export const DEFAULT_LEVELS: readonly LevelConfig[] = [
  {
    id: 1,
    name: "入门",
    rows: 4,
    cols: 4,
    tileKindCount: 8,
  },
  {
    id: 2,
    name: "进阶",
    rows: 5,
    cols: 6,
    tileKindCount: 15,
  },
  {
    id: 3,
    name: "挑战",
    rows: 6,
    cols: 8,
    tileKindCount: 24,
  },
];

export function getLevelById(id: number): LevelConfig | undefined {
  return DEFAULT_LEVELS.find((level) => level.id === id);
}
