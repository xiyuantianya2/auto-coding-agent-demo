/** 北京时间（Asia/Shanghai），用于 Web 面板与日志展示 */

export const TZ_BEIJING = "Asia/Shanghai";

/**
 * @param {Date | number | string | undefined | null} [when]
 * @returns {string} 如 2026/4/13 22:30:45（locale 数字格式，时区为北京）
 */
export function formatBeijingDateTime(when) {
  const d =
    when === undefined || when === null
      ? new Date()
      : when instanceof Date
        ? when
        : new Date(when);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: TZ_BEIJING,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * @param {Date | number | string} [when]
 * @returns {string} YYYY-MM-DD（北京时间日历日）
 */
export function formatBeijingDateOnly(when) {
  const d = when === undefined || when === null ? new Date() : when instanceof Date ? when : new Date(when);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_BEIJING,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
