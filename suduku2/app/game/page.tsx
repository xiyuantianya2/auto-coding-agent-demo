import Link from "next/link";
import type { JSX } from "react";

import { GameGate } from "@/app/game/game-gate";

export default function GamePage(): JSX.Element {
  return (
    <GameGate>
      <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">对局</h1>
          <p className="mt-3 text-sm text-zinc-400">
            主棋盘、提示与笔记将在后续任务中接入核心状态与无尽选题。
          </p>
          <p className="mt-6">
            <Link
              href="/"
              className="text-emerald-400 underline-offset-4 hover:underline"
            >
              返回首页
            </Link>
          </p>
        </div>
      </div>
    </GameGate>
  );
}
