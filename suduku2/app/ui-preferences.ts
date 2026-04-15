/**
 * 外观偏好：本地缓存键与 `UserProgress.settings` 字段对齐（见 `Sudoku2ThemeProvider`）。
 */

export type ThemePreference = "light" | "dark" | "system";

export const SUDOKU2_THEME_STORAGE_KEY = "suduku2.ui.theme";
export const SUDOKU2_HC_CANDIDATES_STORAGE_KEY = "suduku2.ui.highContrastCandidates";
/** 「快速游戏」：单候选空格点击自动填数；`"1"` 表示开启（默认未设置即关闭）。 */
export const SUDOKU2_QUICK_GAME_STORAGE_KEY = "suduku2.ui.quickGame";

export const SETTINGS_THEME_KEY = "theme";
export const SETTINGS_HC_CANDIDATES_KEY = "highContrastCandidates";

/** 内联于根布局，在首帧绘制前执行，避免主题与候选高对比偏好闪烁。 */
export const UI_PREFERENCES_BOOTSTRAP_SCRIPT = `(function(){
try{
var d=document.documentElement;
var t=localStorage.getItem(${JSON.stringify(SUDOKU2_THEME_STORAGE_KEY)});
var pref=(t==="light"||t==="dark"||t==="system")?t:"system";
var dark=pref==="dark"||(pref==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
if(dark)d.classList.add("dark");else d.classList.remove("dark");
var hc=localStorage.getItem(${JSON.stringify(SUDOKU2_HC_CANDIDATES_STORAGE_KEY)})==="1";
if(hc)d.classList.add("hc-candidates");else d.classList.remove("hc-candidates");
d.dataset.themeResolved=dark?"dark":"light";
d.dataset.hcCandidates=hc?"on":"off";
}catch(e){}
})();`;

export function parseThemePreference(raw: unknown): ThemePreference | null {
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return null;
}

export function parseHighContrast(raw: unknown): boolean | null {
  if (typeof raw === "boolean") {
    return raw;
  }
  return null;
}
