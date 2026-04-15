extends SceneTree

## 无头自检：路径判定与棋盘模型（与 `src/link_path.test.ts` 场景对齐的子集）。
## 运行：godot --headless -s run_tests.gd

func _fail(msg: String) -> void:
	push_error("run_tests.gd: %s" % msg)
	quit(1)

func _init() -> void:
	_test_adjacent()
	_test_detour_when_straight_blocked()
	_test_horizontal_through_empty()
	print("link-game-godot: run_tests — board + path OK")
	quit(0)

func _test_adjacent() -> void:
	var board := BoardModel.new()
	board.set_pattern(0, 0, 7)
	board.set_pattern(0, 1, 7)
	var r := LinkPathFinder.find_link_path({"row": 0, "col": 0}, {"row": 0, "col": 1}, board)
	if not bool(r["ok"]):
		_fail("adjacent same pattern should connect")
	var bends: Array = r["bend_points"]
	if bends.size() != 0:
		_fail("adjacent pair should have zero bend points")

func _test_detour_when_straight_blocked() -> void:
	var board := BoardModel.new()
	board.set_pattern(0, 0, 2)
	board.set_pattern(0, 2, 2)
	board.set_pattern(0, 1, 99)
	var r := LinkPathFinder.find_link_path({"row": 0, "col": 0}, {"row": 0, "col": 2}, board)
	if not bool(r["ok"]):
		_fail("should detour via padding when straight is blocked")
	var bends: Array = r["bend_points"]
	if bends.size() < 1:
		_fail("detour should introduce at least one bend point")

func _test_horizontal_through_empty() -> void:
	var board := BoardModel.new()
	board.set_pattern(0, 0, 5)
	board.set_pattern(0, 4, 5)
	var r := LinkPathFinder.find_link_path({"row": 0, "col": 0}, {"row": 0, "col": 4}, board)
	if not bool(r["ok"]):
		_fail("line through empty cells should connect")
	var bends: Array = r["bend_points"]
	if bends.size() != 0:
		_fail("straight line should have no bends")
