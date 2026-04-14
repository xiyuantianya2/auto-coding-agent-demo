import type { DifficultyTier } from "@/server/types";

export const ENDLESS_TIER_ORDER: DifficultyTier[] = ["entry", "normal", "hard", "expert"];

export const ENDLESS_TIER_LABEL_ZH: Record<DifficultyTier, string> = {
  entry: "入门",
  normal: "普通",
  hard: "困难",
  expert: "专家",
};
