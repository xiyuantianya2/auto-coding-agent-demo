/**
 * {@link requestNextPuzzle}：内聚调用 `@/lib/generator` 的 {@link generatePuzzle}，不修改生成器内部算法。
 *
 * **随机源**：`sha256(userId ‖ tier ‖ nonce)`（`nonce` 为 `crypto.randomUUID()`），摘要字节混合为 Mulberry32
 * 初始状态（与 generator 导出的 {@link createMulberry32} 一致），再作为注入 `rng` 传入 `generatePuzzle`。
 * `generatePuzzle` 内部会先 {@link derivePuzzleSeedString} 得到可记录的 `PuzzleSpec.seed`，并凭该 seed 复现整局。
 */

import crypto from "node:crypto";

import {
  createMulberry32,
  generatePuzzle,
  type DifficultyTier,
  type PuzzleSpec,
} from "@/lib/generator";

function digestToMulberryState(digest: Buffer): number {
  let state = 0;
  for (let i = 0; i < 32; i += 4) {
    state ^= digest.readUInt32BE(i);
  }
  const u = state >>> 0;
  return u === 0 ? 0xdeadbeef : u;
}

/**
 * 由用户、难度档与一次性 `nonce`（通常为 UUID）构造与 `generatePuzzle` 兼容的 `rng`，供单测或与 {@link generatePuzzle} 对照。
 */
export function createEntropyRngForPuzzleRequest(
  userId: string,
  tier: DifficultyTier,
  nonce: string,
): () => number {
  const payload = `${userId}\0${tier}\0${nonce}`;
  const digest = crypto.createHash("sha256").update(payload, "utf8").digest();
  return createMulberry32(digestToMulberryState(digest));
}

/**
 * 请求下一题：每次调用使用新的 `randomUUID()`，保证题面分布独立；返回的 `seed` 可写入客户端或日志以复现。
 *
 * @param userId 已认证用户 id（`UserId` 字符串）。
 */
export async function requestNextPuzzle(
  userId: string,
  tier: DifficultyTier,
): Promise<PuzzleSpec> {
  const rng = createEntropyRngForPuzzleRequest(userId, tier, crypto.randomUUID());
  return generatePuzzle({ tier, rng });
}
