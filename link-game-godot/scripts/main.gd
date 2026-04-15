extends Control

const _BoardModelScript = preload("res://scripts/board_model.gd")
const _BoardLayoutGeneratorScript = preload("res://scripts/board_layout_generator.gd")
const _LinkPathFinderScript = preload("res://scripts/link_path_finder.gd")
const _SolvScript = preload("res://scripts/link_game_solvability.gd")

## 单局限时（秒），与 `src/match_rules.ts` / README 一致。
const MATCH_TIME_SEC: float = 120.0

const COLS: int = _BoardModelScript.COLS
const ROWS: int = _BoardModelScript.ROWS

## 与 `board_layout_generator.gd` / `run_tests.gd` 一致：8 种图案
const PATTERN_COLORS: Array[Color] = [
	Color8(239, 68, 68),
	Color8(34, 197, 94),
	Color8(59, 130, 246),
	Color8(234, 179, 8),
	Color8(168, 85, 247),
	Color8(236, 72, 153),
	Color8(20, 184, 166),
	Color8(249, 115, 22),
]

## 当前对局棋盘；调用 `restart_new_game` 重开新局。
var current_board
var layout_generator

var _status_label: Label
var _score_label: Label
var _remain_label: Label
var _timer_label: Label
var _cell_panels: Array = [] ## Array[Array] ROWS×COLS → Panel
var _grid: GridContainer
var _path_overlay: Control
var _path_line: Line2D

var score: int = 0
var remaining_tiles: int = COLS * ROWS

var _time_left_sec: float = MATCH_TIME_SEC
var _game_over: bool = false

var _hint_active: bool = false
var _hint_ar: int = -1
var _hint_ac: int = -1
var _hint_br: int = -1
var _hint_bc: int = -1

var _busy: bool = false
var _sel_r: int = -1
var _sel_c: int = -1


func _ready() -> void:
	set_process(true)
	layout_generator = _BoardLayoutGeneratorScript.new()
	current_board = layout_generator.restart_new_game(-1)
	_build_ui()
	_sync_cells_from_board()
	print(
		(
			"link-game-godot: main scene ready; pairs=%d; stretch=%s"
			% [
				_BoardLayoutGeneratorScript.TOTAL_PAIR_COUNT,
				ProjectSettings.get_setting("display/window/stretch/mode", "unknown"),
			]
		)
	)


## 重开新局。`rng_seed < 0` 使用随机种子；否则为确定性布局。
func restart_new_game(rng_seed: int = -1):
	current_board = layout_generator.restart_new_game(rng_seed)
	_sel_r = -1
	_sel_c = -1
	score = 0
	remaining_tiles = COLS * ROWS
	_time_left_sec = MATCH_TIME_SEC
	_game_over = false
	_clear_hint_visual()
	_hide_path_line()
	_sync_cells_from_board()
	_refresh_cell_outlines()
	_update_hud()
	_update_timer_label()
	_set_status("新局已生成，请点选两格进行路径判定。", Color.LIGHT_GRAY)
	return current_board


