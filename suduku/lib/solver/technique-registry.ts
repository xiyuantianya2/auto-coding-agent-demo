import type { Grid9 } from "../core";
import { claimingFromCandidates, pointingFromCandidates } from "./technique-intersections";
import { swordfishFromCandidates, xWingFromCandidates } from "./technique-fish";
import { hiddenPairsFromCandidates, nakedPairsFromCandidates } from "./technique-pairs";
import { skyscraperFromCandidates } from "./technique-skyscraper";
import { xyWingFromCandidates } from "./technique-xy-wing";
import { TECHNIQUE_IDS } from "./techniques";
import type { CandidatesGrid, SolveStep } from "./types";

/**
 * 带消除的中高阶技法探测器：顺序与 {@link TECHNIQUE_RESOLUTION_ORDER} 及
 * `findTechniques` 中 `mergeEliminationSteps` 合并优先级一致（较前项优先保留）。
 */
export type EliminationTechniqueDetector = (
  grid: Grid9,
  cand: CandidatesGrid,
  eliminationCand?: CandidatesGrid,
) => SolveStep[];

export const ELIMINATION_TECHNIQUE_PIPELINE: readonly {
  readonly id: (typeof TECHNIQUE_IDS)[keyof typeof TECHNIQUE_IDS];
  readonly detect: EliminationTechniqueDetector;
}[] = [
  { id: TECHNIQUE_IDS.NAKED_PAIR, detect: nakedPairsFromCandidates },
  { id: TECHNIQUE_IDS.HIDDEN_PAIR, detect: hiddenPairsFromCandidates },
  { id: TECHNIQUE_IDS.POINTING, detect: pointingFromCandidates },
  { id: TECHNIQUE_IDS.CLAIMING, detect: claimingFromCandidates },
  { id: TECHNIQUE_IDS.X_WING, detect: xWingFromCandidates },
  { id: TECHNIQUE_IDS.SWORDFISH, detect: swordfishFromCandidates },
  { id: TECHNIQUE_IDS.SKYSCRAPER, detect: skyscraperFromCandidates },
  { id: TECHNIQUE_IDS.XY_WING, detect: xyWingFromCandidates },
];
