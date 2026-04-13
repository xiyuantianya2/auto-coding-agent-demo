import { SudokuBoardStatic } from "@/components/SudokuBoard";
import { SAMPLE_GIVENS_MINIMAL } from "@/lib/core/fixture";
import { BOARD_SIZE, createGameStateFromGivens } from "@/lib/core";

export default function Home() {
  const state = createGameStateFromGivens(SAMPLE_GIVENS_MINIMAL);

  return (
    <div className="flex min-h-full flex-col items-center bg-zinc-950 px-6 py-12 text-zinc-100 sm:py-16">
      <main className="flex w-full max-w-3xl flex-col items-center gap-10">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            suduku
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">数独</h1>
          <p className="mt-4 text-base leading-relaxed text-zinc-400">
            核心数据模型预览（{BOARD_SIZE}×{BOARD_SIZE} 盘面，来自{" "}
            <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-200">
              createGameStateFromGivens
            </code>
            ）。
          </p>
        </div>

        <SudokuBoardStatic state={state} />
      </main>
    </div>
  );
}
