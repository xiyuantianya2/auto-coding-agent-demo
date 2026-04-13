/** 浏览器端：将 API 中的时间以北京时间展示（兼容旧 ISO 与新版服务端北京时间串） */

const TZ = "Asia/Shanghai";

function intlBeijing() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/** 提示词/CLI 元数据中的时间：若为 ISO 则转为北京时间显示 */
export function formatApiTimeForDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return intlBeijing().format(d);
  }
  return s;
}

/** 运行日志：将行首 ISO 时间戳改为北京时间（服务端新日志已是北京时可不变） */
export function rewriteRecentLogLinesToBeijing(text: string): string {
  if (!text) return "";
  return text.replace(/\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]/g, (match, iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return match;
    return `[${intlBeijing().format(d)}]`;
  });
}
