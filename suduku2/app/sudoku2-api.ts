/**
 * 数独2 客户端 HTTP API 基址与路径拼接约定（集中在此文件，避免硬编码散落）。
 *
 * ## 环境变量 `NEXT_PUBLIC_SUDUKU2_API_BASE`
 *
 * - **默认（未设置或空字符串）**：与当前站点 **同源**。Next.js 将业务 API 放在 `app/api/*` 时，使用
 *   `joinSudoku2ApiPath("", "/api/auth/login")` → `"/api/auth/login"`，由浏览器发往当前页面的 origin。
 * - **内网联调**：若静态资源与 JSON API 不在同一 origin（例如前端静态站 + 另一端口/主机上的 Node），在构建或 `.env.local` 中设为
 *   `http://<内网 IP 或主机名>:3003`（端口与 `package.json` 的 `dev` 脚本一致），则拼接结果为绝对 URL，可跨主机访问。
 *
 * ## 拼接规则
 *
 * - `apiBaseUrl` 会去掉末尾 `/`；`path` 必须以 `/` 开头（若缺省会补一个）。
 * - 不在此函数外手写 `` `${base}/api/...` ``，以便统一 trim 与将来代理前缀。
 */

/**
 * 与根布局中 `process.env.NEXT_PUBLIC_SUDUKU2_API_BASE ?? ""` 对齐的文档化默认值。
 */
export const DEFAULT_SUDOKU2_API_BASE_URL = "";

export function joinSudoku2ApiPath(apiBaseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const trimmedBase = apiBaseUrl.replace(/\/+$/, "");
  if (!trimmedBase) {
    return normalizedPath;
  }
  return `${trimmedBase}${normalizedPath}`;
}

/**
 * @internal 编译期确认 `@/` 路径别名与各 lib 模块入口可达（勿删；非运行时逻辑）。
 */
export type _Sudoku2AppPathAliasesVerified = {
  core: import("@/lib/core").GameState;
  solver: import("@/lib/solver").SolveStep;
  hint: import("@/lib/hint").HintResult;
  notes: import("@/lib/notes").NotesCommand;
  curriculum: import("@/content/curriculum").TechniqueModule;
  server: import("@/server").UserProgress;
};
