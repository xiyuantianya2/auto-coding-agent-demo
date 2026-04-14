/**
 * `TechniqueModule.titleKey` → 简体中文标题（避免在界面直接露出英文 key）。
 */
export const TECHNIQUE_TITLE_ZH: Record<string, string> = {
  "technique.uniqueCandidate.title": "唯一候选（裸单）",
  "technique.hiddenSingle.title": "隐唯一",
  "technique.pointing.title": "宫内指向",
  "technique.boxLineReduction.title": "行列摒除",
  "technique.nakedPair.title": "显性数对",
  "technique.hiddenPair.title": "隐性数对",
  "technique.nakedTriple.title": "显性三数组",
  "technique.hiddenTriple.title": "隐性三数组",
  "technique.xWing.title": "X-Wing",
};

/**
 * TechniqueId（如 "unique-candidate"）→ 简体中文标题。
 * 供提示横幅等直接持有 TechniqueId 而非 titleKey 的场景使用。
 */
export const TECHNIQUE_ID_ZH: Record<string, string> = {
  "unique-candidate": "唯一候选（裸单）",
  "hidden-single": "隐唯一",
  "pointing": "宫内指向",
  "box-line-reduction": "行列摒除",
  "naked-pair": "显性数对",
  "hidden-pair": "隐性数对",
  "naked-triple": "显性三数组",
  "hidden-triple": "隐性三数组",
  "x-wing": "X-Wing",
};

export function techniqueTitleZh(titleKey: string): string {
  return TECHNIQUE_TITLE_ZH[titleKey] ?? titleKey;
}

export function techniqueIdToZh(techniqueId: string): string {
  return TECHNIQUE_ID_ZH[techniqueId] ?? techniqueId;
}
