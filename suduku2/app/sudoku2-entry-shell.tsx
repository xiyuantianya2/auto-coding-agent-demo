import type { JSX, ReactNode } from "react";

/** 全屏入口页外层：与根布局 `main` 配合铺满视口，背景与对局外区一致 */
export function Sudoku2EntryScreen(props: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  const { children, className = "" } = props;
  return (
    <div
      className={`flex min-h-full flex-1 flex-col bg-[var(--s2-page-bg)] text-[var(--s2-text)] ${className}`}
    >
      {children}
    </div>
  );
}

/** 内容区水平约束：与教学大纲、无尽难度页同一套 max-width / 安全区内边距 */
export function Sudoku2EntryStack(props: {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}): JSX.Element {
  const { children, className = "", "data-testid": dataTestId } = props;
  return (
    <div
      className={`mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 md:py-12 [@media(min-width:768px)_and_(orientation:landscape)]:max-w-5xl ${className}`}
      data-testid={dataTestId}
    >
      {children}
    </div>
  );
}

/** 顶部品牌/标题条：与对局中 accent 说明卡同一令牌 */
export function Sudoku2EntryHeroPanel(props: { children: ReactNode }): JSX.Element {
  const { children } = props;
  return (
    <div className="rounded-[var(--s2-r-2xl)] border border-[var(--s2-accent-panel-border)] bg-[var(--s2-accent-panel-bg)] px-5 py-6 text-center shadow-sm sm:px-8 sm:py-8">
      {children}
    </div>
  );
}

/** 白底内容卡：与登录表单卡片、设置区层级一致 */
export function Sudoku2EntryCard(props: { children: ReactNode }): JSX.Element {
  const { children } = props;
  return (
    <div className="rounded-[var(--s2-r-2xl)] border border-[var(--s2-border)] bg-[var(--s2-card)] p-6 shadow-sm sm:p-8">
      {children}
    </div>
  );
}

/** 会话条、次要信息：贴近盘面侧栏 `card-muted` 与 ring 层级 */
export function Sudoku2EntryMutedPanel(props: { children: ReactNode }): JSX.Element {
  const { children } = props;
  return (
    <div className="rounded-[var(--s2-r-xl)] border border-[var(--s2-border)] bg-[var(--s2-card-muted)] px-4 py-4 ring-1 ring-[var(--s2-btn-secondary-ring)] sm:px-5 sm:py-5">
      {children}
    </div>
  );
}

export const sudoku2EntryNavLinkClass =
  "inline-flex min-h-[var(--s2-touch-min)] min-w-[5.5rem] touch-manipulation items-center justify-center rounded-[var(--s2-r-lg)] border border-[var(--s2-nav-border)] px-4 text-sm font-semibold text-[var(--s2-text)] transition hover:border-[var(--s2-nav-hover-border)] hover:text-[var(--s2-nav-hover-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s2-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s2-page-bg)]";

export const sudoku2EntryPrimaryCtaClass =
  "inline-flex min-h-[var(--s2-touch-min)] touch-manipulation items-center justify-center rounded-[var(--s2-r-lg)] bg-[var(--s2-accent)] px-6 text-sm font-semibold text-[var(--s2-on-accent)] transition hover:bg-[var(--s2-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s2-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s2-card)]";

export const sudoku2EntrySecondaryCtaClass =
  "inline-flex min-h-[var(--s2-touch-min)] touch-manipulation items-center justify-center rounded-[var(--s2-r-lg)] bg-[var(--s2-btn-secondary-bg)] px-6 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] transition hover:bg-[var(--s2-btn-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s2-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s2-card)]";

export const sudoku2EntryTextLinkClass =
  "text-sm font-medium text-[var(--s2-link)] underline-offset-4 transition hover:text-[var(--s2-link-hover)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s2-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--s2-page-bg)] rounded-sm";
