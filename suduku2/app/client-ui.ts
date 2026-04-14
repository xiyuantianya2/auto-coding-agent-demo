/**
 * **client-ui** 模块对外边界（与 `module-plan.json` 中 `client-ui.interface` 对齐的入口之一）。
 *
 * 推荐自 `@/app/client-ui` 引用 Provider 与 API 拼接工具，避免深路径耦合。
 */

export {
  Sudoku2AppProviders,
  useSudoku2ApiBase,
} from "./sudoku2-app-providers";

export {
  DEFAULT_SUDOKU2_API_BASE_URL,
  joinSudoku2ApiPath,
} from "./sudoku2-api";
