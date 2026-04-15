"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { useSudoku2Auth } from "@/app/auth-context";
import { joinSudoku2ApiPath } from "@/app/sudoku2-api";
import { useSudoku2ApiBase } from "@/app/sudoku2-app-providers";
import { Sudoku2EntryStack, sudoku2EntryTextLinkClass } from "@/app/sudoku2-entry-shell";
import { techniqueTitleZh } from "@/app/tutorial/technique-titles-zh";
import {
  getTechniqueCatalog,
  getUnlockGraph,
  type CurriculumTier,
  type TechniqueModule,
} from "@/content/curriculum";

const TIER_LABEL: Record<CurriculumTier, string> = {
  low: "低阶",
  mid: "中阶",
  high: "高阶",
};

const TIER_ORDER: CurriculumTier[] = ["low", "mid", "high"];

type ProgressWire = {
  techniques?: Record<string, { unlocked?: boolean } | undefined>;
};

function isUnlockedFromProgress(
  techniques: Record<string, { unlocked?: boolean } | undefined> | undefined,
  techniqueId: string,
): boolean {
  return techniques?.[techniqueId]?.unlocked === true;
}

export function TutorialCurriculumView(): JSX.Element {
  const apiBase = useSudoku2ApiBase();
  const { ready, token } = useSudoku2Auth();

  const catalog = useMemo(() => getTechniqueCatalog(), []);
  const unlockGraph = useMemo(() => getUnlockGraph(), []);

  const requiresById = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of unlockGraph) {
      m.set(e.techniqueId, e.requires);
    }
    return m;
  }, [unlockGraph]);

  const moduleById = useMemo(() => {
    const m = new Map<string, TechniqueModule>();
    for (const mod of catalog) {
      m.set(mod.id, mod);
    }
    return m;
  }, [catalog]);

  const resolvePrereqLabels = useCallback(
    (requires: string[]): string[] => {
      return requires.map((rid) => {
        const mod = moduleById.get(rid);
        if (!mod) {
          return rid;
        }
        return techniqueTitleZh(mod.titleKey);
      });
    },
    [moduleById],
  );

  const grouped = useMemo(() => {
    const out: Record<CurriculumTier, TechniqueModule[]> = {
      low: [],
      mid: [],
      high: [],
    };
    for (const m of catalog) {
      out[m.tier].push(m);
    }
    for (const t of TIER_ORDER) {
      out[t].sort((a, b) => a.order - b.order);
    }
    return out;
  }, [catalog]);

  const [progress, setProgress] = useState<ProgressWire | null>(null);
  const [fetchStatus, setFetchStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  useEffect(() => {
    if (!ready || !token) {
      return;
    }

    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) {
        return;
      }
      setFetchStatus("loading");
      const url = joinSudoku2ApiPath(apiBase, "/api/progress");
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (!cancelled) {
            setFetchStatus("error");
          }
          return;
        }
        const data = (await res.json()) as ProgressWire;
        if (!cancelled) {
          setProgress(data);
          setFetchStatus("ok");
        }
      } catch {
        if (!cancelled) {
          setFetchStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, token, apiBase]);

  const techniques = progress?.techniques;

  return (
    <Sudoku2EntryStack data-testid="tutorial-curriculum-root">
      <header className="rounded-[var(--s2-r-2xl)] border border-[var(--s2-accent-panel-border)] bg-[var(--s2-accent-panel-bg)] px-5 py-6 shadow-sm sm:px-8 sm:py-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--s2-accent-panel-muted)]">
          教学
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--s2-accent-panel-fg)] sm:text-3xl">
          教学大纲
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--s2-accent-panel-muted)]">
          按低 / 中 / 高阶分组；解锁依赖来自大纲图（每项最多依赖上一技巧）。
        </p>
        {!token && ready ? (
          <p
            className="mt-4 rounded-[var(--s2-r-lg)] border border-[var(--s2-amber-warn-border)] bg-[var(--s2-amber-warn-bg)] px-3 py-2 text-sm text-[var(--s2-amber-warn-text)]"
            data-testid="tutorial-login-hint"
            role="status"
          >
            您尚未登录，无法读取个人解锁进度。登录后此处将与服务器「技巧解锁」记录对齐。
          </p>
        ) : null}
        {token && fetchStatus === "loading" ? (
          <p className="mt-4 text-sm text-[var(--s2-text-muted)]" data-testid="tutorial-progress-loading">
            正在加载进度…
          </p>
        ) : null}
        {token && fetchStatus === "error" ? (
          <p className="mt-4 text-sm text-red-300" role="alert">
            进度加载失败，请稍后重试或检查网络。
          </p>
        ) : null}
      </header>

      <div className="mt-10 space-y-10">
        {TIER_ORDER.map((tier) => {
          const items = grouped[tier];
          if (items.length === 0) {
            return null;
          }
          return (
            <section key={tier} aria-labelledby={`tier-${tier}`}>
              <h2 id={`tier-${tier}`} className="text-base font-semibold uppercase tracking-wide text-[var(--s2-eyebrow)]">
                {TIER_LABEL[tier]}
              </h2>
              <ul className="mt-4 space-y-4">
                {items.map((mod) => {
                  const requires = requiresById.get(mod.id) ?? [];
                  const prereqText =
                    requires.length === 0
                      ? "无前置（入口）"
                      : `前置：${resolvePrereqLabels(requires).join("、")}`;

                  const unlocked =
                    token && fetchStatus === "ok"
                      ? isUnlockedFromProgress(techniques, mod.id)
                      : null;

                  const unlockLabel =
                    !token || !ready
                      ? "需登录"
                      : fetchStatus === "loading"
                        ? "…"
                        : fetchStatus === "error"
                          ? "无法读取"
                          : unlocked
                            ? "已解锁"
                            : "未解锁";

                  return (
                    <li
                      key={mod.id}
                      className="rounded-[var(--s2-r-xl)] border border-[var(--s2-border)] bg-[var(--s2-card)] px-4 py-4 shadow-sm sm:px-5 sm:py-5"
                      data-testid={`tutorial-technique-${mod.id}`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-base font-semibold text-[var(--s2-text)]">
                            {techniqueTitleZh(mod.titleKey)}
                          </p>
                          <p className="mt-1.5 text-sm text-[var(--s2-text-subtle)]">{prereqText}</p>
                        </div>
                        <div className="flex w-full shrink-0 flex-col items-stretch gap-3 sm:w-auto sm:items-end">
                          <span
                            className={
                              unlocked === true
                                ? "rounded-[var(--s2-r-sm)] bg-[var(--s2-tutorial-chip-bg)] px-2 py-0.5 text-xs text-[var(--s2-tutorial-chip-fg)]"
                                : unlocked === false
                                  ? "rounded-md bg-[var(--s2-card-muted)] px-2 py-0.5 text-xs text-[var(--s2-text-muted)]"
                                  : "rounded-md bg-[var(--s2-card-muted)] px-2 py-0.5 text-xs text-[var(--s2-text-subtle)]"
                            }
                            data-testid={`tutorial-unlock-status-${mod.id}`}
                          >
                            {unlockLabel}
                          </span>
                          {token && fetchStatus === "ok" && unlocked === true ? (
                            <Link
                              href={`/game/practice?modeId=${encodeURIComponent(mod.practiceEndlessModeId)}`}
                              className="inline-flex min-h-[var(--s2-touch-min)] w-full touch-manipulation items-center justify-center rounded-[var(--s2-r-lg)] border border-[var(--s2-tutorial-cta-border)] bg-[var(--s2-tutorial-cta-bg)] px-4 text-sm font-semibold text-[var(--s2-tutorial-cta-fg)] transition hover:bg-[var(--s2-tutorial-cta-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s2-focus-ring)] sm:w-auto sm:min-w-[7.5rem]"
                              data-testid={`tutorial-practice-link-${mod.id}`}
                            >
                              专项练习
                            </Link>
                          ) : token && fetchStatus === "ok" && unlocked === false ? (
                            <span
                              className="inline-flex min-h-[var(--s2-touch-min)] w-full cursor-not-allowed items-center justify-center rounded-[var(--s2-r-lg)] border border-dashed border-[var(--s2-border-strong)] px-4 text-sm text-[var(--s2-text-subtle)] sm:w-auto"
                              data-testid={`tutorial-practice-locked-${mod.id}`}
                            >
                              需先解锁专项
                            </span>
                          ) : (
                            <span
                              className="inline-flex min-h-[var(--s2-touch-min)] w-full items-center justify-center rounded-[var(--s2-r-lg)] border border-dashed border-[var(--s2-border-strong)] px-4 text-sm text-[var(--s2-text-subtle)] sm:w-auto"
                              data-testid={`tutorial-practice-wait-${mod.id}`}
                              title={!token ? "登录后可进入专项练习" : "正在读取解锁状态"}
                            >
                              {!token ? "登录后可专项" : "专项练习"}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-12 text-center">
        <Link href="/" className={sudoku2EntryTextLinkClass}>
          返回首页
        </Link>
      </p>
    </Sudoku2EntryStack>
  );
}
