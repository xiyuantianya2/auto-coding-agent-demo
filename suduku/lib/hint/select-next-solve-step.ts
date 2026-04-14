import { TECHNIQUE_RESOLUTION_ORDER } from "@/lib/solver";
import type { SolveStep, TechniqueId } from "@/lib/solver";

/**
 * 将 {@link TechniqueId} 映射到 {@link TECHNIQUE_RESOLUTION_ORDER} 中的下标。
 * 未收录的技巧排在列表末尾，保证与引擎「已知技巧」相比始终后选。
 */
function resolutionIndex(technique: TechniqueId): number {
  const i = TECHNIQUE_RESOLUTION_ORDER.indexOf(technique);
  return i === -1 ? TECHNIQUE_RESOLUTION_ORDER.length : i;
}

/**
 * 从 `findTechniques(state)` 返回的步骤序列中，选出唯一一条作为「下一步」提示依据。
 *
 * **选取规则（与教学 / 练习模式「先教低阶再教高阶」一致）：**
 *
 * 1. 在结果集中出现的技巧里，取 {@link TECHNIQUE_RESOLUTION_ORDER} 中**最靠前**的一条（即优先级最高、最低阶）。
 * 2. 在该技巧的所有步骤实例中，保留调用方传入数组的**原有顺序**，取第一条——与 `findTechniques` 的稳定输出一致（裸单行优先、隐单行→列→宫次序、消除步经合并后的顺序等）。
 *
 * 不修改入参数组；若 `steps` 为空则返回 `null`。
 */
export function selectNextSolveStep(steps: readonly SolveStep[]): SolveStep | null {
  if (steps.length === 0) return null;

  let bestIdx = Infinity;
  for (const s of steps) {
    const p = resolutionIndex(s.technique);
    if (p < bestIdx) bestIdx = p;
  }

  for (const s of steps) {
    if (resolutionIndex(s.technique) === bestIdx) return s;
  }

  return null;
}
