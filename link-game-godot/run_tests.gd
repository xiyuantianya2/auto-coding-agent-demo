extends SceneTree

## 占位入口：后续接入 GUT 或自定义测试场景后，用
##   godot --headless -s run_tests.gd
## 在 CI / 本地无头执行。当前仅验证脚本可启动并正常退出。

func _init() -> void:
	print("link-game-godot: run_tests placeholder — exit 0")
	quit(0)