func _build_ui() -> void:
	var bg := ColorRect.new()
	bg.name = "Background"
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg.color = Color(0.12, 0.14, 0.18)
	add_child(bg)

	var margin := MarginContainer.new()
	margin.name = "RootMargin"
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_bottom", 12)
	add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.name = "MainVBox"
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 10)
	margin.add_child(vbox)

	var title := Label.new()
	title.name = "Title"
	title.text = "连连看-godot · 主对局（点选两格）"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 22)
	vbox.add_child(title)

	var hud := HBoxContainer.new()
	hud.name = "HudRow"
	hud.alignment = BoxContainer.ALIGNMENT_CENTER
	hud.add_theme_constant_override("separation", 28)
	var score_l := Label.new()
	score_l.name = "ScoreLabel"
	score_l.add_theme_font_size_override("font_size", 16)
	hud.add_child(score_l)
	var rem_l := Label.new()
	rem_l.name = "RemainLabel"
	rem_l.add_theme_font_size_override("font_size", 16)
	hud.add_child(rem_l)
	var time_l := Label.new()
	time_l.name = "TimerLabel"
	time_l.add_theme_font_size_override("font_size", 16)
	hud.add_child(time_l)
	vbox.add_child(hud)
	_score_label = score_l
	_remain_label = rem_l
	_timer_label = time_l

	var btn_row := HBoxContainer.new()
	btn_row.name = "ButtonsRow"
	btn_row.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_row.add_theme_constant_override("separation", 12)
	var hint_btn := Button.new()
	hint_btn.name = "HintButton"
	hint_btn.text = "提示"
	hint_btn.pressed.connect(_on_hint_pressed)
	btn_row.add_child(hint_btn)
	var shuffle_btn := Button.new()
	shuffle_btn.name = "ShuffleButton"
	shuffle_btn.text = "洗牌"
	shuffle_btn.pressed.connect(_on_shuffle_pressed)
	btn_row.add_child(shuffle_btn)
	var restart_btn := Button.new()
	restart_btn.name = "RestartButton"
	restart_btn.text = "重新开始"
	restart_btn.pressed.connect(_on_restart_pressed)
	btn_row.add_child(restart_btn)
	vbox.add_child(btn_row)

	var aspect := AspectRatioContainer.new()
	aspect.name = "BoardAspect"
	aspect.ratio = float(COLS) / float(ROWS)
	aspect.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	aspect.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(aspect)

	var board_wrap := Control.new()
	board_wrap.name = "BoardWrap"
	board_wrap.set_anchors_preset(Control.PRESET_FULL_RECT)
	aspect.add_child(board_wrap)

	var grid := GridContainer.new()
	_grid = grid
	grid.name = "BoardGrid"
	grid.columns = COLS
	grid.set_anchors_preset(Control.PRESET_FULL_RECT)
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	board_wrap.add_child(grid)

	_path_overlay = Control.new()
	_path_overlay.name = "PathOverlay"
	_path_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_path_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	board_wrap.add_child(_path_overlay)

	_path_line = Line2D.new()
	_path_line.name = "PathLine"
	_path_line.width = 4.0
	_path_line.default_color = Color(0.35, 0.92, 0.98, 0.95)
	_path_line.joint_mode = Line2D.LINE_JOINT_ROUND
	_path_line.begin_cap_mode = Line2D.LINE_CAP_ROUND
	_path_line.end_cap_mode = Line2D.LINE_CAP_ROUND
	_path_line.visible = false
	_path_overlay.add_child(_path_line)

	_cell_panels.clear()
	for r in range(ROWS):
		var row_arr: Array = []
		for c in range(COLS):
			var panel := _make_cell_panel(r, c)
			grid.add_child(panel)
			row_arr.append(panel)
		_cell_panels.append(row_arr)

	_status_label = Label.new()
	_status_label.name = "Status"
	_status_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_status_label.add_theme_font_size_override("font_size", 15)
	vbox.add_child(_status_label)

	_set_status("先点一格，再点另一格：将调用路径判定（非法选择会有提示）。", Color.LIGHT_GRAY)
	_update_hud()
	_update_timer_label()

	get_viewport().size_changed.connect(_on_viewport_size_changed)


func _process(delta: float) -> void:
	if _game_over:
		return
	_time_left_sec = maxf(_time_left_sec - delta, 0.0)
	_update_timer_label()
	if _time_left_sec <= 0.0:
		_trigger_time_up()


func _trigger_time_up() -> void:
	if _game_over:
		return
	_game_over = true
	_clear_hint_visual()
	_set_status(
		"时间到：本局失败。可点击「重新开始」重开新局（120 秒倒计时将重置）。",
		Color(1.0, 0.45, 0.45),
	)
	print("link-game-godot: time up — game over")


func _on_hint_pressed() -> void:
	if _busy or _game_over:
		return
	if remaining_tiles <= 0:
		_set_status("已全部消除。", Color(0.65, 0.95, 0.75))
		return

	var pair: Variant = _SolvScript.find_first_connectable_pair(current_board)
	if pair != null:
		var d: Dictionary = pair
		var a: Dictionary = d["a"]
		var b: Dictionary = d["b"]
		_hint_ar = int(a["row"])
		_hint_ac = int(a["col"])
		_hint_br = int(b["row"])
		_hint_bc = int(b["col"])
		_hint_active = true
		_refresh_cell_outlines()
		_set_status("提示：可配对两格已高亮。", Color(0.95, 0.85, 1.0))
		return

	_set_status("当前无可连对子，正在尝试洗牌…", Color.LIGHT_GRAY)
	var ok: bool = layout_generator.reshuffle_board_solvable(current_board)
	if not ok:
		_set_status("洗牌失败：无法整理出可解盘。请点击「重新开始」。", Color(1.0, 0.55, 0.45))
		return

	_sync_cells_from_board()
	pair = _SolvScript.find_first_connectable_pair(current_board)
	if pair != null:
		var d2: Dictionary = pair
		var a2: Dictionary = d2["a"]
		var b2: Dictionary = d2["b"]
		_hint_ar = int(a2["row"])
		_hint_ac = int(a2["col"])
		_hint_br = int(b2["row"])
		_hint_bc = int(b2["col"])
		_hint_active = true
		_refresh_cell_outlines()
		_set_status("已洗牌并找到可连对子（高亮显示）。", Color(0.75, 0.95, 0.85))
	else:
		_set_status("洗牌后仍未找到可连对子（异常）。请点击「重新开始」。", Color(1.0, 0.55, 0.45))


