extends RefCounted
class_name LinkPathFinder

## 路径判定：四连通、转弯 ≤2（≤3 段直线）、不斜连；中间须为空；外侧 padding 为空。
## 算法与 `src/link_path.ts` 保持一致，供 UI 与自动化共用。

const _DR: Array[int] = [-1, 0, 1, 0]
const _DC: Array[int] = [0, 1, 0, -1]

static func _state_key(r: int, c: int, last_dir: int, bends: int) -> String:
	return "%d,%d,%d,%d" % [r, c, last_dir, bends]

static func _pad_to_logical(pr: int, pc: int) -> Dictionary:
	return {"row": pr - 1, "col": pc - 1}

static func _simplify_orthogonal(points: Array) -> Array:
	if points.size() <= 2:
		return points.duplicate()
	var out: Array = [points[0]]
	var i := 1
	while i < points.size() - 1:
		var prev: Dictionary = points[i - 1]
		var cur: Dictionary = points[i]
		var nxt: Dictionary = points[i + 1]
		var d1r: int = cur["row"] - prev["row"]
		var d1c: int = cur["col"] - prev["col"]
		var d2r: int = nxt["row"] - cur["row"]
		var d2c: int = nxt["col"] - cur["col"]
		if d1r != d2r or d1c != d2c:
			out.append(cur)
		i += 1
	out.append(points[points.size() - 1])
	return out

## `cell_a`, `cell_b`：字典 `{"row": int, "col": int}`，零基棋盘坐标。
## 返回：`{"ok": bool, "polyline": Array[Dictionary], "bend_points": Array[Dictionary]}`，
## 每项为 `{"row": int, "col": int}`（逻辑坐标，含外侧通道 -1 或 ROWS/COLS）。
static func find_link_path(cell_a: Dictionary, cell_b: Dictionary, board: BoardModel) -> Dictionary:
	var empty_result := {"ok": false, "polyline": [], "bend_points": []}

	var ar: int = int(cell_a["row"])
	var ac: int = int(cell_a["col"])
	var br: int = int(cell_b["row"])
	var bc: int = int(cell_b["col"])

	if ar == br and ac == bc:
		return empty_result
	if ar < 0 or ar >= BoardModel.ROWS or ac < 0 or ac >= BoardModel.COLS:
		return empty_result
	if br < 0 or br >= BoardModel.ROWS or bc < 0 or bc >= BoardModel.COLS:
		return empty_result

	var pa: Variant = board.cells[ar][ac]
	var pb: Variant = board.cells[br][bc]
	if pa == null or pb == null or int(pa) != int(pb):
		return empty_result

	var rows: int = BoardModel.ROWS
	var cols: int = BoardModel.COLS
	var pr: int = rows + 2
	var pc: int = cols + 2

	var pad: Array = []
	for _i in range(pr):
		var prow: Array = []
		prow.resize(pc)
		for j in range(pc):
			prow[j] = null
		pad.append(prow)

	for r in range(rows):
		for c in range(cols):
			pad[r + 1][c + 1] = board.cells[r][c]

	pad[ar + 1][ac + 1] = null
	pad[br + 1][bc + 1] = null

	var sr: int = ar + 1
	var sc: int = ac + 1
	var er: int = br + 1
	var ec: int = bc + 1

	var queue: Array = []
	queue.append([sr, sc, -1, 0])
	var seen := {}
	var parent := {}

	var start_key := _state_key(sr, sc, -1, 0)
	parent[start_key] = null

	var head := 0
	var end_state: Variant = null

	while head < queue.size():
		var cur: Array = queue[head]
		head += 1
		var r: int = cur[0]
		var c: int = cur[1]
		var last_dir: int = cur[2]
		var bends: int = cur[3]
		var ck := _state_key(r, c, last_dir, bends)
		if seen.has(ck):
			continue
		seen[ck] = true

		if r == er and c == ec:
			end_state = cur
			break

		for d in range(4):
			var nr: int = r + _DR[d]
			var nc: int = c + _DC[d]
			if nr < 0 or nr >= pr or nc < 0 or nc >= pc:
				continue
			if pad[nr][nc] != null:
				continue

			var nb: int = bends
			if last_dir != -1 and d != last_dir:
				nb += 1
			if nb > 2:
				continue

			var nk := _state_key(nr, nc, d, nb)
			if not parent.has(nk):
				parent[nk] = cur
			queue.append([nr, nc, d, nb])

	if end_state == null:
		return empty_result

	var pad_cells: Array = []
	var trace: Variant = end_state
	while trace != null:
		var t: Array = trace
		pad_cells.append([t[0], t[1]])
		var tk := _state_key(t[0], t[1], t[2], t[3])
		trace = parent.get(tk, null)
	pad_cells.reverse()

	var poly: Array = []
	for item in pad_cells:
		var ppr: int = item[0]
		var ppc: int = item[1]
		poly.append(_pad_to_logical(ppr, ppc))

	var simplified: Array = _simplify_orthogonal(poly)
	var bend_pts: Array = []
	if simplified.size() > 2:
		for k in range(1, simplified.size() - 1):
			bend_pts.append(simplified[k])

	return {"ok": true, "polyline": simplified, "bend_points": bend_pts}
