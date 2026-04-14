/**
 * **求解引擎**（`solver-engine`）公开入口。
 *
 * 下游应自本文件引用（例如 `import { … } from "@/lib/solver"`），避免深路径耦合。
 *
 * @module @/lib/solver
 */

export { computeCandidates } from "./candidates";
export { findLowTierApplicableSteps } from "./low-tier";
export {
  findMidTierApplicableSteps,
  findMidTierStepsFromCandidates,
} from "./mid-tier";
export {
  findHighTierApplicableSteps,
  findHighTierStepsFromCandidates,
  MAX_ELAPSED_MS_HI,
  MAX_HI_EMITTED_STEPS,
  MAX_HI_PATTERN_PROBES,
} from "./high-tier";
export type { HighTierOptions } from "./high-tier";
export type { TechniqueId, KnownTechniqueId } from "./technique-ids";
export { TechniqueIds } from "./technique-ids";
export type {
  CandidatesCell,
  CandidatesGrid,
  HighlightKind,
  SolveStep,
} from "./types";
