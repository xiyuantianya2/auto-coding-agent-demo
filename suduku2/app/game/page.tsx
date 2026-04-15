import Link from "next/link";
import type { JSX } from "react";

import {
  Sudoku2EntryCard,
  Sudoku2EntryScreen,
  Sudoku2EntryStack,
  sudoku2EntryPrimaryCtaClass,
  sudoku2EntrySecondaryCtaClass,
  sudoku2EntryTextLinkClass,
} from "@/app/sudoku2-entry-shell";

export default function GamePage(): JSX.Element {
  return (
    <Sudoku2EntryScreen>
      <Sudoku2EntryStack>
        <Sudoku2EntryCard>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--s2-eyebrow)]">对局</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">选择模式</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--s2-text-muted)]">
            无尽模式从服务器题库选题并同步进度；专项练习请从教学大纲进入已解锁技巧。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Link
              href="/game/endless"
              className={sudoku2EntryPrimaryCtaClass}
              data-testid="game-goto-endless"
            >
              无尽模式
            </Link>
            <Link href="/tutorial" className={sudoku2EntrySecondaryCtaClass}>
              教学与专项
            </Link>
          </div>
          <p className="mt-8 text-center">
            <Link href="/" className={sudoku2EntryTextLinkClass}>
              返回首页
            </Link>
          </p>
        </Sudoku2EntryCard>
      </Sudoku2EntryStack>
    </Sudoku2EntryScreen>
  );
}
