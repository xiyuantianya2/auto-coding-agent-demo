import {
  EMPTY_CELL,
  cloneGameState,
  getEffectiveDigitAt,
  isBoardFilled,
  isLegalFill,
  type GameState,
  type Grid9,
} from "@/lib/core";

import {
  MAX_FIND_APPLICABLE_EMITTED_STEPS,
  canonicalStepDedupKey,
  computeCandidates,
  findHighTierStepsFromCandidates,
  findLowTierStepsFromCandidates,
  findMidTierStepsFromCandidates,
  scoreDifficulty,
  type CandidatesGrid,
  type SolveStep,
  type TechniqueId,
} from "@/lib/solver";

import type { DifficultyTier } from "./difficulty-tier";
import { gameStateFromGivensGrid } from "./grid-game-state";
import {
  isTechniqueAllowedForTier,
  scoreFitsTierProfile,
} from "./tier-profiles";

/** 与 `find-applicable-steps` 单次调用对齐的默认墙上时钟预算（毫秒）。 */
export const DEFAULT_ANALYZE_BUDGET_MS = 5000;

/** 单次盘面分析默认最大推理步数（放置 + 删候选各计 1 步）。 */
export const DEFAULT_MAX_SOLVE_STEPS = 600;

type Elimination = { r: number; c: number; digit: number };

function appendUniqueInPriorityOrder(
  out: SolveStep[],
  batch: SolveStep[],
  seen: Set<string>,
  deadlineMs: number,
  maxOut: number,
): void {
  for (const step of batch) {
    if (Date.now() > deadlineMs || out.length >= maxOut) {
      return;
    }
    const k = canonicalStepDedupKey(step);
    if (seen.has(k)) {
      continue;
    }
    seen.add(k);
    out.push(step);
  }
}

/**
 * 与 {@link findApplicableSteps} 相同：先低阶、再中阶、再高阶，并按 {@link canonicalStepDedupKey} 去重。
 * 在**可变** {@link CandidatesGrid} 上工作，以便在应用删候选后继续扫描。
 */
export function gatherApplicableStepsFromCandidates(
  candidates: CandidatesGrid,
  deadlineMs: number,
): SolveStep[] {
  const out: SolveStep[] = [];
  const seen = new Set<string>();

  appendUniqueInPriorityOrder(
    out,
    findLowTierStepsFromCandidates(candidates),
    seen,
    deadlineMs,
    MAX_FIND_APPLICABLE_EMITTED_STEPS,
  );
  appendUniqueInPriorityOrder(
    out,
    findMidTierStepsFromCandidates(candidates, { deadlineMs }),
    seen,
    deadlineMs,
    MAX_FIND_APPLICABLE_EMITTED_STEPS,
  );
  appendUniqueInPriorityOrder(
    out,
    findHighTierStepsFromCandidates(candidates, { deadlineMs }),
    seen,
    deadlineMs,
    MAX_FIND_APPLICABLE_EMITTED_STEPS,
  );

  return out;
}

function deepCloneCandidates(src: CandidatesGrid): CandidatesGrid {
  return src.map((row) =>
    row.map((cell) => {
      if (cell === null) {
        return null;
      }
      return new Set(cell);
    }),
  );
}

function parseEliminations(raw: unknown): Elimination[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const out: Elimination[] = [];
  for (const e of raw) {
    if (
      e &&
      typeof e === "object" &&
      "r" in e &&
      "c" in e &&
      "digit" in e &&
      typeof (e as Elimination).r === "number" &&
      typeof (e as Elimination).c === "number" &&
      typeof (e as Elimination).digit === "number"
    ) {
      out.push(e as Elimination);
    }
  }
  return out;
}

/** 从一步技巧的高亮中提取填数结论（裸单 / 隐单）。 */
function extractPlacementFromStep(step: SolveStep): Elimination | null {
  for (const h of step.highlights) {
    if (h.kind !== "candidate") {
      continue;
    }
    const ref = h.ref;
    if (
      ref &&
      typeof ref === "object" &&
      "r" in ref &&
      "c" in ref &&
      "digit" in ref
    ) {
      const x = ref as { r: number; c: number; digit: number };
      if (
        typeof x.r === "number" &&
        typeof x.c === "number" &&
        typeof x.digit === "number"
      ) {
        return { r: x.r, c: x.c, digit: x.digit };
      }
    }
  }
  return null;
}

function hasCandidateContradiction(
  state: GameState,
  cand: CandidatesGrid,
): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (getEffectiveDigitAt(state, r, c) !== EMPTY_CELL) {
        continue;
      }
      const set = cand[r][c];
      if (set !== null && set.size === 0) {
        return true;
      }
    }
  }
  return false;
}

function applyEliminationsToCandidates(
  cand: CandidatesGrid,
  eliminations: Elimination[],
): void {
  for (const e of eliminations) {
    const cell = cand[e.r]?.[e.c];
    if (cell && cell instanceof Set) {
      cell.delete(e.digit);
    }
  }
}

