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

浏览器打开终端提示的地址（默认 `http://127.0.0.1:3910/`），点击 **开始全自动**。

`link-game` 前端「开发面板」入口会指向该地址（可通过环境变量修改）。

## 环境变量

| 变量 | 含义 |
|------|------|
| `AUTO_CODING_REPO_ROOT` | 仓库根目录绝对路径；默认为本工具上两级目录。 |
| `PORT` | HTTP 端口，默认 `3910`。 |
| `HOST` | 监听地址，默认 `127.0.0.1`。 |
| `AUTOCODING_AGENT_TIMEOUT_MS` | 单次 Agent 超时（毫秒），默认 45 分钟。 |
| `AUTOCODING_AGENT_MODEL` | 传给 `agent --model`；留空则不传（用 CLI 默认）。 |
| `AUTOCODING_PASS_POLL_ATTEMPTS` / `AUTOCODING_PASS_POLL_MS` | Agent 返回 0 后，轮询根目录 `task.json` 是否已把当前任务标为 `passes: true`（默认约 8 次 × 250ms）。 |
| `AUTOCODING_TRUST_ZERO_EXIT` | 设为 `1` 时：若 Agent 退出码为 0 但 `passes` 仍未变，**仍视为本步成功**（仅当你确认实现已完成、仅漏改 JSON 时使用）。 |
| `CURSOR_CLI` | 自定义 `agent` 可执行文件路径。 |
| `AUTOCODING_USE_CURSOR_EXE_FALLBACK` | Windows 下 `agent` 失败后再试 `Cursor.exe`（会启动图形界面）。 |

状态文件：`<repo>/.auto-coding-agent/state.json`（建议勿提交）。
