# 全自动开发面板（Cursor Agent CLI）

参考 `curriculum-cursor-check`：在**仓库根目录**（默认 `tools/auto-coding-agent` 上两级）按 `task.json` 中 **`passes: false`** 的任务顺序，依次调用 Cursor Agent CLI（`agent -p -f --trust --workspace <repo>`）。

## 前置

1. 安装 Cursor Agent CLI（Windows 示例）：

   ```powershell
   irm 'https://cursor.com/install?win32=true' | iex
   ```

2. 执行 `agent login`。

3. 建议使用 **Node 20 或 22 LTS**（部分环境下 Node 24+ 与 Agent CLI 不兼容）。

## 启动

在仓库根目录或本目录：

```powershell
cd D:\dev\auto-coding\tools\auto-coding-agent
npm start
```

浏览器打开终端提示的地址（默认 `http://127.0.0.1:3910/`），点击 **开始全自动**。页面上「提示词 / CLI 输出 / 运行日志」三个区域各有 **复制全文**；单行数超过 **500** 时面板仅展示**末尾 500 行**，复制仍为完整内容。

`link-game` 前端「开发面板」入口会指向该地址（可通过环境变量修改）。

## 环境变量

| 变量 | 含义 |
|------|------|
| `AUTO_CODING_REPO_ROOT` | 仓库根目录绝对路径；默认为本工具上两级目录。 |
| `PORT` | HTTP 端口，默认 `3910`。 |
| `HOST` | 监听地址，默认 `127.0.0.1`。 |
| `AUTOCODING_AGENT_TIMEOUT_MS` | 单次 Agent 超时（毫秒），默认 **90 分钟**（大型项目含 Playwright 时仍可提高，例如 `7200000` 为 2 小时）。 |
| `AUTOCODING_AGENT_MODEL` | 传给 `agent --model`。**未设置或空字符串时默认使用 `auto`**（与 IDE「Auto」一致）。若某环境报错，可设为 `omit`（不传 `--model`，CLI 可能回退为 `composer-2-fast` 等）。其它值则原样作为模型名。 |
| `AUTOCODING_APPROVE_MCPS` | 默认 **`1`/未设置即开启**：为 `agent` 追加 **`--approve-mcps`**，全自动运行时自动批准 MCP，避免浏览器类 MCP 卡住等人点「允许」。若你的 CLI 版本不支持该参数，设为 `0` 或 `false` 关闭。 |
| `AUTOCODING_PASS_POLL_ATTEMPTS` / `AUTOCODING_PASS_POLL_MS` | Agent 返回 0 后，轮询根目录 `task.json` 是否已把当前任务标为 `passes: true`（默认约 8 次 × 250ms）。 |
| `AUTOCODING_AGENT_CLI_MAX_CHARS` | 单任务 CLI 输出在内存中保留的最大字符数（默认约 90 万），超出会截断尾部保留。 |
| `AUTOCODING_TRUST_ZERO_EXIT` | 设为 `1` 时：若 Agent 退出码为 0 但 `passes` 仍未变，**仍视为本步成功**（仅当你确认实现已完成、仅漏改 JSON 时使用）。 |
| `AUTOCODING_AGENT_IDLE_TIMEOUT_MS` | Agent **无新 CLI 输出**超时（毫秒），默认 **30 分钟**。长时间跑 Playwright 若终端几乎无输出，可能被此项先于「单次 Agent 超时」终止，请按需提高或与单次任务耗时对齐。设为 `0` 禁用。 |
| `CURSOR_CLI` | 自定义 `agent` 可执行文件路径。 |
| `AUTOCODING_USE_CURSOR_EXE_FALLBACK` | Windows 下 `agent` 失败后再试 `Cursor.exe`（会启动图形界面）。 |

## 模块化开发（大型项目）

对于预计超过 30 个任务的大型项目（如功能完善的数独游戏），建议使用**模块化开发**模式。该模式在现有的「INITIALIZER → CLAUDE 循环」之间增加了一个**模块分解层**：

```
第 0 层：项目规划（人工 + AI）   →  architecture.md
第 1 层：模块分解（新增）         →  module-plan.json（模块列表 + 依赖 + 接口）
第 2 层：任务执行（现有）         →  每个模块独立的 task.json → 逐任务 CLAUDE 循环
```

### 使用方式

1. 在面板的「新增/重构功能」输入框中**描述项目全貌**
2. 点击 **「模块化开发（大型项目）」** 按钮
3. 系统自动：
   - 调用 Agent 将项目分解为 4-10 个独立模块（生成 `module-plan.json`）
   - 按依赖拓扑序，为每个模块生成独立的 task.json
   - 逐模块、逐任务自动执行开发

### 模块计划文件

`module-plan.json` 与项目的 `task.json` 同目录，结构如下：

```json
{
  "project": "项目名",
  "description": "项目描述",
  "modules": [
    {
      "id": "solver",
      "title": "求解器",
      "description": "模块职责描述",
      "dir": "lib/solver",
      "dependencies": [],
      "interface": "solve(puzzle) -> solution | null",
      "status": "pending"
    }
  ]
}
```

每个模块的任务文件存储在 `modules/{moduleId}.task.json`（相对于 task.json 所在目录）。

### 模块相关 API

| action（POST /api/control） | 说明 |
|-----|------|
| `module-decompose` | 分解项目为模块（需 `prompt` 字段） |
| `module-start` | 继续模块化执行（module-plan.json 已存在时） |
| `module-reset` | 将所有模块状态重置为 pending |
| `module-reset-one` | 重置单个模块（需 `moduleId` 字段）；默认同时重置该模块 task.json 中所有任务的 passes 为 false，传 `resetTasks: false` 仅重置模块状态 |

### 与常规开发的区别

| | 常规开发 | 模块化开发 |
|---|---------|----------|
| 适用规模 | < 30 任务 | 30+ 任务 |
| 任务文件 | 单个 task.json | 每模块独立 task.json |
| 规划时机 | 一次性全量规划 | 按需延迟规划（每个模块开始前） |
| 上下文负担 | 全部任务在一个文件 | 每次只关注一个模块的 3-10 个任务 |
| 模块边界 | 无 | 通过 interface 定义模块间接口 |

## 浏览器 MCP（自动化验收）

面板调起的 `agent` 默认带 **`--approve-mcps`**，以便在**无交互**下使用已配置的 MCP。要让 Agent 能**自动打开页面做 UI 验证**，还需在本机配置至少一种 **浏览器类 MCP**（例如在 Cursor / `~/.cursor/mcp.json` 中配置 Playwright MCP，或使用 Cursor 自带的 `cursor-ide-browser` 等）。配置完成后可在终端执行 `agent mcp list` 确认已加载；必要时 `agent mcp enable <identifier>`。

状态文件：`<repo>/.auto-coding-agent/state.json`（建议勿提交）。

**为何重启后面板显示「已暂停」？** 若上次结束时 `state.json` 仍为「运行中」（例如直接关终端、进程崩溃），**下次启动本服务时会自动改为「已暂停」**：新进程里并没有上一轮的 agent 子进程可接续，并非你点了暂停。再点「开始全自动」即可。

**为何「CLI 实时输出」闪一下又变成「尚无输出」？** 旧逻辑在每个新任务开始时**清空**缓冲区，下一任务的 agent 尚未打印时，面板会短暂空白。现已改为在**同一次面板服务进程内**跨任务**累积**输出（带任务分隔线），总长度仍受 `AUTOCODING_AGENT_CLI_MAX_CHARS` 限制；点「重置状态」会清空。
