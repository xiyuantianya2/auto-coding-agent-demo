import type { Grid9 } from "../core";
import type { TechniqueId } from "../solver";

/** 与 `module-plan.json` 中 puzzle-generator 的 `PuzzleSpec` 一致。 */
export type PuzzleSpec = {
  seed: string;
  givens: Grid9;
  difficultyScore: number;
  requiredTechniques: TechniqueId[];
};
