# 连连看（Link Game）— Coding Agent 指南

> 参考：[Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

## 你应该用哪份说明？

| 场景 | 使用的文件 |
|------|------------|
| **首轮**：新项目、或刚清空应用准备重写任务清单与环境 | **`INITIALIZER.md`**（不要用本文件做主流程） |
| **第二轮及以后**：任务清单与 `init.sh` 已就绪 | **本文件 `CLAUDE.md`** |

---

## Project Context

网页连连看游戏，前端在 `link-game/`（Next.js + TypeScript + Tailwind）。
需求在 **`task.json`**（feature list）；进度在 **`progress.txt`**。

---

## MANDATORY: Coding Session Workflow

**每个 coding 会话**都按下面流程执行。一个会话只做**一个任务**。

### Step 1: 会话开场（快速对齐上下文）

按 1→6 顺序执行，**不要跳过任何步骤**：

1. **`pwd`** — 确认当前目录为仓库根。
2. **读取 `progress.txt`** — 了解最近做了什么、是否有遗留问题。
3. **读取 `task.json`** — 通读任务与 `passes` 状态（仅同步上下文，不要开始写代码）。
4. **`git log --oneline -20`** — 查看最近提交。
5. **阅读并执行 `./init.sh`** — 安装依赖、启动 dev server（默认 http://localhost:3000）。
6. **基线冒烟** — 验证已有功能可用（开发服务可达、首页可加载）。项目早期至少确认 dev server 启动成功即可。

**硬性规则：基线确认前不得开始实现新功能。**

完成 1–6 后，**立即进入 Step 2**（不要停下来等确认、不要输出报告后等待用户指令）。

### Step 2: 选择任务

从 `task.json` 中选一条 `passes: false` 的最高优先级任务。

### Step 3: 实现

- 读任务描述和验收步骤
- 实现功能，遵循已有代码风格

### Step 4: 测试

1. `npm run lint` 无错误
2. `npm run build` 成功
3. UI 相关修改须在浏览器验证

### Step 5: 更新进度

在 `progress.txt` 顶部添加：

```
## [日期] - Task: [任务描述]

### What was done:
- [具体修改]

### Testing:
- [如何测试的]

### Notes:
- [给后续 agent 的说明]
```

### Step 6: 提交

1. 更新 `task.json`：将该任务 `passes` 改为 `true`
2. 一次性提交：

```bash
git add .
git commit -m "[task description] - completed"
```

**规则：**
- 只有所有测试通过后才标记 `passes: true`
- 永远不要删除或修改任务描述
- 一个 task 的所有变更（代码、progress.txt、task.json）在同一个 commit

---

## ⚠️ 阻塞处理

如果任务无法完成（缺环境配置、外部依赖不可用等）：

**禁止：** 提交 commit、标记 passes:true、假装完成

**必须：** 在 progress.txt 记录阻塞原因 → 输出阻塞信息 → 停止

---

## Project Structure

```
/
├── CLAUDE.md          # 本文件
├── INITIALIZER.md     # 首轮初始化用
├── task.json          # 任务定义（唯一真相源）
├── progress.txt       # 每次会话的进度日志
├── init.sh            # 开发环境初始化脚本
├── architecture.md    # 连连看架构说明
└── link-game/         # Next.js 应用
    ├── app/           # App Router 页面
    ├── lib/           # 工具函数、游戏逻辑
    └── components/    # UI 组件（渐进补齐）
```

## Commands

```bash
# 在 link-game/ 目录下
npm run dev      # 启动开发服务器
npm run build    # 生产构建
npm run lint     # 运行 linter
```

## Key Rules

1. **会话开场先执行** — 基线未确认前不开始新功能
2. **一个会话一个任务** — 做好一件事
3. **测试后才标记完成** — lint + build + 浏览器验证
4. **记录进度** — progress.txt 帮助后续 agent 理解上下文
5. **一个 commit 一个 task** — 代码、进度、标记一起提交
6. **不要删任务** — 只能把 `passes: false` 改成 `true`
7. **阻塞时停止** — 不要假装完成
