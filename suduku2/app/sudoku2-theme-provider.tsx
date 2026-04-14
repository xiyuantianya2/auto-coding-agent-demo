"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";

import { fetchProgress, patchProgress } from "@/app/progress-api";
import {
  parseHighContrast,
  parseThemePreference,
  SETTINGS_HC_CANDIDATES_KEY,
  SETTINGS_THEME_KEY,
  SUDOKU2_HC_CANDIDATES_STORAGE_KEY,
  SUDOKU2_THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/app/ui-preferences";
import { useSudoku2Auth } from "@/app/auth-context";
import { useSudoku2ApiBase } from "@/app/sudoku2-app-providers";

export type Sudoku2ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: "light" | "dark";
  highContrastCandidates: boolean;
  setThemePreference: (next: ThemePreference) => void;
  setHighContrastCandidates: (next: boolean) => void;
};

const Sudoku2ThemeContext = createContext<Sudoku2ThemeContextValue | null>(null);

function readThemeFromStorage(): ThemePreference {
  try {
    const t = globalThis.localStorage?.getItem(SUDOKU2_THEME_STORAGE_KEY);
    const p = parseThemePreference(t);
    if (p) {
      return p;
    }
  } catch {
    /* ignore */
  }
  return "system";
}

function readHcFromStorage(): boolean {
  try {
    return globalThis.localStorage?.getItem(SUDOKU2_HC_CANDIDATES_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") {
    if (typeof globalThis.matchMedia !== "function") {
      return "light";
    }
    return globalThis.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

function applyDom(resolved: "light" | "dark", hc: boolean): void {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  if (hc) {
    root.classList.add("hc-candidates");
  } else {
    root.classList.remove("hc-candidates");
  }
  root.dataset.themeResolved = resolved;
  root.dataset.hcCandidates = hc ? "on" : "off";
}

export function Sudoku2ThemeProvider(props: { children: ReactNode }): JSX.Element {
  const { children } = props;
  const apiBase = useSudoku2ApiBase();
  const { ready, token } = useSudoku2Auth();

  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [highContrastCandidates, setHighContrastCandidatesState] = useState(false);

  const hcRef = useRef(highContrastCandidates);

  useEffect(() => {
    hcRef.current = highContrastCandidates;
  }, [highContrastCandidates]);

  const resolvedTheme = useMemo(
    () => resolveTheme(themePreference),
    [themePreference],
  );

  useLayoutEffect(() => {
    const tp = readThemeFromStorage();
    const hc = readHcFromStorage();
    hcRef.current = hc;
    applyDom(resolveTheme(tp), hc);
    queueMicrotask(() => {
      setThemePreferenceState(tp);
      setHighContrastCandidatesState(hc);
    });
  }, []);

  useEffect(() => {
    if (typeof globalThis.matchMedia !== "function") {
      return;
    }
    if (themePreference !== "system") {
      return;
    }
    const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyDom(resolveTheme("system"), hcRef.current);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themePreference]);

  useEffect(() => {
    if (!ready || !token) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const p = await fetchProgress(apiBase, token);
        if (cancelled) {
          return;
        }
        const s = p.settings;
        if (!s || typeof s !== "object") {
          return;
        }
        const st = parseThemePreference(s[SETTINGS_THEME_KEY]);
        const shc = parseHighContrast(s[SETTINGS_HC_CANDIDATES_KEY]);
        const nextTp = st ?? readThemeFromStorage();
        const nextHc = shc !== null ? shc : readHcFromStorage();
        if (st) {
          setThemePreferenceState(st);
          try {
            globalThis.localStorage?.setItem(SUDOKU2_THEME_STORAGE_KEY, st);
          } catch {
            /* ignore */
          }
        }
        if (shc !== null) {
          setHighContrastCandidatesState(shc);
          hcRef.current = shc;
          try {
            globalThis.localStorage?.setItem(
              SUDOKU2_HC_CANDIDATES_STORAGE_KEY,
              shc ? "1" : "0",
            );
          } catch {
            /* ignore */
          }
        }
        applyDom(resolveTheme(nextTp), nextHc);
        hcRef.current = nextHc;
      } catch {
        /* 保持本地偏好 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, token, apiBase]);

  const setThemePreference = useCallback(
    (next: ThemePreference) => {
      setThemePreferenceState(next);
      try {
        globalThis.localStorage?.setItem(SUDOKU2_THEME_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      const r = resolveTheme(next);
      applyDom(r, hcRef.current);
      if (ready && token) {
        void patchProgress(apiBase, token, {
          settings: {
            [SETTINGS_THEME_KEY]: next,
            [SETTINGS_HC_CANDIDATES_KEY]: hcRef.current,
          },
        }).catch(() => {
          /* 离线时仅本地生效 */
        });
      }
    },
    [apiBase, ready, token],
  );

  const setHighContrastCandidates = useCallback(
    (next: boolean) => {
      setHighContrastCandidatesState(next);
      hcRef.current = next;
      try {
        globalThis.localStorage?.setItem(
          SUDOKU2_HC_CANDIDATES_STORAGE_KEY,
          next ? "1" : "0",
        );
      } catch {
        /* ignore */
      }
      applyDom(resolveTheme(themePreference), next);
      if (ready && token) {
        void patchProgress(apiBase, token, {
          settings: {
            [SETTINGS_THEME_KEY]: themePreference,
            [SETTINGS_HC_CANDIDATES_KEY]: next,
          },
        }).catch(() => {
          /* ignore */
        });
      }
    },
    [apiBase, ready, themePreference, token],
  );

  const value = useMemo<Sudoku2ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      highContrastCandidates,
      setThemePreference,
      setHighContrastCandidates,
    }),
    [
      themePreference,
      resolvedTheme,
      highContrastCandidates,
      setThemePreference,
      setHighContrastCandidates,
    ],
  );

  return (
    <Sudoku2ThemeContext.Provider value={value}>{children}</Sudoku2ThemeContext.Provider>
  );
}

export function useSudoku2Theme(): Sudoku2ThemeContextValue {
  const v = useContext(Sudoku2ThemeContext);
  if (!v) {
    throw new Error("useSudoku2Theme 必须在 Sudoku2ThemeProvider 内使用");
  }
  return v;
}
