import type { GameState } from "@/lib/core";

function cellDisplayDigit(cell: GameState["cells"][number][number]): string {
  if (cell.given !== undefined) return String(cell.given);
  if (cell.value !== undefined) return String(cell.value);
  return "";
}

export function SudokuBoardStatic({ state }: { state: GameState }) {
  return (
    <div
      className="inline-grid gap-px rounded-md border border-zinc-700 bg-zinc-800 p-1"
      style={{
        gridTemplateColumns: "repeat(9, minmax(0, 2.25rem))",
      }}
      data-testid="suduku-board"
      aria-label="数独棋盘"
    >
      {state.cells.map((row, r) =>
        row.map((cell, c) => {
          const isThickRight = (c + 1) % 3 === 0 && c < 8;
          const isThickBottom = (r + 1) % 3 === 0 && r < 8;
          const display = cellDisplayDigit(cell);
          const isGiven = cell.given !== undefined;
          return (
            <div
              key={`${r}-${c}`}
              data-testid={`suduku-cell-${r}-${c}`}
              data-cell-kind={isGiven ? "given" : "playable"}
              className={[
                "flex h-9 w-9 items-center justify-center border border-zinc-700/80 bg-zinc-900 text-sm tabular-nums",
                isThickRight ? "border-r-2 border-r-zinc-500" : "",
                isThickBottom ? "border-b-2 border-b-zinc-500" : "",
                isGiven ? "font-semibold text-emerald-300" : "text-zinc-100",
              ].join(" ")}
              aria-label={`第 ${r + 1} 行第 ${c + 1} 列`}
            >
              {display}
            </div>
          );
        }),
      )}
    </div>
  );
}
