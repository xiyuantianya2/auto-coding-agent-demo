/**
 * 教学大纲章节数据与 {@link getCurriculumTree}。
 *
 * **只读语义**：{@link getCurriculumTree} 返回**同一深冻结实例**（根数组与各节点、
 * `techniqueIds` / `unlockAfter` 数组均 `Object.freeze`），调用方不得修改；
 * 若需派生结构请先拷贝。
 */

import { TECHNIQUE_IDS } from "@/lib/solver";

import type { CurriculumNode } from "./types";
import { validateCurriculumTechniqueIds } from "./technique-validation";
import { validateUnlockGraph } from "./unlock-graph";

/**
 * 与 {@link TECHNIQUE_RESOLUTION_ORDER} 一致的教学递进：每章一至多个技巧，全书覆盖引擎已知技巧。
 * `unlockAfter` 为线性前置链，便于后续解锁图校验（任务 4）。
 */
const CURRICULUM_NODES_RAW: CurriculumNode[] = [
  {
    id: "low-01-singles-naked",
    tier: "low",
    techniqueIds: [TECHNIQUE_IDS.NAKED_SINGLE],
  },
  {
    id: "low-02-singles-hidden",
    tier: "low",
    techniqueIds: [TECHNIQUE_IDS.HIDDEN_SINGLE],
    unlockAfter: ["low-01-singles-naked"],
  },
  {
    id: "mid-01-pairs-naked",
    tier: "mid",
    techniqueIds: [TECHNIQUE_IDS.NAKED_PAIR],
    unlockAfter: ["low-02-singles-hidden"],
  },
  {
    id: "mid-02-pairs-hidden",
    tier: "mid",
    techniqueIds: [TECHNIQUE_IDS.HIDDEN_PAIR],
    unlockAfter: ["mid-01-pairs-naked"],
  },
  {
    id: "mid-03-blocks-pointing",
    tier: "mid",
    techniqueIds: [TECHNIQUE_IDS.POINTING],
    unlockAfter: ["mid-02-pairs-hidden"],
  },
  {
    id: "mid-04-blocks-claiming",
    tier: "mid",
    techniqueIds: [TECHNIQUE_IDS.CLAIMING],
    unlockAfter: ["mid-03-blocks-pointing"],
  },
  {
    id: "high-01-fish-x-wing",
    tier: "high",
    techniqueIds: [TECHNIQUE_IDS.X_WING],
    unlockAfter: ["mid-04-blocks-claiming"],
  },
  {
    id: "high-02-fish-swordfish",
    tier: "high",
    techniqueIds: [TECHNIQUE_IDS.SWORDFISH],
    unlockAfter: ["high-01-fish-x-wing"],
  },
  {
    id: "high-03-pattern-skyscraper",
    tier: "high",
    techniqueIds: [TECHNIQUE_IDS.SKYSCRAPER],
    unlockAfter: ["high-02-fish-swordfish"],
  },
  {
    id: "high-04-pattern-xy-wing",
    tier: "high",
    techniqueIds: [TECHNIQUE_IDS.XY_WING],
    unlockAfter: ["high-03-pattern-skyscraper"],
  },
];

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.keys(value as object)) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== null && typeof v === "object") {
      deepFreeze(v);
    }
  }
  return value;
}

const validation = validateCurriculumTechniqueIds(CURRICULUM_NODES_RAW);
if (!validation.ok) {
  throw new Error(
    `curriculum: technique id validation failed: ${JSON.stringify(validation.errors)}`,
  );
}

const unlockValidation = validateUnlockGraph(CURRICULUM_NODES_RAW);
if (!unlockValidation.ok) {
  throw new Error(
    `curriculum: unlock graph validation failed: ${JSON.stringify(unlockValidation.errors)}`,
  );
}

const CURRICULUM_TREE_FROZEN = deepFreeze(
  CURRICULUM_NODES_RAW,
) as readonly CurriculumNode[];

/**
 * 返回引擎登记技巧的教学大纲树（深冻结只读视图，见文件头注释）。
 */
export function getCurriculumTree(): CurriculumNode[] {
  return CURRICULUM_TREE_FROZEN as CurriculumNode[];
}
