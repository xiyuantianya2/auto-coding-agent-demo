# 对对碰（duiduipeng）— 架构说明

## 项目概述

「对对碰」是本仓库内与「连连看」并列的**单机网页**益智游戏子项目：玩家在固定步数内达成目标分数；核心机制为**相邻交换**且**仅当能触发三消（含连锁）时步数才生效**，配合**重力下落与补位**直至盘面稳定；**已移除**旧版「未形成三消时两格同色对碰合并」玩法。关卡无限递进、目标分随关卡升高。

## 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 框架 | **Next.js 16**（App Router） | 与 `link-game/` 一致，便于 UI 风格对齐 |
| 语言 | **TypeScript** | 严格模式 |
| UI | **React 19** + **Tailwind CSS 4** | 工具类与 `link-game` 的 `globals.css` 变量对齐 |
| 工具 | `clsx` + `tailwind-merge` | 条件 class 合并 |
| 测试 | **Vitest**（`lib/**/*.test.ts`）+ **Playwright**（`e2e/`） | 单元测试 + 浏览器 E2E |

开发服务器默认端口 **3001**（`package.json` 中 `next dev -p 3001`），避免与本仓库 `link-game` 默认 **3000** 冲突。

## 目录结构（与代码一致）

```
duiduipeng/
├── app/
│   ├── layout.tsx          # 根布局（字体、背景、metadata）
│   ├── page.tsx            # 首页：说明 + 游戏主区域锚点
│   └── globals.css         # Tailwind 与 CSS 变量（与连连看一致）
├── components/
│   └── SwapPlayground.tsx  # 客户端：棋盘、HUD、暂停/提示、胜负 overlay
├── lib/                    # 纯逻辑与类型（平铺，无 lib/game 子目录）
│   ├── board-types.ts      # 网格与符号枚举
│   ├── create-initial-board.ts
│   ├── level-progression.ts
│   ├── match-clear.ts
│   ├── stabilization.ts    # 消除、下落、补位、连锁稳定化
│   ├── swap-input.ts       # 选格与交换状态机
│   ├── swap-legality.ts
│   ├── swap-types.ts
│   ├── seeded-random.ts
│   ├── utils.ts
│   ├── index.ts
│   └── *.test.ts           # Vitest 用例
├── e2e/                    # Playwright E2E 测试
├── task.json               # 功能任务与验收步骤
├── architecture.md         # 本文件
├── playwright.config.ts    # Playwright 配置（端口 3001）
├── vitest.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
├── postcss.config.mjs
└── eslint.config.mjs
```

## 核心模块（已实现方向）

1. **棋盘与符号模型** — `board-types.ts`、`create-initial-board.ts`
2. **输入与交换** — `swap-input.ts`、`swap-legality.ts`
3. **匹配、消除、重力、连锁稳定化** — `match-clear.ts`、`stabilization.ts`（稳定化管线仅三消，无相邻两格合并分支）
4. **关卡与胜负** — `level-progression.ts`；UI 层 `SwapPlayground.tsx`
5. **暂停与提示** — `SwapPlayground.tsx`

## 关卡与计分（与实现一致）

- **计分常量**：`BASE_SCORE_PER_CELL`（每格基础分）与 `CHAIN_BONUS_PER_EXTRA_WAVE`（连锁波次加成，见 `lib/stabilization.ts`）定义于实现中；游戏内「游戏说明」对话框从同一常量渲染，避免文案与代码漂移。无单独「对碰合并」得分项。
- **前期关卡表**（`EARLY_GAME_LEVEL_CONFIG`，`lib/level-progression.ts`）：索引 0～5 单独配置目标分与步数；第 6 关起由第 5 关锚点按 `DEFAULT_LEVEL_PROGRESSION` 线性延伸，保证目标分严格递增、步数不减。

| 关卡（显示） | levelIndex | 目标分 | 步数上限 |
|-------------|------------|--------|----------|
| 第 1 关 | 0 | 2 500 | 22 |
| 第 2 关 | 1 | 2 900 | 24 |
| 第 3 关 | 2 | 3 300 | 26 |
| 第 4 关 | 3 | 3 700 | 28 |
| 第 5 关 | 4 | 4 100 | 28 |
| 第 6 关 | 5 | 4 500 | 30 |

第 7 关起：`targetScore = 4 500 + (levelIndex − 5) × 450`，`moves = 30 + (levelIndex − 5) × 2`（与 `getLevelConfigForIndex` 一致）。

## 与连连看（link-game）的对齐与差异

| 维度 | 连连看 `link-game/` | 对对碰 `duiduipeng/` |
|------|---------------------|----------------------|
| **默认开发端口** | 3000 | **3001** |
| **玩法** | 路径连接消对 | **纯三消（合法交换须触发三消）+ 步数/目标分** |
| **工程** | 同 major 的 Next/React/ESLint/Tailwind | 同上 |
| **视觉** | zinc 底、emerald 强调 | 同源风格（见 `app/layout.tsx`、`globals.css`） |
| **浏览器 E2E** | Playwright（`e2e/`，端口 3000） | Playwright（`e2e/`，端口 **3001**），浏览器二进制与 `link-game` 共享 |

运行方式均为：在各自子目录执行 `npm run dev`，浏览器本地自玩。

## 验收与脚本

- 开发：`npm run dev`（端口 3001）
- 质量：`npm run lint`、`npm run build`
- 单元测试：`npm test`（Vitest）
- E2E 测试：`npm run test:e2e`（Playwright，headed 浏览器，自动启动 dev server）

## 后续可选扩展（非当前范围）

- 从仓库根或 `link-game` 入口页链到 `http://localhost:3001` 的导航说明
