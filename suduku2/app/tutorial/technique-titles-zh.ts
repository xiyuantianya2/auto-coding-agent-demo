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

export function techniqueTitleZh(titleKey: string): string {
  return TECHNIQUE_TITLE_ZH[titleKey] ?? titleKey;
}