func _on_shuffle_pressed() -> void:
	if _busy or _game_over:
		return
	_clear_hint_visual()
	var ok: bool = layout_generator.reshuffle_board_solvable(current_board)
	if ok:
		_sync_cells_from_board()
		_set_status("已洗牌：盘面已重新打乱并保持可解。", Color(0.75, 0.9, 1.0))
	else:
		_set_status("洗牌失败：请稍后重试或点击「重新开始」。", Color(1.0, 0.6, 0.45))


func _on_restart_pressed() -> void:
	if _busy:
		return
	restart_new_game(-1)


func _clear_hint_visual() -> void:
	_hint_active = false
	_hint_ar = -1
	_hint_ac = -1
	_hint_br = -1
	_hint_bc = -1


func _update_timer_label() -> void:
	if _timer_label == null:
		return
	var sec: int = int(ceil(_time_left_sec)) if _time_left_sec > 0.0 else 0
	_timer_label.text = "剩余时间：%d 秒" % sec
	if _game_over:
		_timer_label.add_theme_color_override("font_color", Color(1.0, 0.55, 0.55))
	else:
		_timer_label.remove_theme_color_override("font_color")


func _on_viewport_size_changed() -> void:
	# 依赖 AspectRatioContainer + Grid；窗口变化时刷新一次高亮与排版
	_refresh_cell_outlines()
	if _path_line.visible:
		_hide_path_line()


func _update_hud() -> void:
	_score_label.text = "得分：%d" % score
	_remain_label.text = "剩余牌：%d" % remaining_tiles


func _assert_path_rules(path_res: Dictionary) -> void:
	var bends: Array = path_res["bend_points"]
	if bends.size() > 2:
		push_error("link-game-godot: bend count > 2 (should not happen)")
	var poly: Array = path_res["polyline"]
	var seg: int = maxi(poly.size() - 1, 0)
	if seg > 3:
		push_error("link-game-godot: segment count > 3 (should not happen)")


func _logical_center_global(lr: int, lc: int) -> Vector2:
	var gr := _grid.get_global_rect()
	var cw := gr.size.x / float(COLS)
	var ch := gr.size.y / float(ROWS)
	return Vector2(gr.position.x + (float(lc) + 0.5) * cw, gr.position.y + (float(lr) + 0.5) * ch)


func _polyline_to_line_local(poly: Array) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for p in poly:
		var lr: int = int(p["row"])
		var lc: int = int(p["col"])
		var g: Vector2 = _logical_center_global(lr, lc)
		pts.append(_path_line.to_local(g))
	return pts


func _show_path_for_result(path_res: Dictionary) -> void:
	var poly: Array = path_res["polyline"]
	_path_line.points = _polyline_to_line_local(poly)
	_path_line.visible = true


func _hide_path_line() -> void:
	_path_line.visible = false
	_path_line.clear_points()


func _begin_match_resolve(ar: int, ac: int, br: int, bc: int, path_res: Dictionary) -> void:
	_clear_hint_visual()
	_busy = true
	_assert_path_rules(path_res)
	_show_path_for_result(path_res)
	await get_tree().create_timer(0.38).timeout
	current_board.cells[ar][ac] = null
	current_board.cells[br][bc] = null
	score += 10
	remaining_tiles = maxi(remaining_tiles - 2, 0)
	_hide_path_line()
	_sync_cells_from_board()
	_update_hud()
	_set_status(
		(
			"已消除一对！得分 %d，剩余 %d 张。折点 %d 个。"
			% [score, remaining_tiles, int(path_res["bend_points"].size())]
		),
		Color(0.65, 0.95, 0.75),
	)
	_busy = false


func _make_cell_panel(r: int, c: int) -> Panel:
	var panel := Panel.new()
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.custom_minimum_size = Vector2(28, 28)

	var fill := ColorRect.new()
	fill.name = "Fill"
	fill.set_anchors_preset(Control.PRESET_FULL_RECT)
	fill.offset_left = 3
	fill.offset_top = 3
	fill.offset_right = -3
	fill.offset_bottom = -3
	fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(fill)

	var lbl := Label.new()
	lbl.name = "Glyph"
	lbl.set_anchors_preset(Control.PRESET_CENTER)
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lbl.add_theme_font_size_override("font_size", 14)
	lbl.add_theme_color_override("font_color", Color(1, 1, 1, 0.96))
	lbl.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.75))
	lbl.add_theme_constant_override("outline_size", 3)
	panel.add_child(lbl)

	var rr := r
	var cc := c
	panel.gui_input.connect(func(ev: InputEvent): _on_cell_gui_input(ev, rr, cc))
	return panel


