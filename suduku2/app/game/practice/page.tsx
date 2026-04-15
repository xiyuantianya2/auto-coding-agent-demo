"use client";

import { Suspense, type JSX } from "react";
import { useSearchParams } from "next/navigation";

import { PracticeModeView } from "@/app/game/practice/practice-mode-view";
import { Sudoku2EntryScreen, Sudoku2EntryStack } from "@/app/sudoku2-entry-shell";

function PracticePageInner(): JSX.Element {
  const sp = useSearchParams();
  return <PracticeModeView modeId={sp.get("modeId") ?? ""} />;
}

export default function PracticePage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <Sudoku2EntryScreen>
          <Sudoku2EntryStack>
            <p className="text-center text-sm text-[var(--s2-text-muted)]">加载专项页面…</p>
          </Sudoku2EntryStack>
        </Sudoku2EntryScreen>
      }
    >
      <PracticePageInner />
    </Suspense>
  );
}
