"use client";

import { Suspense, type JSX } from "react";
import { useSearchParams } from "next/navigation";

import { PracticeModeView } from "@/app/game/practice/practice-mode-view";

function PracticePageInner(): JSX.Element {
  const sp = useSearchParams();
  return <PracticeModeView modeId={sp.get("modeId") ?? ""} />;
}

export default function PracticePage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-1 items-center justify-center px-6 py-16 text-sm text-zinc-400">
          加载专项页面…
        </div>
      }
    >
      <PracticePageInner />
    </Suspense>
  );
}
