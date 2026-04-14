# 数独 — 架构说明

## 概述

局域网浏览器端数独应用：含低/中/高阶技巧教学与专项无尽练习、四档难度无尽关卡、唯一解生成与难度打分、高亮式提示与完整笔记能力；用户注册登录后按账号将进度持久化到本地 JSON。

技术栈：Next.js 16 + TypeScript + Tailwind CSS 4，端口 3002。

## 开发模式

本项目采用**模块化开发**：

- `module-plan.json` 定义 9 个模块的拓扑依赖
- 每个模块在 `modules/<module-id>.task.json` 有独立的任务列表
- 自动化面板按拓扑序依次初始化并执行每个模块
- 非 UI 模块仅通过 Vitest 单元/集成测试验收
- UI 模块及最终集成需 Playwright E2E 验收

## 目录结构

```
suduku/
├── app/                    # Next.js App Router（client-ui 模块）
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── core/               # core-model：类型、规则、序列化
│   ├── solver/              # solver-engine：候选数、技巧识别、难度评分
│   ├── generator/           # puzzle-generator：唯一解题目生成
│   ├── hint/                # hint-system：下一步高亮提示
│   └── notes/               # notes-logic：笔记、撤销、模式切换
├── content/
│   └── curriculum/          # tutorial-curriculum：教学大纲数据
├── server/                  # server-api：HTTP API、账号、JSON 持久化
├── e2e/                     # Playwright E2E 测试
├── modules/                 # 各模块独立 task.json
├── module-plan.json         # 模块拓扑定义
├── task.json                # 项目级 task（模块化模式下为空）
├── vitest.config.ts
├── playwright.config.ts
├── package.json
└── tsconfig.json
```

## 模块依赖拓扑

```
core-model (无依赖)
├── solver-engine
│   ├── puzzle-generator
│   │   └── server-api
│   ├── hint-system
│   └── notes-logic
├── tutorial-curriculum
└── client-ui (依赖以上全部)
    └── integration-qa (依赖以上全部)
```

## 关键设计决策

### 性能优先于最优性

- 题目生成不追求最少提示数（17 个），保留适量冗余提示以保证唯一解且加速生成
- 单次生成/求解应在 5 秒内完成
- 高难度档位的测试仅做结构冒烟，避免测试超时

### 路径别名

通过 `@/` 引用项目根目录，例如 `import { isValidPlacement } from "@/lib/core"`.

### 测试策略

- `lib/` 下的纯逻辑模块：Vitest 单元/集成测试
- `app/` UI 模块：Playwright E2E（headed 模式，端口 3002）
- 测试文件：`lib/**/*.test.ts`、`content/**/*.test.ts`、`server/**/*.test.ts`

## 端口

| 用途 | 端口 |
|------|------|
| Next.js dev server | 3002 |
| 自动化面板 | 3910 |
