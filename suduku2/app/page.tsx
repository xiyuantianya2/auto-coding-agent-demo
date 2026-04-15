import Link from "next/link";
import { HomeSessionBar } from "@/app/home-session-bar";
import { HomeSettingsSection } from "@/app/home-settings-section";
import { joinSudoku2ApiPath } from "@/app/sudoku2-api";
import { GRID_SIZE } from "@/lib/core";

export default function Home() {
  const sampleApiPath = joinSudoku2ApiPath("", "/api/auth/login");

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[var(--s2-page-bg)] px-6 py-16 text-[var(--s2-text)]">
      <div className="max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--s2-eyebrow)]">
          suduku2
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          数独2
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--s2-text-muted)]">
          核心棋盘尺寸（契约常量）：{GRID_SIZE}×{GRID_SIZE}
        </p>
        <p className="mt-2 text-sm text-[var(--s2-text-subtle)]" data-testid="api-path-sample">
          API 路径示例（同源默认）：{sampleApiPath}
        </p>
        <div className="mt-6">
          <HomeSessionBar />
        </div>
        <nav
          aria-label="主导航"
          className="mt-10 flex flex-wrap justify-center gap-3 text-sm"
        >
          <Link
            className="rounded-[var(--s2-r-lg)] border border-[var(--s2-nav-border)] px-4 py-2 text-[var(--s2-text)] transition hover:border-[var(--s2-nav-hover-border)] hover:text-[var(--s2-nav-hover-text)]"
            href="/login"
          >
            登录
          </Link>
          <Link
            className="rounded-[var(--s2-r-lg)] border border-[var(--s2-nav-border)] px-4 py-2 text-[var(--s2-text)] transition hover:border-[var(--s2-nav-hover-border)] hover:text-[var(--s2-nav-hover-text)]"
            href="/tutorial"
          >
            教学
          </Link>
          <Link
            className="rounded-[var(--s2-r-lg)] border border-[var(--s2-nav-border)] px-4 py-2 text-[var(--s2-text)] transition hover:border-[var(--s2-nav-hover-border)] hover:text-[var(--s2-nav-hover-text)]"
            href="/game"
          >
            对局
          </Link>
          <Link
            className="rounded-[var(--s2-r-lg)] border border-[var(--s2-nav-border)] px-4 py-2 text-[var(--s2-text)] transition hover:border-[var(--s2-nav-hover-border)] hover:text-[var(--s2-nav-hover-text)]"
            href="/game/endless"
          >
            无尽
          </Link>
        </nav>

        <HomeSettingsSection />
      </div>
    </div>
  );
}
