/**
 * Fullscreen API 跨浏览器封装（无 React 依赖，便于单测）。
 * 单次调用失败即结束，不做重试或轮询。
 */

export type FullscreenFailureKind =
  | "not_supported"
  | "no_element"
  | "denied"
  | "unknown";

export type FullscreenActionResult =
  | { ok: true }
  | { ok: false; kind: FullscreenFailureKind; message?: string };

type HTMLElementWithVendor = HTMLElement & {
  webkitRequestFullscreen?: (allowKeyboardInput?: number) => void | Promise<void>;
  mozRequestFullScreen?: () => void | Promise<void>;
  msRequestFullscreen?: () => void | Promise<void>;
};

type DocumentWithVendor = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void | Promise<void>;
  mozCancelFullScreen?: () => void | Promise<void>;
  msExitFullscreen?: () => void | Promise<void>;
};

/** 与 document.fullscreenElement 及常见前缀字段对齐的当前全屏节点 */
export function getFullscreenElement(doc: Document): Element | null {
  const d = doc as DocumentWithVendor;
  return (
    doc.fullscreenElement ??
    d.webkitFullscreenElement ??
    d.mozFullScreenElement ??
    d.msFullscreenElement ??
    null
  );
}

/** 当前全屏节点是否为指定目标（用于多组件场景下只认自己的容器） */
export function isTargetFullscreen(doc: Document, target: Element | null): boolean {
  if (!target) return false;
  return getFullscreenElement(doc) === target;
}

function getRequestFullscreenFn(el: HTMLElement): (() => void | Promise<void>) | null {
  const e = el as HTMLElementWithVendor;
  if (typeof el.requestFullscreen === "function") {
    return () => el.requestFullscreen();
  }
  if (typeof e.webkitRequestFullscreen === "function") {
    /** Safari 旧版 webkit 需传入键盘参数；`1` 与 `Element.ALLOW_KEYBOARD_INPUT` 同义 */
    const allowKeyboard =
      typeof Element !== "undefined" && "ALLOW_KEYBOARD_INPUT" in Element
        ? (Element as unknown as { ALLOW_KEYBOARD_INPUT: number }).ALLOW_KEYBOARD_INPUT
        : 1;
    return () => e.webkitRequestFullscreen!(allowKeyboard);
  }
  if (typeof e.mozRequestFullScreen === "function") {
    return () => e.mozRequestFullScreen!();
  }
  if (typeof e.msRequestFullscreen === "function") {
    return () => e.msRequestFullscreen!();
  }
  return null;
}

/** 探测当前环境是否具备任一可用的 requestFullscreen 变体 */
export function isFullscreenApiSupported(doc: Document): boolean {
  const probe = doc.createElement("div");
  return getRequestFullscreenFn(probe) !== null;
}

function getExitFullscreenFn(doc: Document): (() => void | Promise<void>) | null {
  const d = doc as DocumentWithVendor;
  if (typeof doc.exitFullscreen === "function") {
    return () => doc.exitFullscreen();
  }
  if (typeof d.webkitExitFullscreen === "function") {
    return () => d.webkitExitFullscreen!();
  }
  if (typeof d.mozCancelFullScreen === "function") {
    return () => d.mozCancelFullScreen!();
  }
  if (typeof d.msExitFullscreen === "function") {
    return () => d.msExitFullscreen!();
  }
  return null;
}

export async function requestFullscreenOnElement(el: HTMLElement): Promise<void> {
  const fn = getRequestFullscreenFn(el);
  if (!fn) {
    throw new DOMException("Fullscreen API not supported", "NotSupportedError");
  }
  await Promise.resolve(fn());
}

export async function exitFullscreenFromDocument(doc: Document): Promise<void> {
  const fn = getExitFullscreenFn(doc);
  if (!fn) {
    throw new DOMException("Fullscreen exit not supported", "NotSupportedError");
  }
  await Promise.resolve(fn());
}

/** document 上需监听的 fullscreenchange 事件名（含前缀） */
export function getFullscreenChangeEventNames(): readonly string[] {
  return ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
}

export function classifyFullscreenError(error: unknown): FullscreenFailureKind {
  if (error instanceof DOMException) {
    if (error.name === "NotSupportedError") return "not_supported";
    if (error.name === "NotAllowedError") return "denied";
  }
  if (error instanceof Error) {
    if (error.name === "NotAllowedError") return "denied";
    if (error.name === "TypeError") return "denied";
  }
  return "unknown";
}
