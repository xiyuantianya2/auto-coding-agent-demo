extends RefCounted
class_name BoardLayoutGenerator

## 8×12 可解布局生成；约 8 种图案各 12 枚（6 对）。暴露 `restart_new_game` 供重开新局。

const _BoardModelScript = preload("res://scripts/board_model.gd")
const _SolvScript = preload("res://scripts/link_game_solvability.gd")

const PATTERN_KIND_COUNT: int = 8
const TILES_PER_PATTERN: int = (_BoardModelScript.ROWS * _BoardModelScript.COLS) / PATTERN_KIND_COUNT
const TOTAL_PAIR_COUNT: int = (_BoardModelScript.ROWS * _BoardModelScript.COLS) / 2

const _DEFAULT_MAX_RANDOM: int = 250
const _DEFAULT_DFS_RANDOM: int = 400_000
const _DEFAULT_DFS_VERIFY: int = 3_000_000
const _DEFAULT_MAX_MS: int = 5000

var _rng := RandomNumberGenerator.new()
var last_random_attempts: int = 0
var last_path: String = "" # "random" | "constructive"

func _shuffle_in_place(arr: Array) -> void:
	for i in range(arr.size() - 1, 0, -1):
		var j: int = _rng.randi_range(0, i)
		var t: Variant = arr[i]
		arr[i] = arr[j]
		arr[j] = t

func _build_multiset() -> Array:
	var flat: Array = []
	for pid in range(PATTERN_KIND_COUNT):
		for _k in range(TILES_PER_PATTERN):
			flat.append(pid)
	return flat

func _flat_to_board(flat: Array) -> Object:
	var board = _BoardModelScript.new()
	var k := 0
	for r in range(_BoardModelScript.ROWS):
		for c in range(_BoardModelScript.COLS):
			board.cells[r][c] = flat[k]
			k += 1
	return board

## `rng_seed < 0`：随机种子；否则确定性种子（便于测试/回放）。
func restart_new_game(rng_seed: int = -1) -> Object:
	if rng_seed < 0:
		_rng.randomize()
	else:
		_rng.seed = rng_seed as int
	return generate_solvable_layout()

## 与 `restart_new_game` 相同别名，强调「新局」语义。
func new_game(rng_seed: int = -1) -> Object:
	return restart_new_game(rng_seed)

func generate_solvable_layout() -> Object:
	var t0: int = Time.get_ticks_msec()
	var multiset: Array = _build_multiset()

	for attempt in range(_DEFAULT_MAX_RANDOM):
		if Time.get_ticks_msec() - t0 > _DEFAULT_MAX_MS:
			break
		_shuffle_in_place(multiset)
		var board = _flat_to_board(multiset)
		if _SolvScript.is_board_fully_solvable(board, _DEFAULT_DFS_RANDOM):
			last_random_attempts = attempt + 1
			last_path = "random"
			return board

	var sorted: Array = _build_multiset()
	var fallback = _flat_to_board(sorted)
	if not _SolvScript.is_board_fully_solvable(fallback, _DEFAULT_DFS_VERIFY):
		push_error("BoardLayoutGenerator: constructive layout failed solvability check")
		return fallback
	last_random_attempts = _DEFAULT_MAX_RANDOM
	last_path = "constructive"
	return fallback
