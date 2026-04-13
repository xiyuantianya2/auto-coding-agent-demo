import { boxIndexFromCell } from "../core";

/**
 * 经典数独「同区」关系：两格是否互相可见（同行、同列或同宫，含自身）。
 */
export function cellsSeeEachOther(r1: number, c1: number, r2: number, c2: number): boolean {
  if (r1 === r2 && c1 === c2) return true;
  if (r1 === r2) return true;
  if (c1 === c2) return true;
  return boxIndexFromCell(r1, c1) === boxIndexFromCell(r2, c2);
}
