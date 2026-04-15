extends RefCounted
class_name BoardModel

## 8×12 棋盘；`cells[r][c]` 为图案 id（`int`）或 `null`（已消除空位）。
## 与 [requirements-archive.md](../requirements-archive.md) 及 `src/link_path.ts` 约定一致。

const COLS: int = 8
const ROWS: int = 12

## `Array[Array]`，每格 [Variant]：`int` 或 `null`
var cells: Array = []

func _init() -> void:
	clear_to_empty()

func clear_to_empty() -> void:
	cells.clear()
	for _r in range(ROWS):
		var row: Array = []
		row.resize(COLS)
		for c in range(COLS):
			row[c] = null
		cells.append(row)

func get_pattern(row: int, col: int) -> Variant:
	return cells[row][col]

func set_pattern(row: int, col: int, pattern: Variant) -> void:
	cells[row][col] = pattern
