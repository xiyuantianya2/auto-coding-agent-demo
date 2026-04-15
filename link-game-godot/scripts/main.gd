extends Control

const _BoardModelScript = preload("res://scripts/board_model.gd")
const _BoardLayoutGeneratorScript = preload("res://scripts/board_layout_generator.gd")
const _LinkPathFinderScript = preload("res://scripts/link_path_finder.gd")

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
var _cell_panels: Array = [] ## Array[Array] ROWS×COLS → Panel
var _sel_r: int = -1
var _sel_c: int = -1


func _ready() -> void:
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
	_sync_cells_from_board()
	_refresh_selection_highlight()
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

	var aspect := AspectRatioContainer.new()
	aspect.name = "BoardAspect"
	aspect.ratio = float(COLS) / float(ROWS)
	aspect.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	aspect.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vbox.add_child(aspect)

	var grid := GridContainer.new()
	grid.name = "BoardGrid"
	grid.columns = COLS
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	aspect.add_child(grid)

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

	get_viewport().size_changed.connect(_on_viewport_size_changed)


func _on_viewport_size_changed() -> void:
	# 依赖 AspectRatioContainer + Grid；窗口变化时刷新一次高亮与排版
	_refresh_selection_highlight()


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
	var v: Variant = current_board.cells[r][c]
	if v == null:
		var msg := "无效：空格不可选择。"
		print("link-game-godot: %s" % msg)
		_set_status(msg, Color(1.0, 0.55, 0.45))
		return

	if _sel_r < 0:
		_sel_r = r
		_sel_c = c
		_refresh_selection_highlight()
		_set_status("已选 (%d,%d)，请选择第二格。" % [r + 1, c + 1], Color.LIGHT_GRAY)
		return

	if r == _sel_r and c == _sel_c:
		_sel_r = -1
		_sel_c = -1
		_refresh_selection_highlight()
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

	var bends: Array = path_res["bend_points"]
	var ok_msg := "可连：路径判定成功（折点 %d 个）。消除动画将在后续任务接入。" % bends.size()
	print("link-game-godot: %s polyline=%s" % [ok_msg, str(path_res["polyline"])])
	_set_status(ok_msg, Color(0.65, 0.95, 0.75))
	_reset_selection_after_attempt()


func _reset_selection_after_attempt() -> void:
	_sel_r = -1
	_sel_c = -1
	_refresh_selection_highlight()


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


func _refresh_selection_highlight() -> void:
	for r in range(ROWS):
		for c in range(COLS):
			var panel: Panel = _cell_panels[r][c]
			var sel := (r == _sel_r and c == _sel_c)
			var sb := StyleBoxFlat.new()
			sb.bg_color = Color(0, 0, 0, 0)
			sb.set_border_width_all(2 if sel else 1)
			sb.border_color = Color(1.0, 0.82, 0.35) if sel else Color(0.08, 0.09, 0.11)
			panel.add_theme_stylebox_override("panel", sb)
