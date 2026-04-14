import type { GameState } from "@/lib/core";

import { computeCandidates } from "./candidates";
import { findHighTierStepsFromCandidates } from "./high-tier";
import { findLowTierStepsFromCandidates } from "./low-tier";
import { findMidTierStepsFromCandidates } from "./mid-tier";
import { TechniqueIds } from "./technique-ids";
import type { SolveStep } from "./types";

/** 单次 `findApplicableSteps` 墙上时钟上限（毫秒）；与 `module-plan`「一般输入 5 秒内」对齐。 */
export const MAX_FIND_APPLICABLE_MS = 5000;

/** 单次调用最多返回的 `SolveStep` 条数（跨层去重后），防止输出组合爆炸。 */
export const MAX_FIND_APPLICABLE_EMITTED_STEPS = 500;

const REGISTERED_TECHNIQUE_IDS = new Set<string>(
  Object.values(TechniqueIds) as string[],
);

function normalizeEliminationsKey(eliminations: unknown): string {
  if (!Array.isArray(eliminations) || eliminations.length === 0) {
    return "";
  }
  const parts: string[] = [];
  for (const e of eliminations) {
    if (
      e &&
      typeof e === "object" &&
      "r" in e &&
      "c" in e &&
      "digit" in e &&
      typeof (e as { r: unknown }).r === "number" &&
      typeof (e as { c: unknown }).c === "number" &&
      typeof (e as { digit: unknown }).digit === "number"
    ) {
      const x = e as { r: number; c: number; digit: number };
      parts.push(`${x.r},${x.c},${x.digit}`);
    } else {
      parts.push(JSON.stringify(e));
    }
  }
  parts.sort();
  return parts.join("|");
}

function placementDedupKey(step: SolveStep): string {
  const units = step.highlights
    .filter((h) => h.kind === "unit")
    .map((h) => JSON.stringify(h.ref))
    .sort();
  const cells = step.highlights
    .filter((h) => h.kind === "cell")
    .map((h) => JSON.stringify(h.ref))
    .sort();
  const cands = step.highlights
    .filter((h) => h.kind === "candidate")
    .map((h) => JSON.stringify(h.ref))
    .sort();
  return `units:${units.join("|")}#cells:${cells.join("|")}#cands:${cands.join("|")}`;
}

/**
 * 跨层去重键：有 `eliminations` 时按「技巧 + 删减集合」归一；否则按「技巧 + 高亮结论」归一。
 * 先合并的批次优先保留（见 {@link findApplicableSteps} 的层级顺序）。
 */
export function canonicalStepDedupKey(step: SolveStep): string {
  const ek = normalizeEliminationsKey(step.eliminations);
  if (ek.length > 0) {
    return `${step.technique}#elim:${ek}`;
  }
  return `${step.technique}#${placementDedupKey(step)}`;
}

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

/** @internal */
export function isRegisteredTechniqueId(id: string): boolean {
  return REGISTERED_TECHNIQUE_IDS.has(id);
}

/**
 * 聚合各层技巧检测：先 {@link computeCandidates}，再按教学难度/实现复杂度递增顺序扫描，
 * 合并结果并去重；整体受 {@link MAX_FIND_APPLICABLE_MS} 与 {@link MAX_FIND_APPLICABLE_EMITTED_STEPS} 约束。
 *
 * ## 检测顺序（注释即约定；先出现的步骤在重复时优先保留）
 *
 * 1. **低阶**：裸单 → 隐单 → 宫内指向 → 行列摒除（`findLowTierStepsFromCandidates` 内部顺序）
 * 2. **中阶**：显性数对 → 隐性数对 → 显性三数组 → 隐性三数组（`findMidTierStepsFromCandidates`）
 * 3. **高阶**：X-Wing（`findHighTierStepsFromCandidates`）
 *
 * 不要求枚举全部可应用技巧或「最优下一步」；预算内返回可应用步骤子集或空数组。
 */
export function findApplicableSteps(state: GameState): SolveStep[] {
  const deadlineMs = Date.now() + MAX_FIND_APPLICABLE_MS;
  const candidates = computeCandidates(state);
  if (Date.now() > deadlineMs) {
    return [];
  }

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