func _on_cell_gui_input(event: InputEvent, r: int, c: int) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT and mb.pressed:
			_on_cell_clicked(r, c)


func _on_cell_clicked(r: int, c: int) -> void:
	if _busy:
		return
	if _game_over:
		_set_status("本局已结束（时间到）。请点击「重新开始」。", Color(1.0, 0.55, 0.45))
		return
	_clear_hint_visual()
	var v: Variant = current_board.cells[r][c]
	if v == null:
		var msg := "无效：空格不可选择。"
		print("link-game-godot: %s" % msg)
		_set_status(msg, Color(1.0, 0.55, 0.45))
		return

	if _sel_r < 0:
		_sel_r = r
		_sel_c = c
		_refresh_cell_outlines()
		_set_status("已选 (%d,%d)，请选择第二格。" % [r + 1, c + 1], Color.LIGHT_GRAY)
		return

	if r == _sel_r and c == _sel_c:
		_sel_r = -1
		_sel_c = -1
		_refresh_cell_outlines()
		_set_status("已取消选择。", Color.LIGHT_GRAY)
		return

	var ar := _sel_r
	var ac := _sel_c
	var br := r
	var bc := c

	var pa: Variant = current_board.cells[ar][ac]
	var pb: Variant = current_board.cells[br][bc]
	if pa == null or pb == null:
		push_warning("link-game-godot: unexpected null tile during selection")
		_reset_selection_after_attempt()
		return

	if int(pa) != int(pb):
		var msg := "非法：两格图案不同（%d 与 %d）。" % [int(pa) + 1, int(pb) + 1]
		print("link-game-godot: %s" % msg)
		_set_status(msg, Color(1.0, 0.55, 0.45))
		_reset_selection_after_attempt()
		return

	var path_res: Dictionary = _LinkPathFinderScript.find_link_path(
		{"row": ar, "col": ac}, {"row": br, "col": bc}, current_board
	)
	if not bool(path_res["ok"]):
		var msg2 := "非法：图案相同但当前规则下无法连接（≤2 弯路径不存在）。"
		print("link-game-godot: %s" % msg2)
		_set_status(msg2, Color(1.0, 0.55, 0.45))
		_reset_selection_after_attempt()
		return

	print("link-game-godot: match ok polyline=%s bends=%s" % [str(path_res["polyline"]), str(path_res["bend_points"])])
	_reset_selection_after_attempt()
	_begin_match_resolve(ar, ac, br, bc, path_res)


func _reset_selection_after_attempt() -> void:
	_sel_r = -1
	_sel_c = -1
	_refresh_cell_outlines()


func _set_status(text: String, color: Color) -> void:
	_status_label.text = text
	_status_label.add_theme_color_override("font_color", color)


func _sync_cells_from_board() -> void:
	for r in range(ROWS):
		for c in range(COLS):
			_apply_cell_visual(r, c)


func _apply_cell_visual(r: int, c: int) -> void:
	var panel: Panel = _cell_panels[r][c]
	var fill: ColorRect = panel.get_node("Fill") as ColorRect
	var lbl: Label = panel.get_node("Glyph") as Label
	var v: Variant = current_board.cells[r][c]
	if v == null:
		fill.color = Color(0.18, 0.2, 0.24)
		lbl.text = ""
	else:
		var pid: int = int(v)
		fill.color = PATTERN_COLORS[pid % PATTERN_COLORS.size()]
		lbl.text = str(pid + 1)


func _refresh_cell_outlines() -> void:
	for r in range(ROWS):
		for c in range(COLS):
			var panel: Panel = _cell_panels[r][c]
			var is_hint := (
				_hint_active
				and (
					(r == _hint_ar and c == _hint_ac)
					or (r == _hint_br and c == _hint_bc)
				)
			)
			var sel := (r == _sel_r and c == _sel_c)
			var sb := StyleBoxFlat.new()
			sb.bg_color = Color(0, 0, 0, 0)
			if is_hint:
				sb.set_border_width_all(3)
				sb.border_color = Color(0.95, 0.35, 0.98)
			elif sel:
				sb.set_border_width_all(2)
				sb.border_color = Color(1.0, 0.82, 0.35)
			else:
				sb.set_border_width_all(1)
				sb.border_color = Color(0.08, 0.09, 0.11)
			panel.add_theme_stylebox_override("panel", sb)
