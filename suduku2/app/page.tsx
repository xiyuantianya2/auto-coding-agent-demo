import { GRID_SIZE } from "@/lib/core";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-6 py-16 text-zinc-100">
      <main className="max-w-lg text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400/90">
          suduku2
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          数独2
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-400">
          核心棋盘尺寸（契约常量）：{GRID_SIZE}×{GRID_SIZE}
        </p>
      </main>
    </div>
  );
}
