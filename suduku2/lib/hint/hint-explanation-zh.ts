import { TechniqueIds } from "@/lib/solver";
import type { SolveStep } from "@/lib/solver";

import { extractHighlightCandidateRefs, mapHighlightsToCells } from "./map-highlights";

function cellZh(r: number, c: number): string {
  return `第 ${r + 1} 行第 ${c + 1} 列`;
}

function parseUnits(step: SolveStep): Array<{ type: "row" | "col" | "box"; index: number }> {
  const out: Array<{ type: "row" | "col" | "box"; index: number }> = [];
  for (const h of step.highlights) {
    if (h.kind !== "unit") {
      continue;
    }
    const ref = h.ref as { type?: unknown; index?: unknown };
    if (ref.type !== "row" && ref.type !== "col" && ref.type !== "box") {
      continue;
    }
    if (typeof ref.index !== "number" || !Number.isInteger(ref.index) || ref.index < 0 || ref.index > 8) {
      continue;
    }
    out.push({ type: ref.type, index: ref.index });
  }
  return out;
}

function unitPhrase(u: { type: "row" | "col" | "box"; index: number }): string {
  if (u.type === "row") {
    return `第 ${u.index + 1} 行`;
  }
  if (u.type === "col") {
    return `第 ${u.index + 1} 列`;
  }
  return `第 ${u.index + 1} 宫（3×3）`;
}

function firstCellRef(step: SolveStep): { r: number; c: number } | null {
  for (const h of step.highlights) {
    if (h.kind !== "cell") {
      continue;
    }
    const ref = h.ref as { r?: unknown; c?: unknown };
    if (typeof ref.r === "number" && typeof ref.c === "number") {
      return { r: ref.r, c: ref.c };
    }
  }
  const cells = mapHighlightsToCells(step.highlights);
  return cells[0] ?? null;
}

function eliminationSampleCount(step: SolveStep): number {
  const e = step.eliminations;
  if (!Array.isArray(e)) {
    return 0;
  }
  return e.length;
}

/**
 * 由 {@link SolveStep} 生成可直接展示的中文解题说明（观察区域、结论、建议下一步）。
 * 不读取盘面，仅依赖步骤结构；未知技巧 id 时给出兜底说明。
 */
