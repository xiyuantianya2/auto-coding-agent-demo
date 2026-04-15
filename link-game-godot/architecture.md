# 连连看-godot — 架构说明（最终版）

## 项目概述

- **类型**：2D 连连看（**8 列 × 12 行** 网格；**8** 种图案，每种 **12** 枚，共 **96** 张牌成 **48** 对；路径最多 **2** 个拐弯即不超过 **3** 段直线；**不可斜连**；中间格与棋盘外一圈 **padding** 视为可穿行空位，与已消除空位规则一致）。
- **平台**：Godot **4.x**，目标 **Windows 桌面** 与 **Android** 导出（预设见 `export_presets.cfg`）。
- **交互**：鼠标点选两格；**120 秒** 倒计时；**提示**、**洗牌**；**无撤销**；通关或超时后弹层 **「再来一局」** / 工具栏 **「重新开始」**。
- **美术**：彩色矩形占位 + 数字标签；**单局随机可解** 布局；无关卡编辑器与存档。

## 技术栈

| 层级 | 说明 |
|------|------|
| 游戏运行时 | Godot 4.x，GDScript（`scripts/*.gd`、`scenes/main.tscn`） |
| 自动化测试（引擎内） | **自定义** `run_tests.gd`（`extends SceneTree`），`godot --headless -s run_tests.gd` 退出码表示成败；**不依赖 GUT** |
| 逻辑镜像 / CI 快速反馈 | TypeScript（`src/*.ts`）与 GDScript **同规则**，**Vitest**（`npm test`）覆盖路径、生成器、提示/洗牌等 |
| 仓库工具链 / 浏览器冒烟 | Node.js + **Playwright**（`npm run dev` → `public/` 静态页；**不加载 Godot Web 运行时**） |

## 目录结构

```
link-game-godot/
├── project.godot              # Godot 项目入口
├── export_presets.cfg         # Windows / Android 导出预设
├── scenes/main.tscn           # 主对局场景
├── scripts/
│   ├── main.gd                # 主 UI：计时、HUD、选牌、提示/洗牌、胜负弹层
│   ├── board_model.gd         # BoardModel：8×12，cells[r][c] = int | null
│   ├── board_layout_generator.gd
│   ├── link_path_finder.gd    # ≤2 弯路径（≤3 段）
│   └── link_game_solvability.gd
├── run_tests.gd               # 无头测试入口（SceneTree）
├── src/                       # TS 镜像与 Vitest
├── public/                    # npm dev 静态占位（Playwright）
├── e2e/*.spec.ts              # Playwright 冒烟
├── scripts/verify-godot-project.mjs
├── scripts/run-godot-tests.mjs
├── playwright.config.ts
├── requirements-archive.md    # 需求留档（勿清空历史）
├── task.json
├── README.md
└── architecture.md            # 本文件
```

## 核心模块

1. **`BoardModel`**（`scripts/board_model.gd`）：`cells` 为 `ROWS×COLS`；`null` 表示已消除空位。
2. **`LinkPathFinder.find_link_path`**（`scripts/link_path_finder.gd`）：四连通、转弯 ≤2、不斜连；返回 `ok`、`polyline`、`bend_points`。
3. **`BoardLayoutGenerator`**（`scripts/board_layout_generator.gd`）：随机可解布局；`restart_new_game(seed)`；`reshuffle_board_solvable` 保持 multiset 且尽量全盘可解。
4. **`link_game_solvability.gd`**：`find_first_connectable_pair` 等，供提示与高亮。
5. **主场景**（`scripts/main.gd`）：点选 → 路径判定 → 短暂连线 → 消除 → 得分/剩余牌数；`_process` 驱动倒计时；超时 `_trigger_time_up`；清空盘面 `_trigger_victory`。

## TypeScript 镜像

- `src/link_path.ts`、`src/board_layout_generator.ts`、`src/full_solvability.ts` 等与 Godot 侧算法对齐，供 `npm test`（Vitest）快速回归。
- `src/match_rules.ts` 中 `MATCH_TIME_SECONDS` 与 `scripts/main.gd` 的 `MATCH_TIME_SEC`、README 文案一致。

## 端口与 npm

| 脚本 | 作用 |
|------|------|
| `npm run dev` | `serve public`，默认 **http://localhost:3004** |
| `npm run build` | 校验关键 Godot 文件 + `tsc` |
| `npm run lint` | ESLint（`e2e/`、`playwright.config.ts`、`src/`） |
| `npm test` | Vitest（`src/**/*.test.ts`） |
| `npm run test:godot` | 调用本机 Godot 执行 `run_tests.gd` |
| `npm run test:e2e` | Playwright（启动 dev server） |

## 与需求留档的一致性

规则与范围以 [`requirements-archive.md`](./requirements-archive.md) 中用户问答为准；变更须**追加**说明，**勿删除**历史条目。
