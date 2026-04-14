/**
 * 与教学大纲/提示系统对齐的技巧标识符表（稳定字符串字面量）。
 * 具体检测逻辑由后续任务实现；此处仅提供命名契约，便于 `curriculum` 与 `HintResult` 交叉引用。
 */
export const TechniqueIds = {
  /** 唯一候选 / 裸单 */
  UniqueCandidate: "unique-candidate",
  /** 隐唯一（行/列/宫内） */
  HiddenSingle: "hidden-single",
  /** 显性数对（占位） */
  NakedPair: "naked-pair",
  /** 宫内指向：同宫内某候选被限制在同一行或列，删该行/列在宫外的该候选 */
  Pointing: "pointing",
  /** 行列摒除：同行/列上某候选仅落在一个宫内，删该宫内行/列外的该候选 */
  BoxLineReduction: "box-line-reduction",
  /** X-Wing（占位） */
  XWing: "x-wing",
} as const satisfies Record<string, string>;

/** 本仓库已登记的技巧 id（可随任务扩展）。 */
export type KnownTechniqueId = (typeof TechniqueIds)[keyof typeof TechniqueIds];

/**
 * 对外契约：`module-plan.json` 中 `TechniqueId` 为可扩展字符串。
 * 已知 id 使用 {@link KnownTechniqueId}；未知 id 仍允许（例如第三方题库自定义）。
 */
export type TechniqueId = KnownTechniqueId | (string & {});
