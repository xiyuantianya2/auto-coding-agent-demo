extends SceneTree

## 无头自检：路径判定、棋盘模型与可解布局生成。
## 运行：godot --headless -s run_tests.gd
##
## 使用 `preload` 取脚本资源，避免无 `.godot` 时全局 `class_name` 未索引。

const _BoardModelScript = preload("res://scripts/board_model.gd")
const _LinkPathFinderScript = preload("res://scripts/link_path_finder.gd")
const _BoardLayoutGeneratorScript = preload("res://scripts/board_layout_generator.gd")
const _SolvScript = preload("res://scripts/link_game_solvability.gd")

## 与 `board_model.gd` / `board_layout_generator.gd` 常量一致
const _EXPECT_ROWS := 12
const _EXPECT_COLS := 8
const _EXPECT_PATTERN_KINDS := 8
const _EXPECT_TILES_PER_PATTERN := 12

func _fail(msg: String) -> void:
	push_error("run_tests.gd: %s" % msg)
	quit(1)

func _init() -> void:
	_test_adjacent()
	_test_detour_when_straight_blocked()
	_test_horizontal_through_empty()
	_test_post_match_segment_rules()
	_test_cleared_cells_empty_for_next_path()
	_test_layout_board_shape_and_pairs()
	_test_layout_deterministic_seed()
	_test_layout_multiple_solvable()
	_test_hint_pair_exists()
	_test_reshuffle_preserves_multiset()
	_test_victory_all_cleared_has_zero_tiles()
	print("link-game-godot: run_tests — board + path + layout OK")
	quit(0)

func _test_adjacent() -> void:
	var board = _BoardModelScript.new()
	board.set_pattern(0, 0, 7)
	board.set_pattern(0, 1, 7)
	var r = _LinkPathFinderScript.find_link_path({"row": 0, "col": 0}, {"row": 0, "col": 1}, board)
	if not bool(r["ok"]):
		_fail("adjacent same pattern should connect")
	var bends: Array = r["bend_points"]
	if bends.size() != 0:
		_fail("adjacent pair should have zero bend points")

func _test_detour_when_straight_blocked() -> void:
	var board = _BoardModelScript.new()
	board.set_pattern(0, 0, 2)
	board.set_pattern(0, 2, 2)
	board.set_pattern(0, 1, 99)
	var r = _LinkPathFinderScript.find_link_path({"row": 0, "col": 0}, {"row": 0, "col": 2}, board)
	if not bool(r["ok"]):
		_fail("should detour via padding when straight is blocked")
	var bends: Array = r["bend_points"]
	if bends.size() < 1:
		_fail("detour should introduce at least one bend point")

func _test_horizontal_through_empty() -> void:
	var board = _BoardModelScript.new()
	board.set_pattern(0, 0, 5)
	board.set_pattern(0, 4, 5)
	var r = _LinkPathFinderScript.find_link_path({"row": 0, "col": 0}, {"row": 0, "col": 4}, board)
	if not bool(r["ok"]):
		_fail("line through empty cells should connect")
	var bends: Array = r["bend_points"]
	if bends.size() != 0:
		_fail("straight line should have no bends")

func _test_post_match_segment_rules() -> void:
	var board = _BoardModelScript.new()
	board.set_pattern(0, 0, 7)
	board.set_pattern(0, 1, 7)
	var r = _LinkPathFinderScript.find_link_path({"row": 0, "col": 0}, {"row": 0, "col": 1}, board)
	if not bool(r["ok"]):
		_fail("adjacent pair should link for segment rule test")
	var poly: Array = r["polyline"]
	var bends: Array = r["bend_points"]
	if bends.size() > 2:
		_fail("bend points should be at most 2")
	var seg: int = maxi(poly.size() - 1, 0)
	if seg > 3:
		_fail("orthogonal path should have at most 3 segments")

func _test_cleared_cells_empty_for_next_path() -> void:
	var board = _BoardModelScript.new()
	board.set_pattern(0, 0, 3)
	board.set_pattern(0, 1, 3)
	var r1 = _LinkPathFinderScript.find_link_path({"row": 0, "col": 0}, {"row": 0, "col": 1}, board)
	if not bool(r1["ok"]):
		_fail("first pair should link before clear")
	board.cells[0][0] = null
	board.cells[0][1] = null
	board.set_pattern(0, 2, 1)
	board.set_pattern(0, 6, 1)
	var r2 = _LinkPathFinderScript.find_link_path({"row": 0, "col": 2}, {"row": 0, "col": 6}, board)
	if not bool(r2["ok"]):
		_fail("should link through cleared cells as empty")
	var bends2: Array = r2["bend_points"]
	if bends2.size() > 2:
		_fail("second path should respect bend limit")

