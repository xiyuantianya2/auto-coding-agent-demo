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


## 非空格子数量；为 0 表示已全部消除（胜利条件）。
func count_nonempty_tiles() -> int:
	var n := 0
	for r in range(ROWS):
		for c in range(COLS):
			if cells[r][c] != null:
				n += 1
	return n
