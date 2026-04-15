import type { CellCoord, LinkPathResult } from "./link_path";

/** 与 requirements / `LinkPathFinder` 一致：≤2 拐弯 ⇒ ≤3 直线段、折点至多 2 个 */
export function assertPathMeetsLinkRules(result: LinkPathResult): void {
  if (!result.ok) {
    return;
  }
  const { polyline, bendPoints } = result;
  if (bendPoints.length > 2) {
    throw new Error(`expected at most 2 bend points, got ${bendPoints.length}`);
  }
  const segments = polyline.length > 0 ? polyline.length - 1 : 0;
  if (segments > 3) {
    throw new Error(`expected at most 3 segments, got ${segments}`);
  }
}

/** 折线路径是否仅为水平/垂直（无斜边） */
export function isOrthogonalPolyline(points: readonly CellCoord[]): boolean {
  if (points.length < 2) {
    return true;
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const dr = b.row - a.row;
    const dc = b.col - a.col;
    if (dr !== 0 && dc !== 0) {
      return false;
    }
    if (dr === 0 && dc === 0) {
      return false;
    }
  }
  return true;
}
