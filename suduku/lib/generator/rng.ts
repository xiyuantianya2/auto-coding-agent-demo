/**
 * 可复现伪随机（PRNG）与 `PuzzleSpec.seed` 的编码约定。
 *
 * **Seed 格式（canonical）**：恰好 **32 个小写十六进制字符**（128 bit），正则
 * `/^[0-9a-f]{32}$/`。该字符串可安全用于 URL query（无需额外转义），且与实现无关、不依赖 Node。
 *
 * **与 `rng: () => number` 的关系**：
 * - `createRngFromSeed(seed)` 将上述字符串**唯一地**映射为 `[0, 1)` 上的确定性随机流（Mulberry32）。
 * - `derivePuzzleSeedString(rng)` 从**调用方注入**的 `rng` 连续抽取 128 bit，写成 canonical seed；之后生成管线应使用 `createRngFromSeed(该字符串)` 作为**唯一**随机源，以保证「只凭 `PuzzleSpec.seed` 即可复现整局生成」。注入的 `rng` 在抽出 seed 后是否继续参与由上层约定；本模块在 `generatePuzzle` 中仅消费若干次以确定 seed。
 */

/** Canonical puzzle seed：32 个小写十六进制数字（128 bit）。 */
export const PUZZLE_SEED_HEX_DIGITS = 32;

const SEED_HEX_RE = /^[0-9a-f]{32}$/;

export function isValidPuzzleSeedString(seed: string): boolean {
  return SEED_HEX_RE.test(seed);
}

/**
 * 将 Mulberry32 状态混合为单个 `uint32`（用于初始化 PRNG）。
 * 输入为从 32 位十六进制串解析出的 4×32bit。
 */
function mixFourWordsToUint32(a: number, b: number, c: number, d: number): number {
  let h = a >>> 0;
  h = Math.imul(h ^ b, 0x9e3779b1);
  h = (h ^ ((c >>> 0) + 0x243f6a88)) >>> 0;
  h = Math.imul(h ^ d, 0x85ebca6b);
  h = (h ^ (h >>> 16)) >>> 0;
  return h === 0 ? 0xdeadbeef : h;
}

function parseHex32ToFourWords(seed: string): [number, number, number, number] {
  const a = Number.parseInt(seed.slice(0, 8), 16) >>> 0;
  const b = Number.parseInt(seed.slice(8, 16), 16) >>> 0;
  const c = Number.parseInt(seed.slice(16, 24), 16) >>> 0;
  const d = Number.parseInt(seed.slice(24, 32), 16) >>> 0;
  return [a, b, c, d];
}

/**
 * Mulberry32：单 `uint32` 状态，输出 `[0, 1)`，与常见 JS 实现一致、跨引擎可复现。
 * @see https://github.com/bryc/code/blob/master/jshash/PRNGs.md#mulberry32
 */
export function createMulberry32(state: number): () => number {
  let a = state >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 由 canonical seed 字符串构造 `[0,1)` 随机流。同一 `seed` 在同一 JS 实现下序列相同。
 */
export function createRngFromSeed(seed: string): () => number {
  if (!isValidPuzzleSeedString(seed)) {
    throw new TypeError(
      `puzzle-generator: invalid seed (expected ${PUZZLE_SEED_HEX_DIGITS} lowercase hex chars)`,
    );
  }
  const [a, b, c, d] = parseHex32ToFourWords(seed);
  const mixed = mixFourWordsToUint32(a, b, c, d);
  return createMulberry32(mixed);
}

/** 单次从 `rng` 得到均匀 `uint32`（依赖 `rng` 在 [0,1) 上均匀）。 */
function nextUint32(rng: () => number): number {
  return Math.floor(rng() * 4294967296) >>> 0;
}

/**
 * 从注入的 `rng` 抽取 128 bit，编码为 canonical 32 位十六进制 `seed` 字符串。
 * 会连续调用 `rng` **四次**（每次内部一次 `rng()` 调用）。
 */
export function derivePuzzleSeedString(rng: () => number): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += nextUint32(rng).toString(16).padStart(8, "0");
  }
  return s;
}
