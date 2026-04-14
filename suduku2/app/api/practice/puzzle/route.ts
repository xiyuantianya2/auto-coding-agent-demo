import { getTechniqueCatalog } from "@/content/curriculum";
import { generatePuzzle } from "@/lib/generator";
import type { DifficultyTier } from "@/lib/generator";
import { TechniqueIds } from "@/lib/solver";
import { createRngFromSeedKey } from "@/server/endless-pool";
import {
  BadRequestError,
  jsonError,
  jsonOk,
  requireBearerToken,
  serverErrorToResponse,
} from "@/server/http";
import type { PuzzleSpec } from "@/server/types";

const GENERATE_TIMEOUT_MS = 5000;

function tierForTechnique(techniqueId: string): DifficultyTier {
  switch (techniqueId) {
    case TechniqueIds.UniqueCandidate:
    case TechniqueIds.HiddenSingle:
      return "entry";
    case TechniqueIds.Pointing:
    case TechniqueIds.BoxLineReduction:
      return "normal";
    case TechniqueIds.NakedPair:
    case TechniqueIds.HiddenPair:
    case TechniqueIds.NakedTriple:
    case TechniqueIds.HiddenTriple:
      return "hard";
    case TechniqueIds.XWing:
      return "expert";
    default:
      return "expert";
  }
}

/**
 * 专项练习单题：服务端调用生成器出题（不走浏览器内扩池），返回与无尽题库同形的 {@link PuzzleSpec}。
 */
export async function GET(req: Request) {
  try {
    requireBearerToken(req);
    const url = new URL(req.url);
    const modeId = url.searchParams.get("modeId");
    if (!modeId || modeId.trim() === "") {
      throw new BadRequestError("缺少查询参数 modeId");
    }

    const catalog = getTechniqueCatalog();
    const mod = catalog.find((m) => m.practiceEndlessModeId === modeId);
    if (!mod) {
      return jsonError(404, "UNKNOWN_MODE", "未知的专项模式 id");
    }

    const tier = tierForTechnique(mod.id);
    const seedKey = `suduku2|practice|${modeId}|${Date.now().toString(36)}|${Math.floor(Math.random() * 1e9)}`;
    const rng = createRngFromSeedKey(seedKey);
    const spec = generatePuzzle({ tier, rng, timeoutMs: GENERATE_TIMEOUT_MS });
    if (!spec) {
      return jsonError(
        503,
        "GENERATE_FAILED",
        "服务器暂时无法生成符合条件的练习题，请稍后重试。",
      );
    }

    const wire: PuzzleSpec = {
      seed: spec.seed,
      givens: spec.givens,
      difficultyScore: spec.difficultyScore,
    };
    return jsonOk({ spec: wire });
  } catch (e) {
    return serverErrorToResponse(e);
  }
}
