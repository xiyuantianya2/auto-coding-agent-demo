/**
 * Task 14：对 DEFAULT_LEVELS 每关固定种子批量调用生成（默认每关 100 次），
 * 统计平均/最坏重试次数与耗时；需在 link-game 目录执行：
 *   npx tsx scripts/benchmark-board-generation.ts
 */
import {
  generateBoardFromLevel,
  getLastBoardGenerationMetrics,
  maxRandomAttemptsForLevel,
} from "../lib/game/board-generation";
import { isBoardFullySolvable } from "../lib/game/full-solvability";
import { DEFAULT_LEVELS } from "../lib/game/levels";
import { mulberry32 } from "../lib/game/rng";

const BATCH = Number(process.env.BENCH_BATCH ?? "100");

function main(): void {
  for (const level of DEFAULT_LEVELS) {
    const cap = maxRandomAttemptsForLevel(level);
    let sumAttempts = 0;
    let maxAttempts = 0;
    let sumMs = 0;
    let maxMs = 0;
    let constructiveCount = 0;

    for (let seed = 0; seed < BATCH; seed++) {
      const rng = mulberry32(seed ^ (level.id << 16));
      const board = generateBoardFromLevel(level, rng);
      if (!isBoardFullySolvable(board)) {
        throw new Error(`unsolvable board level ${level.id} seed ${seed}`);
      }
      const m = getLastBoardGenerationMetrics();
      if (!m) throw new Error("missing metrics");
      if (m.path === "constructive") constructiveCount++;
      sumAttempts += m.randomAttempts;
      maxAttempts = Math.max(maxAttempts, m.randomAttempts);
      sumMs += m.durationMs;
      maxMs = Math.max(maxMs, m.durationMs);
    }

    console.log(
      `[bench] level ${level.id} (${level.rows}×${level.cols}) n=${BATCH} ` +
        `avgRetries=${(sumAttempts / BATCH).toFixed(2)} maxRetries=${maxAttempts} ` +
        `avgMs=${(sumMs / BATCH).toFixed(3)} maxMs=${maxMs.toFixed(3)} ` +
        `constructive=${constructiveCount}/${BATCH} randomCap=${cap}`,
    );
  }
}

main();
