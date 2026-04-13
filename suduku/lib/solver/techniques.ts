import type { TechniqueId } from "./types";

/**
 * 命名技巧 id 常量（避免魔法字符串）。值均为 kebab-case，可与教学内容键对齐。
 * 含低/中/高阶占位，后续任务在此表上扩展实现。
 */
export const TECHNIQUE_IDS = {
  /** 裸单 / Naked Single */
  NAKED_SINGLE: "naked-single",
  /** 隐单 / Hidden Single */
  HIDDEN_SINGLE: "hidden-single",
  /** 裸数对 */
  NAKED_PAIR: "naked-pair",
  /** 隐数对 */
  HIDDEN_PAIR: "hidden-pair",
  /** 宫区块 → 行/列排除（Pointing） */
  POINTING: "pointing",
  /** 行/列 → 宫排除（Claiming / Box-Line） */
  CLAIMING: "claiming",
  X_WING: "x-wing",
  SWORDFISH: "swordfish",
  /** 占位：后续高阶技巧可继续追加 */
  XY_WING: "xy-wing",
  SKYSCRAPER: "skyscraper",
} as const satisfies Record<string, TechniqueId>;

export type KnownTechniqueId =
  (typeof TECHNIQUE_IDS)[keyof typeof TECHNIQUE_IDS];

/**
 * 当同一组候选消除可被多类技法解释时，保留列表中**较前**的技法 id（与 {@link findTechniques} 合并逻辑一致）。
 */
export const TECHNIQUE_RESOLUTION_ORDER: readonly TechniqueId[] = [
  TECHNIQUE_IDS.NAKED_SINGLE,
  TECHNIQUE_IDS.HIDDEN_SINGLE,
  TECHNIQUE_IDS.NAKED_PAIR,
  TECHNIQUE_IDS.HIDDEN_PAIR,
  TECHNIQUE_IDS.POINTING,
  TECHNIQUE_IDS.CLAIMING,
  TECHNIQUE_IDS.X_WING,
  TECHNIQUE_IDS.SWORDFISH,
  TECHNIQUE_IDS.SKYSCRAPER,
  TECHNIQUE_IDS.XY_WING,
];
