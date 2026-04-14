export type ChapterId = string;

export type CurriculumTier = "low" | "mid" | "high";

export type CurriculumNode = {
  id: ChapterId;
  techniqueIds: string[];
  tier: CurriculumTier;
  unlockAfter?: ChapterId[];
};
