import type { TechniqueId } from "@/lib/solver";

export type HintResult = {
  /** 需要在棋盘上高亮的格子坐标（行/列，0–8）。 */
  cells: Array<{ r: number; c: number }>;
  /** 可选：在指定格子上额外高亮的候选数字（去重后的升序列表由后续映射保证）。 */
  highlightCandidates?: Array<{ r: number; c: number; digits: number[] }>;
  /** 本步提示所依据的技巧标识（与求解引擎一致）。 */
  technique: TechniqueId;
  /** 可选：供文案层查找说明的稳定 key。 */
  messageKey?: string;
};