/**
 * 应用一步技巧到「盘面 + 可变候选」：
 * - 有 **eliminations** 时视为删候选（不直接改 `GameState.grid`；候选盘需与当前规则一致维护）。
 * - 否则视为裸单/隐单填数：更新 `GameState` 后**从盘面重算**候选（与 `computeCandidates` 一致）。
 */
export function applyOneStep(
  state: GameState,
  cand: CandidatesGrid,
  step: SolveStep,
): boolean {
  const elim = parseEliminations(step.eliminations);
  if (elim.length > 0) {
    applyEliminationsToCandidates(cand, elim);
    return true;
  }

  const place = extractPlacementFromStep(step);
  if (!place) {
    return false;
  }
  const { r, c, digit } = place;
  if (!isLegalFill(state, r, c, digit)) {
    return false;
  }
  state.grid[r][c] = digit;
  state.cells[r][c] = { value: digit };

  const next = computeCandidates(state);
  for (let rr = 0; rr < 9; rr++) {
    for (let cc = 0; cc < 9; cc++) {
      cand[rr][cc] = next[rr][cc];
    }
  }
  return true;
}

export type HumanSolveTraceResult = {
  /** 是否填满且无规则冲突（由 `isBoardFilled` 判定）。 */
  solved: boolean;
  /** 失败原因：无可行步、矛盾、超时或步数上限。 */
  failReason?:
    | "no_step"
    | "no_allowed_step"
    | "contradiction"
    | "timeout"
    | "step_limit";
  /** 按执行顺序记录的技巧步（用于 `scoreDifficulty` 与 `requiredTechniques`）。 */
  trajectory: SolveStep[];
  /** 与 solver 对齐的难度总分与可选区间。 */
  difficultyScore: number;
  scoreBand?: [number, number];
  /** 轨迹上首次出现的技巧 id 列表（保序去重）。 */
  requiredTechniquesOrdered: string[];
};

function orderedUniqueTechniques(steps: SolveStep[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of steps) {
    if (!seen.has(s.technique)) {
      seen.add(s.technique);
      out.push(s.technique);
    }
  }
  return out;
}

export type RunHumanSolveTraceOptions = {
  rng: () => number;
  /**
   * 若指定，则每步仅在允许集合内选步；`undefined` 表示不限制技巧（用于生成元数据）。
   */
  tier?: DifficultyTier;
  /** 墙上时钟预算（毫秒），明显超过 5 秒的路径应在外层截断；默认 {@link DEFAULT_ANALYZE_BUDGET_MS}。 */
  maxWallClockMs?: number;
  /** 最大推理步数，默认 {@link DEFAULT_MAX_SOLVE_STEPS}。 */
  maxSteps?: number;
};

/**
 * 从提示盘面出发，迭代：在可变候选上聚合可应用步骤 →（可选）按 tier 过滤 →
 * **并列时**用 `rng` 在「当前批次内下标」上随机选一步（与「固定优先级」策略等价地先合并低→中→高，
 * 再在允许子集内均匀抽样；见函数内注释）。
 *
 * 删候选类步不修改 `GameState` 数字格，仅收缩候选集合；填数步后从盘面重算候选。
 */
export function runHumanSolveTrace(
  givens: Grid9,
  options: RunHumanSolveTraceOptions,
): HumanSolveTraceResult {
  const rng = options.rng;
  const maxWall = options.maxWallClockMs ?? DEFAULT_ANALYZE_BUDGET_MS;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_SOLVE_STEPS;
  const tier = options.tier;

  const started = Date.now();
  const deadline = started + maxWall;

  const state = cloneGameState(gameStateFromGivensGrid(givens));
  const initialForScore = cloneGameState(state);

  const cand = deepCloneCandidates(computeCandidates(state));
  const trajectory: SolveStep[] = [];

  const fail = (
    reason: NonNullable<HumanSolveTraceResult["failReason"]>,
  ): HumanSolveTraceResult => {
    const { score, band } = scoreDifficulty(initialForScore, trajectory);
    return {
      solved: false,
      failReason: reason,
      trajectory,
      difficultyScore: score,
      scoreBand: band,
      requiredTechniquesOrdered: orderedUniqueTechniques(trajectory),
    };
  };

  for (let n = 0; n < maxSteps; n++) {
    if (Date.now() > deadline) {
      return fail("timeout");
    }

    if (isBoardFilled(state)) {
      const { score, band } = scoreDifficulty(initialForScore, trajectory);
      return {
        solved: true,
        trajectory,
        difficultyScore: score,
        scoreBand: band,
        requiredTechniquesOrdered: orderedUniqueTechniques(trajectory),
      };
    }

    if (hasCandidateContradiction(state, cand)) {
      return fail("contradiction");
    }

    const steps = gatherApplicableStepsFromCandidates(cand, deadline);
    const allowed =
      tier === undefined
        ? steps
        : steps.filter((s) => isTechniqueAllowedForTier(s.technique, tier));

    if (steps.length === 0) {
      return fail("no_step");
    }
    if (allowed.length === 0) {
      return fail("no_allowed_step");
    }

    /**
     * 并列处理：`gatherApplicableStepsFromCandidates` 已按低→中→高阶与去重键稳定合并；
     * 在**过滤后的允许列表**内用 `rng` 均匀选下标，避免总选第一条导致可复现偏差过大。
     */
    const pick = allowed[Math.floor(rng() * allowed.length)]!;
    trajectory.push(pick);
    const applied = applyOneStep(state, cand, pick);
    if (!applied) {
      return fail("contradiction");
    }

    if (hasCandidateContradiction(state, cand)) {
      return fail("contradiction");
    }
  }

  return fail("step_limit");
}