export function buildChineseHintExplanation(step: SolveStep): string {
  const cands = extractHighlightCandidateRefs(step.highlights);
  const primaryDigit = cands[0]?.digit;
  const primaryCell = cands[0] ?? firstCellRef(step);

  switch (step.technique) {
    case TechniqueIds.UniqueCandidate: {
      const d = primaryDigit;
      const p = primaryCell;
      if (p && d !== undefined) {
        return `唯一候选（裸单）：${cellZh(p.r, p.c)} 只剩候选 ${d}，建议将该格填为 ${d}。`;
      }
      return "唯一候选（裸单）：某一空格仅剩一个合法候选，请在高亮格填入对应数字。";
    }
    case TechniqueIds.HiddenSingle: {
      const units = parseUnits(step);
      const u = units[0];
      const d = primaryDigit;
      const cell = firstCellRef(step);
      if (u && d !== undefined && cell) {
        return `隐唯一：在${unitPhrase(u)}中，数字 ${d} 只能落在 ${cellZh(cell.r, cell.c)}（该区域内其它空格都不能再填 ${d}），因此该格应填 ${d}。`;
      }
      if (d !== undefined && cell) {
        return `隐唯一：数字 ${d} 在当前区域仅对应 ${cellZh(cell.r, cell.c)} 一格可填，建议将该格填为 ${d}。`;
      }
      return "隐唯一：某行、列或宫内，某一数字只能落在一格，请在高亮格填入该数。";
    }
    case TechniqueIds.Pointing: {
      const units = parseUnits(step);
      const boxU = units.find((x) => x.type === "box");
      const lineU = units.find((x) => x.type === "row" || x.type === "col");
      const d = primaryDigit;
      const nElim = eliminationSampleCount(step);
      const tail =
        nElim > 0
          ? `共可删去 ${nElim} 处候选；请从高亮所示格中移除对应笔记（不自动改盘面）。`
          : "请从相关格的笔记中移除高亮所示候选。";
      if (boxU && lineU && d !== undefined) {
        const lineWord = lineU.type === "row" ? "行" : "列";
        return `宫内指向：在${unitPhrase(boxU)}内，数字 ${d} 的候选全部落在同一${lineWord}（${unitPhrase(lineU)}）上，因此该${lineWord}在宫外延伸处的格不应再含 ${d}。${tail}`;
      }
      if (d !== undefined) {
        return `宫内指向：某一宫内数字 ${d} 被限制在同一行或列上，可在该行/列穿出本宫的区域删去 ${d}。${tail}`;
      }
      return `宫内指向：利用宫与行/列的交集删减候选。${tail}`;
    }
    case TechniqueIds.BoxLineReduction: {
      const units = parseUnits(step);
      const d = primaryDigit;
      const nElim = eliminationSampleCount(step);
      const tail =
        nElim > 0
          ? `约 ${nElim} 处可删减；请按高亮从宫内相应格移除笔记。`
          : "请按高亮从宫内删去相应候选。";
      const rowU = units.find((x) => x.type === "row");
      const colU = units.find((x) => x.type === "col");
      const boxU = units.find((x) => x.type === "box");
      if (rowU && boxU && d !== undefined) {
        return `行列摒除：在${unitPhrase(rowU)}上，数字 ${d} 仅出现在${unitPhrase(boxU)}内，因此该宫内不在此行上的格可删去 ${d}。${tail}`;
      }
      if (colU && boxU && d !== undefined) {
        return `行列摒除：在${unitPhrase(colU)}上，数字 ${d} 仅出现在${unitPhrase(boxU)}内，因此该宫内不在此列上的格可删去 ${d}。${tail}`;
      }
      if (d !== undefined) {
        return `行列摒除：某行或列上数字 ${d} 被限制在单一宫内，可在该宫内删去行/列方向的多余候选。${tail}`;
      }
      return `行列摒除：利用行/列与宫的约束删减候选。${tail}`;
    }
    case TechniqueIds.NakedPair: {
      const nElim = eliminationSampleCount(step);
      return `显性数对：同一区域有两格候选集合恰好为相同两个数字，可在这两格外删去该二数。${
        nElim > 0 ? `本步涉及约 ${nElim} 处删减，` : ""
      }请按高亮与删减方向更新笔记。`;
    }
    case TechniqueIds.HiddenPair: {
      const nElim = eliminationSampleCount(step);
      return `隐性数对：某两数在同一区域只能落在两格，这两格内其它候选可删。${
        nElim > 0 ? `约 ${nElim} 处可删，` : ""
      }请结合高亮格清理笔记。`;
    }
    case TechniqueIds.NakedTriple: {
      const nElim = eliminationSampleCount(step);
      return `显性三数组：三格候选仅含三个不同数字，可在该区域其余格删去这三数。${
        nElim > 0 ? `约 ${nElim} 处删减。` : ""
      }`;
    }
    case TechniqueIds.HiddenTriple: {
      const nElim = eliminationSampleCount(step);
      return `隐性三数组：三数在区域内只能占据三格，这三格外可删去该三数。${nElim > 0 ? `约 ${nElim} 处删减。` : ""}`;
    }
    case TechniqueIds.XWing: {
      const nElim = eliminationSampleCount(step);
      return `X-Wing：两行（或两列）上某数字形成矩形模式，可在对应方向删去多余候选。${
        nElim > 0 ? `本步约 ${nElim} 处可删。` : "请按高亮与删减标记操作。"
      }`;
    }
    default:
      return `技巧「${step.technique}」：请结合棋盘高亮与候选强调，按推理结论更新笔记或填数；若为删减类步骤，请仅移除高亮所示候选。`;
  }
}
