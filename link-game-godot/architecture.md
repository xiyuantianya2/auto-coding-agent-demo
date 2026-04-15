# 连连看-godot — 架构说明

## 项目概述

- **类型**：2D 连连看（**8×12** 网格、约 **8** 种图案各 **2** 枚；路径最多 **2** 个拐弯即不超过 **3** 段直线；**不可斜连**；可穿过已消除空位）。
- **平台**：Godot **4.x**，首版目标 **Windows 桌面** 与 **Android** 导出。
- **交互**：鼠标点选两格；**120 秒**限时；**提示**、**洗牌**；**无撤销**；通关后 **「再来一局」**。
- **美术**：彩色矩形占位 + 简单图标；**单局随机可解**；无关卡编辑器与存档。

## 技术栈

| 层级 | 说明 |
|------|------|
| 游戏运行时 | Godot 4.x（GDScript 为主） |
| 自动化测试（游戏内） | GUT 或自定义场景 + `godot --headless -s run_tests.gd`（`run_tests.gd` 为入口，脚手架阶段为占位） |
| 仓库一致性 / Web 冒烟 | Node.js + **Playwright**（针对 `npm run dev` 提供的静态占位或未来 HTML5 导出） |

## 目录结构（规划 + 当前）

```
link-game-godot/
├── project.godot          # Godot 项目入口
├── icon.svg
├── scenes/                # 场景（主菜单、对局等）
├── scripts/               # GDScript：规则、生成、路径判定、UI 控制
├── tests/                 # （后续）GUT 或场景级测试资源
├── run_tests.gd           # 无头测试入口（占位 → 扩展为真实套件）
├── public/                # npm dev 静态占位（Playwright 基线）
├── e2e/                   # Playwright 规范 (*.spec.ts)
├── scripts/verify-godot-project.mjs
├── package.json
├── playwright.config.ts
├── requirements-archive.md
├── task.json
└── README.md
```

## 核心模块（实现阶段）

1. **Board / Cell 模型**：`scripts/board_model.gd`（`BoardModel`）— **8×12**；`cells[r][c]` 为图案 `int` 或 `null`（已消除空位）。
2. **路径查找**：`scripts/link_path_finder.gd`（`LinkPathFinder.find_link_path`）— 四连通、**转弯 ≤2**（≤3 段直线）、**不斜连**；中间格须为空；棋盘外一圈 **padding 视为空**（与 `link-game/lib/game/connectivity.ts` 及 [`requirements-archive.md`](./requirements-archive.md) 问答一致）。返回 `ok`、`polyline`（简化折线顶点）、`bend_points`（中间折点，至多 2 个）。
3. **TypeScript 镜像（单元测试）**：`src/link_path.ts` 与 GDScript **同算法**，由 `npx vitest run src/link_path.test.ts` 覆盖边界与空位规则。
4. **可解布局生成**：随机 + 可解性校验或带保证的生成策略。
5. **对局流程**：选中、连线预览、消除、胜负；**计时器**；**提示 / 洗牌**。
6. **UI**：占位图块、HUD、结束弹窗与「再来一局」。
7. **测试**：路径与消除等**纯逻辑**优先单元化；场景测试覆盖选牌—判定—消除—胜负；CI 用 headless + `run_tests.gd`。

## 端口与 npm

- Playwright / `npm run dev` 使用 **3004**，与仓库内其他子项目错开。

## 与需求留档的一致性

实现以 [`requirements-archive.md`](./requirements-archive.md) 中用户问答为准；若变更规则，应**追加**说明，不删除历史条目。
