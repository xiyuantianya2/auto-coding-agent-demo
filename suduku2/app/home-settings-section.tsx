"use client";

import { useCallback, useRef, useState, type ChangeEvent, type JSX } from "react";

import { useSudoku2Auth } from "@/app/auth-context";
import {
  fetchProgressExportJson,
  postProgressImportJson,
} from "@/app/progress-backup-api";
import { useSudoku2ApiBase } from "@/app/sudoku2-app-providers";
import { useSudoku2Theme } from "@/app/sudoku2-theme-provider";

function mapImportErrorToZh(message: string): string {
  const m = message.trim();
  if (/JSON 格式无效|备份版本|文件过大|登录已失效|网络连接失败/.test(m)) {
    return m;
  }
  if (/parse failed|parse/i.test(m) && /JSON/i.test(m)) {
    return "JSON 格式无效，无法解析。请确认文件为本应用导出的备份。";
  }
  return m.length > 0 ? m : "导入失败，请稍后重试。";
}

export function HomeSettingsSection(): JSX.Element {
  const apiBase = useSudoku2ApiBase();
  const { ready, token } = useSudoku2Auth();
  const {
    themePreference,
    highContrastCandidates,
    setThemePreference,
    setHighContrastCandidates,
  } = useSudoku2Theme();

  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onThemeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      if (v === "light" || v === "dark" || v === "system") {
        setThemePreference(v);
      }
    },
    [setThemePreference],
  );

  const onExport = useCallback(async () => {
    if (!token) {
      return;
    }
    setBackupMessage(null);
    setBusy("export");
    try {
      const json = await fetchProgressExportJson(apiBase, token);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `suduku2-progress-${stamp}.json`;
      a.click();
      queueMicrotask(() => URL.revokeObjectURL(url));
      setBackupMessage("导出已开始：若浏览器未拦截，将下载 JSON 文件。");
    } catch (e) {
      setBackupMessage(mapImportErrorToZh(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }, [apiBase, token]);

  const runImport = useCallback(
    async (text: string) => {
      if (!token) {
        return;
      }
      setBackupMessage(null);
      setBusy("import");
      try {
        await postProgressImportJson(apiBase, token, text);
        setBackupMessage("导入成功：服务器进度已按备份文件替换。");
      } catch (e) {
        setBackupMessage(mapImportErrorToZh(e instanceof Error ? e.message : String(e)));
      } finally {
        setBusy(null);
      }
    },
    [apiBase, token],
  );

  const onPickFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) {
        return;
      }
      let text: string;
      try {
        text = await f.text();
      } catch {
        setBackupMessage("无法读取所选文件，请重试。");
        return;
      }
      try {
        JSON.parse(text);
      } catch {
        setBackupMessage("JSON 格式无效，无法解析。请确认文件为本应用导出的备份。");
        return;
      }
      const ok = globalThis.confirm(
        "确定要导入该备份吗？\n\n这将用文件中的进度整份覆盖当前账号在服务器上的存档（技巧解锁、练习记录、无尽关卡、草稿与设置等），且不可自动撤销。",
      );
      if (!ok) {
        setBackupMessage("已取消导入。");
        return;
      }
      void runImport(text);
    },
    [runImport],
  );

  return (
    <section
      className="mt-10 w-full max-w-lg rounded-2xl border border-[var(--s2-border)] bg-[var(--s2-card)] p-6 text-left shadow-sm"
      data-testid="home-settings-section"
      aria-labelledby="home-settings-heading"
    >
      <h2
        id="home-settings-heading"
        className="text-lg font-semibold text-[var(--s2-text)]"
      >
        外观与备份
      </h2>

      <div className="mt-4 space-y-3 text-sm text-[var(--s2-text-muted)]">
        <p>
          外观偏好会写入浏览器缓存；若已登录，还会同步到服务器进度中的{" "}
          <code className="rounded bg-[var(--s2-card-muted)] px-1 text-xs text-[var(--s2-text)]">
            settings
          </code>{" "}
          字段，换设备登录后可保持一致。
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-[var(--s2-text)]">
          主题
          <select
            data-testid="settings-theme-select"
            className="rounded-lg border border-[var(--s2-input-border)] bg-[var(--s2-input-bg)] px-3 py-2 text-[var(--s2-text)] outline-none ring-emerald-500/0 focus:border-emerald-500/60 focus:ring-2"
            value={themePreference}
            onChange={onThemeChange}
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--s2-text)] sm:mt-6">
          <input
            data-testid="settings-hc-candidates"
            type="checkbox"
            className="size-4 rounded border-[var(--s2-input-border)]"
            checked={highContrastCandidates}
            onChange={(e) => setHighContrastCandidates(e.target.checked)}
          />
          候选数高对比
        </label>
      </div>

      <div className="mt-8 border-t border-[var(--s2-border)] pt-6">
        <h3 className="text-base font-semibold text-[var(--s2-text)]">进度备份</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--s2-text-muted)]">
          导出文件包含技巧解锁、练习记录、四档无尽进度、对局草稿与界面设置等，与服务器用户存档一致；{" "}
          <strong className="font-semibold text-[var(--s2-text)]">不包含</strong>{" "}
          登录令牌、密码或用户名。无尽全局题库为服务器共享状态，不会写入导出文件。
        </p>
        {!ready ? (
          <p className="mt-3 text-sm text-[var(--s2-text-subtle)]">会话加载中…</p>
        ) : !token ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-[var(--s2-amber-warn-text)]" role="status">
            请先登录后再导出或导入进度。
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              data-testid="progress-export-button"
              className="rounded-lg bg-[var(--s2-btn-secondary-bg)] px-4 py-2 text-sm font-semibold text-[var(--s2-btn-secondary-text)] ring-1 ring-[var(--s2-btn-secondary-ring)] hover:bg-[var(--s2-btn-secondary-hover)] disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => void onExport()}
            >
              {busy === "export" ? "导出中…" : "导出进度 JSON"}
            </button>
            <button
              type="button"
              data-testid="progress-import-trigger"
              className="rounded-lg border border-dashed border-[var(--s2-border)] px-4 py-2 text-sm font-semibold text-[var(--s2-text)] hover:border-emerald-500/50 disabled:opacity-50"
              disabled={busy !== null}
              onClick={() => fileRef.current?.click()}
            >
              {busy === "import" ? "导入中…" : "从文件导入"}
            </button>
            <input
              ref={fileRef}
              data-testid="progress-import-file"
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={onPickFile}
            />
          </div>
        )}
        {backupMessage ? (
          <p
            className="mt-3 text-sm text-[var(--s2-text-muted)]"
            role="status"
            data-testid="progress-backup-message"
          >
            {backupMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}
