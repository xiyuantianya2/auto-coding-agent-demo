"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type JSX } from "react";

import { useSudoku2Auth } from "@/app/auth-context";
import { joinSudoku2ApiPath } from "@/app/sudoku2-api";
import { useSudoku2ApiBase } from "@/app/sudoku2-app-providers";
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
    <div
      className="mx-auto w-full max-w-3xl px-4 py-10 text-zinc-100"
      data-testid="tutorial-curriculum-root"
    >
      <header className="border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">教学大纲</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          按低 / 中 / 高阶分组；解锁依赖来自大纲图（每项最多依赖上一技巧）。
        </p>
        {!token && ready ? (
          <p
            className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
            data-testid="tutorial-login-hint"
            role="status"
          >
            您尚未登录，无法读取个人解锁进度。登录后此处将与服务器「技巧解锁」记录对齐。
          </p>
        ) : null}
        {token && fetchStatus === "loading" ? (
          <p className="mt-4 text-sm text-zinc-400" data-testid="tutorial-progress-loading">
            正在加载进度…
          </p>
        ) : null}
        {token && fetchStatus === "error" ? (
          <p className="mt-4 text-sm text-red-300" role="alert">
            进度加载失败，请稍后重试或检查网络。
          </p>
        ) : null}
      </header>

      <div className="mt-8 space-y-10">
        {TIER_ORDER.map((tier) => {
          const items = grouped[tier];
          if (items.length === 0) {
            return null;
          }
          return (
            <section key={tier} aria-labelledby={`tier-${tier}`}>
              <h2 id={`tier-${tier}`} className="text-lg font-medium text-emerald-400/95">
                {TIER_LABEL[tier]}
              </h2>
              <ul className="mt-4 space-y-3">
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
                      className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3"
                      data-testid={`tutorial-technique-${mod.id}`}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium text-zinc-100">
                            {techniqueTitleZh(mod.titleKey)}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">{prereqText}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                          <span
                            className={
                              unlocked === true
                                ? "rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200"
                                : unlocked === false
                                  ? "rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                                  : "rounded-md bg-zinc-800/80 px-2 py-0.5 text-xs text-zinc-500"
                            }
                            data-testid={`tutorial-unlock-status-${mod.id}`}
                          >
                            {unlockLabel}
                          </span>
                          {token && fetchStatus === "ok" && unlocked === true ? (
                            <Link
                              href={`/game/practice?modeId=${encodeURIComponent(mod.practiceEndlessModeId)}`}
                              className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/20"
                              data-testid={`tutorial-practice-link-${mod.id}`}
                            >
                              专项练习
                            </Link>
                          ) : token && fetchStatus === "ok" && unlocked === false ? (
                            <span
                              className="inline-flex cursor-not-allowed items-center rounded-md border border-dashed border-zinc-600 px-2 py-1 text-xs text-zinc-500"
                              data-testid={`tutorial-practice-locked-${mod.id}`}
                            >
                              需先解锁专项
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center rounded-md border border-dashed border-zinc-600 px-2 py-1 text-xs text-zinc-500"
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

      <p className="mt-10 text-center">
        <Link
          href="/"
          className="text-emerald-400 underline-offset-4 hover:underline"
        >
          返回首页
        </Link>
      </p>
    </div>
  );
}
