extends Control

const _BoardLayoutGeneratorScript = preload("res://scripts/board_layout_generator.gd")

## 当前对局棋盘；调用 `restart_new_game` 重开新局。
var current_board
var layout_generator

func _ready() -> void:
	layout_generator = _BoardLayoutGeneratorScript.new()
	current_board = layout_generator.restart_new_game(-1)
	print("link-game-godot: main scene ready; pairs=%d" % _BoardLayoutGeneratorScript.TOTAL_PAIR_COUNT)

## 重开新局。`rng_seed < 0` 使用随机种子；否则为确定性布局（与 `BoardLayoutGenerator.restart_new_game` 一致）。
func restart_new_game(rng_seed: int = -1):
	current_board = layout_generator.restart_new_game(rng_seed)
	return current_board