/** 推导 {@link PuzzleSpec} 所需的难度分、分数区间与（保序去重）技巧列表；不施加 tier 过滤。 */
export function derivePuzzleDifficultyMetadata(
  givens: Grid9,
  rng: () => number,
  opts?: { maxWallClockMs?: number; maxSteps?: number },
): Pick<
  HumanSolveTraceResult,
  | "solved"
  | "failReason"
  | "difficultyScore"
  | "scoreBand"
  | "requiredTechniquesOrdered"
  | "trajectory"
> {
  const r = runHumanSolveTrace(givens, {
    rng,
    maxWallClockMs: opts?.maxWallClockMs,
    maxSteps: opts?.maxSteps,
  });
  return {
    solved: r.solved,
    failReason: r.failReason,
    difficultyScore: r.difficultyScore,
    scoreBand: r.scoreBand,
    requiredTechniquesOrdered: r.requiredTechniquesOrdered,
    trajectory: r.trajectory,
  };
}

/**
 * 填充 {@link PuzzleSpec} 中与 solver 对齐的难度字段（`requiredTechniques` 为保序去重 id 列表）。
 */
export function derivePuzzleSpecDifficultyFields(
  givens: Grid9,
  rng: () => number,
  opts?: { maxWallClockMs?: number; maxSteps?: number },
): {
  difficultyScore: number;
  scoreBand?: [number, number];
  requiredTechniques: TechniqueId[];
} {
  const d = derivePuzzleDifficultyMetadata(givens, rng, opts);
  return {
    difficultyScore: d.difficultyScore,
    scoreBand: d.scoreBand,
    requiredTechniques: d.requiredTechniquesOrdered as TechniqueId[],
  };
}

/**
 * 在指定 tier 下跑一次人类式求解轨迹，并产出 {@link PuzzleSpec} 所需的难度字段。
 * 与 {@link puzzleMatchesTierProfile} 判定一致：未解完、或总分不在该档目标区间内时返回 `null`。
 */
export function derivePuzzleSpecFieldsForTier(
  givens: Grid9,
  tier: DifficultyTier,
  rng: () => number,
  opts?: { maxWallClockMs?: number; maxSteps?: number },
): {
  difficultyScore: number;
  scoreBand?: [number, number];
  requiredTechniques: TechniqueId[];
} | null {
  const trace = runHumanSolveTrace(givens, {
    rng,
    tier,
    maxWallClockMs: opts?.maxWallClockMs,
    maxSteps: opts?.maxSteps,
  });
  if (!trace.solved) {
    return null;
  }
  if (!scoreFitsTierProfile(trace.difficultyScore, tier)) {
    return null;
  }
  return {
    difficultyScore: trace.difficultyScore,
    scoreBand: trace.scoreBand,
    requiredTechniques: trace.requiredTechniquesOrdered as TechniqueId[],
  };
}

/**
 * 在指定 tier 下尝试人类式求解：用于出题时校验「仅用允许技巧能否解完」。
 * 成功时还检查轨迹总分是否落在该档 {@link getTierProfile} 的 `targetScoreRange` 内。
 */
export function puzzleMatchesTierProfile(
  givens: Grid9,
  tier: DifficultyTier,
  rng: () => number,
  opts?: { maxWallClockMs?: number; maxSteps?: number },
): boolean {
  return derivePuzzleSpecFieldsForTier(givens, tier, rng, opts) !== null;
}

/**
 * 返回该盘面能落入的**最低**难度档（从 entry 向 expert 尝试）：
 * 需同时满足「该档允许技巧下可解」且「总分落在该档目标区间」。
 */
export function classifyPuzzleMinimumTier(
  givens: Grid9,
  rng: () => number,
  opts?: { maxWallClockMs?: number; maxSteps?: number },
): DifficultyTier | null {
  const order: DifficultyTier[] = ["entry", "normal", "hard", "expert"];
  for (const tier of order) {
    if (puzzleMatchesTierProfile(givens, tier, rng, opts)) {
      return tier;
    }
  }
  return null;
}