func _test_layout_board_shape_and_pairs() -> void:
	var gen = _BoardLayoutGeneratorScript.new()
	var b = gen.call("restart_new_game", 424242)
	if b.cells.size() != _EXPECT_ROWS:
		_fail("layout rows mismatch")
	if b.cells[0].size() != _EXPECT_COLS:
		_fail("layout cols mismatch")
	var counts: Dictionary = {}
	for r in range(_EXPECT_ROWS):
		for c in range(_EXPECT_COLS):
			var v: Variant = b.cells[r][c]
			if v == null:
				_fail("layout should be full")
			var pid: int = int(v)
			counts[pid] = int(counts.get(pid, 0)) + 1
	if counts.size() != _EXPECT_PATTERN_KINDS:
		_fail("pattern kind count mismatch")
	for pid in counts:
		if int(counts[pid]) != _EXPECT_TILES_PER_PATTERN:
			_fail("tiles per pattern mismatch")

func _test_layout_deterministic_seed() -> void:
	var g1 = _BoardLayoutGeneratorScript.new()
	var g2 = _BoardLayoutGeneratorScript.new()
	var a = g1.call("restart_new_game", 777888)
	var b = g2.call("restart_new_game", 777888)
	for r in range(_EXPECT_ROWS):
		for c in range(_EXPECT_COLS):
			if a.cells[r][c] != b.cells[r][c]:
				_fail("deterministic seed should yield identical boards")

func _test_layout_multiple_solvable() -> void:
	for i in range(5):
		var gen = _BoardLayoutGeneratorScript.new()
		var board = gen.call("restart_new_game", 10000 + i)
		if not _SolvScript.is_board_fully_solvable(board, 3000000):
			_fail("generated layout should be fully solvable")


func _test_hint_pair_exists() -> void:
	var gen = _BoardLayoutGeneratorScript.new()
	var board = gen.call("restart_new_game", 54321)
	var p: Variant = _SolvScript.find_first_connectable_pair(board)
	if p == null:
		_fail("hint: new solvable board should expose at least one connectable pair")


func _test_reshuffle_preserves_multiset() -> void:
	var gen = _BoardLayoutGeneratorScript.new()
	var board = gen.call("restart_new_game", 111222)
	var counts_before: Dictionary = {}
	for r in range(_EXPECT_ROWS):
		for c in range(_EXPECT_COLS):
			var pid: int = int(board.cells[r][c])
			var key := str(pid)
			counts_before[key] = int(counts_before.get(key, 0)) + 1
	if not gen.reshuffle_board_solvable(board):
		_fail("reshuffle should succeed on a full board")
	var counts_after: Dictionary = {}
	for r in range(_EXPECT_ROWS):
		for c in range(_EXPECT_COLS):
			var pid2: int = int(board.cells[r][c])
			var key2 := str(pid2)
			counts_after[key2] = int(counts_after.get(key2, 0)) + 1
	for k in counts_before:
		if int(counts_before[k]) != int(counts_after.get(k, 0)):
			_fail("reshuffle should preserve multiset counts")
	for k in counts_after:
		if int(counts_after[k]) != int(counts_before.get(k, 0)):
			_fail("reshuffle should preserve multiset counts")
	if not _SolvScript.is_board_fully_solvable(board, 3000000):
		_fail("reshuffled board should remain fully solvable")


func _test_victory_all_cleared_has_zero_tiles() -> void:
	var empty = _BoardModelScript.new()
	if empty.count_nonempty_tiles() != 0:
		_fail("fresh cleared board should have 0 nonempty tiles (victory-style empty)")
	var gen = _BoardLayoutGeneratorScript.new()
	var board = gen.call("restart_new_game", 424242)
	if board.count_nonempty_tiles() != _EXPECT_ROWS * _EXPECT_COLS:
		_fail("full layout should fill every cell")
	for r in range(_EXPECT_ROWS):
		for c in range(_EXPECT_COLS):
			board.cells[r][c] = null
	if board.count_nonempty_tiles() != 0:
		_fail("all cells cleared should yield 0 tiles (victory condition)")
