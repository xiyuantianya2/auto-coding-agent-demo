"use client";

import { useEffect, useRef, useState } from "react";
import { BASE_SCORE_PER_CELL } from "@/lib/match-clear";
import { CHAIN_BONUS_PER_EXTRA_WAVE } from "@/lib/stabilization";
import { cn } from "@/lib/utils";

const defaultTriggerClass =
  "inline-flex items-center justify-center rounded-full border border-emerald-500/45 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-200/95 shadow-sm shadow-emerald-950/30 transition-colors hover:bg-emerald-900/50";

export function GameInstructionsDialog(props: {
  readonly triggerClassName?: string;
  /** Defaults to `game-instructions-trigger` when there is only one instance on the page. */
  readonly testId?: string;
}) {
  const triggerTestId = props.testId ?? "game-instructions-trigger";
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const base = BASE_SCORE_PER_CELL;
  const chain = CHAIN_BONUS_PER_EXTRA_WAVE;

  useEffect(() => {
    if (!open) return;

    const triggerEl = triggerRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    queueMicrotask(() => closeRef.current?.focus());

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      triggerEl?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid={triggerTestId}
        className={cn(defaultTriggerClass, props.triggerClassName)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        游戏说明
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-zinc-950/70 px-3 py-6 backdrop-blur-[2px] sm:items-center sm:px-6 sm:py-10"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            data-testid="game-instructions-dialog"
            aria-modal="true"
            aria-labelledby="ddp-instructions-title"
            className="max-h-[min(85vh,40rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-zinc-700/90 bg-zinc-900/98 p-5 text-left shadow-2xl shadow-black/50 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="ddp-instructions-title"
              className="text-lg font-semibold text-zinc-50 sm:text-xl"
            >
              游戏说明与得分
            </h2>

            <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-300">
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                  操作
                </h3>
                <p>
                  先点击一格选中，再点击与其<strong>上下左右相邻</strong>
                  的另一格完成交换；对角线或不相邻的第二格不会尝试交换。
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                  合法与步数
                </h3>
                <p>
                  交换后须能在被交换格上触发<strong>三消</strong>（横或纵至少三个同色相连）；否则盘面会恢复为交换前，
                  <strong>不消耗步数</strong>
                  ，并会有提示。
                </p>
                <p>
                  仅当交换被接受并进入三消消除与连锁结算时，<strong>消耗 1 步</strong>
                  （一整次「稳定化」连锁仍只算一手）。
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                  胜负
                </h3>
                <p>
                  当前累计得分达到本关<strong>目标分</strong>即可过关；若
                  <strong>剩余步数为 0</strong>
                  时仍未达标，则本关失败，可重试或新游戏。
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                  分数构成（与程序常量一致）
                </h3>
                <ul className="list-inside list-disc space-y-1.5 text-zinc-400 marker:text-zinc-600">
                  <li>
                    本游戏得分<strong>仅</strong>来自下方三消基础分与连锁波次倍率，无其他加分项。
                  </li>
                  <li>
                    <span className="font-mono text-zinc-200">
                      BASE_SCORE_PER_CELL = {base}
                    </span>
                    ：三消时，每消除一格计 {base}{" "}
                    分；一波内按该波消除的格子数累计三消基础分。
                  </li>
                  <li>
                    每一<strong>连锁波次</strong>
                    内，该波<strong>基础分</strong>为三消基础分之和；再乘以下列倍率后
                    <strong>四舍五入为整数</strong>，并累加到本步总分。
                  </li>
                  <li>
                    <span className="font-mono text-zinc-200">
                      CHAIN_BONUS_PER_EXTRA_WAVE = {chain}
                    </span>
                    ：第 1 波倍率为 1；第{" "}
                    <span className="tabular-nums">n</span> 波（
                    <span className="tabular-nums">n</span> ≥ 2）在该波基础分上乘以
                    <span className="whitespace-nowrap font-mono text-amber-200/95">
                      1 + {chain} × (<span className="tabular-nums">n</span> − 1)
                    </span>
                    。例如第 2 波 ×{(1 + chain * 1).toFixed(1)}、第 3 波 ×
                    {(1 + chain * 2).toFixed(1)}。
                  </li>
                  <li>
                    <strong>波次含义</strong>：一次有效交换后，反复执行「检测三消 →
                    消除 → 下落补位」，直到盘面上不再有三消为止；其中每一次三消消除轮次计为
                    <strong>一波</strong>。下落补位后若出现新的三消，则进入下一波并套用更高倍率。
                  </li>
                </ul>
              </section>
            </div>

            <div className="mt-6 flex justify-end border-t border-zinc-800 pt-4">
              <button
                ref={closeRef}
                type="button"
                data-testid="game-instructions-close"
                className="inline-flex items-center justify-center rounded-full border border-zinc-600 bg-zinc-950/80 px-5 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/80"
                onClick={() => setOpen(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
