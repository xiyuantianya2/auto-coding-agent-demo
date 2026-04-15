import { describe, expect, it, vi } from "vitest";

import {
  classifyFullscreenError,
  exitFullscreenFromDocument,
  getFullscreenChangeEventNames,
  getFullscreenElement,
  isFullscreenApiSupported,
  isTargetFullscreen,
  requestFullscreenOnElement,
} from "./fullscreen-dom";

function makeDoc(overrides: Partial<DocumentWithVendor> & { fullscreenElement?: Element | null } = {}) {
  const doc = {
    createElement: (tag: string) => {
      const el = {
        tagName: tag.toUpperCase(),
        requestFullscreen: undefined as (() => Promise<void>) | undefined,
        webkitRequestFullscreen: undefined as (() => void) | undefined,
      };
      return el;
    },
    documentElement: {} as HTMLElement,
    fullscreenElement: null as Element | null,
    exitFullscreen: undefined as (() => Promise<void>) | undefined,
    ...overrides,
  };
  return doc as unknown as Document;
}

type DocumentWithVendor = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

describe("fullscreen-dom", () => {
  it("getFullscreenElement 优先取标准字段并回退前缀", () => {
    const inner = { id: "x" } as unknown as Element;
    const doc = makeDoc({ fullscreenElement: inner });
    expect(getFullscreenElement(doc)).toBe(inner);

    const doc2 = makeDoc({
      fullscreenElement: null,
      webkitFullscreenElement: inner,
    } as Partial<DocumentWithVendor>);
    expect(getFullscreenElement(doc2)).toBe(inner);
  });

  it("isTargetFullscreen 仅在当前全屏节点为目标时为 true", () => {
    const a = { id: "a" } as unknown as Element;
    const b = { id: "b" } as unknown as Element;
    const doc = makeDoc({ fullscreenElement: a });
    expect(isTargetFullscreen(doc, a)).toBe(true);
    expect(isTargetFullscreen(doc, b)).toBe(false);
    expect(isTargetFullscreen(doc, null)).toBe(false);
  });

  it("isFullscreenApiSupported 在存在 requestFullscreen 时为 true", () => {
    const doc = makeDoc();
    vi.spyOn(doc, "createElement").mockReturnValue({
      requestFullscreen: () => Promise.resolve(),
    } as unknown as HTMLElement);
    expect(isFullscreenApiSupported(doc)).toBe(true);
  });

  it("isFullscreenApiSupported 在无任何实现时为 false", () => {
    const doc = makeDoc();
    vi.spyOn(doc, "createElement").mockReturnValue({} as unknown as HTMLElement);
    expect(isFullscreenApiSupported(doc)).toBe(false);
  });

  it("requestFullscreenOnElement 调用元素上的标准 API", async () => {
    const calls: string[] = [];
    const el = {
      requestFullscreen: () => {
        calls.push("fs");
        return Promise.resolve();
      },
    } as unknown as HTMLElement;
    await requestFullscreenOnElement(el);
    expect(calls).toEqual(["fs"]);
  });

  it("exitFullscreenFromDocument 调用 document.exitFullscreen", async () => {
    const calls: string[] = [];
    const doc = makeDoc({
      exitFullscreen: () => {
        calls.push("exit");
        return Promise.resolve();
      },
    } as Partial<Document>);
    await exitFullscreenFromDocument(doc as Document);
    expect(calls).toEqual(["exit"]);
  });

  it("getFullscreenChangeEventNames 包含标准与前缀事件名", () => {
    const names = getFullscreenChangeEventNames();
    expect(names).toContain("fullscreenchange");
    expect(names.length).toBeGreaterThanOrEqual(1);
  });

  it("classifyFullscreenError 映射常见 DOMException", () => {
    expect(classifyFullscreenError(new DOMException("x", "NotAllowedError"))).toBe("denied");
    expect(classifyFullscreenError(new DOMException("x", "NotSupportedError"))).toBe("not_supported");
    expect(classifyFullscreenError(new Error("x"))).toBe("unknown");
  });
});
