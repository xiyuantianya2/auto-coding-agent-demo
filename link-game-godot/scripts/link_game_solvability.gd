extends RefCounted
class_name LinkGameSolvability

## 全盘可解性 DFS（与 `src/full_solvability.ts` 一致）。

const _BoardModelScript = preload("res://scripts/board_model.gd")
const _LinkPathFinderScript = preload("res://scripts/link_path_finder.gd")

static func _clone_board(board) -> Object:
	var b = _BoardModelScript.new()
	for r in range(_BoardModelScript.ROWS):
		for c in range(_BoardModelScript.COLS):
			b.cells[r][c] = board.cells[r][c]
	return b

static func _is_empty(board) -> bool:
	for r in range(_BoardModelScript.ROWS):
		for c in range(_BoardModelScript.COLS):
			if board.cells[r][c] != null:
				return false
	return true

## 返回首个可连同图案对（`{"a": {"row","col"}, "b": {...}}`），若无则 `null`（例如盘面无可连对子）。
static func find_first_connectable_pair(board) -> Variant:
	var pairs: Array = _enumerate_connectable_pairs(board)
	if pairs.is_empty():
		return null
	return pairs[0]


static func _enumerate_connectable_pairs(board) -> Array:
	var by_pattern: Dictionary = {}
	for r in range(_BoardModelScript.ROWS):
		for c in range(_BoardModelScript.COLS):
			var v: Variant = board.cells[r][c]
			if v == null:
				continue
			var pid: int = int(v)
			if not by_pattern.has(pid):
				by_pattern[pid] = []
			(by_pattern[pid] as Array).append({"row": r, "col": c})

	var out: Array = []
	for pid in by_pattern:
		var coords: Array = by_pattern[pid]
		for i in range(coords.size()):
			for j in range(i + 1, coords.size()):
				var p: Dictionary = coords[i]
				var q: Dictionary = coords[j]
				var res: Dictionary = _LinkPathFinderScript.find_link_path(p, q, board)
				if bool(res["ok"]):
					var na: Dictionary
					var nb: Dictionary
					if p["row"] < q["row"] or (p["row"] == q["row"] and p["col"] < q["col"]):
						na = p
						nb = q
					else:
						na = q
						nb = p
					out.append({"a": na, "b": nb})
	return out

static func _dfs(board, counter: Variant) -> bool:
	if _is_empty(board):
		return true
	if counter != null:
		var cdict: Dictionary = counter
		var cn: int = int(cdict["n"])
		var mx: int = int(cdict["max"])
		if cn >= mx:
			return false
		cdict["n"] = cn + 1

	var pairs: Array = _enumerate_connectable_pairs(board)
	for item in pairs:
		var a: Dictionary = item["a"]
		var b: Dictionary = item["b"]
		var ar: int = int(a["row"])
		var ac: int = int(a["col"])
		var br: int = int(b["row"])
		var bc: int = int(b["col"])
		var va: Variant = board.cells[ar][ac]
		var vb: Variant = board.cells[br][bc]
		if va == null or vb == null:
			continue
		board.cells[ar][ac] = null
		board.cells[br][bc] = null
		if _dfs(board, counter):
			return true
		board.cells[ar][ac] = va
		board.cells[br][bc] = vb
	return false

## `max_dfs_nodes`：限制 DFS 访问节点数（随机探测用）；不传则不限（仅验证阶段慎用）。
static func is_board_fully_solvable(board, max_dfs_nodes: int = -1) -> bool:
	var working = _clone_board(board)
	var counter: Variant = null
	if max_dfs_nodes >= 0:
		counter = {"n": 0, "max": max_dfs_nodes}
	return _dfs(working, counter)
