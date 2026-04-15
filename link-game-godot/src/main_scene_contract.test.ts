import { describe, it, expect } from "vitest";
import { BOARD_COLS, BOARD_ROWS } from "./link_path";

/**
 * 与 `scripts/board_model.gd` / `scripts/main.gd` 主对局网格约定一致（8×12）。
 * Godot 侧交互由场景脚本实现；此处仅做常量契约回归。
 */
describe("main scene board contract", () => {
  it("matches BoardModel 8×12", () => {
    expect(BOARD_COLS).toBe(8);
    expect(BOARD_ROWS).toBe(12);
  });
});
