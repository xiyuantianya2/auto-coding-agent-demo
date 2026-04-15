import Link from "next/link";

import { HomeSessionBar } from "@/app/home-session-bar";
import { HomeSettingsSection } from "@/app/home-settings-section";
import { joinSudoku2ApiPath } from "@/app/sudoku2-api";
import {
  Sudoku2EntryHeroPanel,
  Sudoku2EntryMutedPanel,
  Sudoku2EntryScreen,
  Sudoku2EntryStack,
  sudoku2EntryNavLinkClass,
} from "@/app/sudoku2-entry-shell";
import { GRID_SIZE } from "@/lib/core";

export default function Home() {
  const sampleApiPath = joinSudoku2ApiPath("", "/api/auth/login");

  return (
    <Sudoku2EntryScreen>
      <Sudoku2EntryStack className="max-w-2xl">
        <Sudoku2EntryHeroPanel>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--s2-accent-panel-muted)]">
            suduku2
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--s2-accent-panel-fg)] sm:text-4xl">
            数独2
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[var(--s2-accent-panel-muted)]">
            核心棋盘尺寸（契约常量）：{GRID_SIZE}×{GRID_SIZE}
          </p>
          <p
            className="mt-2 text-sm text-[var(--s2-accent-panel-muted)] opacity-90"
            data-testid="api-path-sample"
          >
            API 路径示例（同源默认）：{sampleApiPath}
          </p>
        </Sudoku2EntryHeroPanel>

        <div className="mt-6">
          <Sudoku2EntryMutedPanel>
            <HomeSessionBar />
          </Sudoku2EntryMutedPanel>
        </div>

        <nav
          aria-label="主导航"
          className="mt-8 flex flex-wrap justify-center gap-3 sm:gap-4"
        >
          <Link className={sudoku2EntryNavLinkClass} href="/login">
            登录
          </Link>
          <Link className={sudoku2EntryNavLinkClass} href="/tutorial">
            教学
          </Link>
          <Link className={sudoku2EntryNavLinkClass} href="/game">
            对局
          </Link>
          <Link className={sudoku2EntryNavLinkClass} href="/game/endless">
            无尽
          </Link>
        </nav>

        <HomeSettingsSection />
      </Sudoku2EntryStack>
    </Sudoku2EntryScreen>
  );
}
