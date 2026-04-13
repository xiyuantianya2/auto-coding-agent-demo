import type { LevelConfig } from "./types";

const LEVELS: LevelConfig[] = [
  {
    id: "L1",
    name: "入门 6×6",
    cols: 6,
    rows: 6,
    pairKinds: 9,
  },
  {
    id: "L2",
    name: "进阶 8×8",
    cols: 8,
    rows: 8,
    pairKinds: 16,
  },
  {
    id: "L3",
    name: "挑战 10×8",
    cols: 10,
    rows: 8,
    pairKinds: 20,
  },
];

export function getDefaultLevels(): LevelConfig[] {
  return [...LEVELS];
}

export function getLevelById(id: string): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id);
}
