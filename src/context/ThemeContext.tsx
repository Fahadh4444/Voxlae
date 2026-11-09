"use client";

/**
 * ThemeContext — App-wide light / dark / system theming
 *
 * Single source of truth for the color theme. Exposes the user's *preference*
 * ('light' | 'dark' | 'system') and the *resolved* theme actually applied
 * ('light' | 'dark'). "system" follows the OS `prefers-color-scheme` and updates
 * live when the OS setting changes.
 *
 * The resolved theme is written to `data-theme` on <html>, which drives the
 * :root[data-theme="dark"] token overrides in theme/global.css. A tiny inline
 * script in index.html applies the stored preference *before first paint* so
 * there is no light-mode flash on load; this provider then takes over and keeps
 * it in sync. Keep the storage key and attribute name in lockstep with that
 * script (see THEME_STORAGE_KEY below and index.html).
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** localStorage key — MUST match the pre-paint script in index.html. */
export const THEME_STORAGE_KEY = 'vx-theme';

const MEDIA_QUERY = '(prefers-color-scheme: dark)';

const isValidPreference = (v: unknown): v is ThemePreference =>
  v === 'light' || v === 'dark' || v === 'system';

/** Read the persisted preference, defaulting to 'system'. */
const readStoredPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidPreference(stored)) return stored;
  } catch {
    /* localStorage may be unavailable (private mode / SSR) — fall through */
  }
  return 'system';
};

const getSystemTheme = (): ResolvedTheme =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia(MEDIA_QUERY).matches
    ? 'dark'
    : 'light';

const resolveTheme = (pref: ThemePreference): ResolvedTheme =>
  pref === 'system' ? getSystemTheme() : pref;

/** Apply the resolved theme to <html> so the CSS token overrides kick in. */
const applyTheme = (resolved: ResolvedTheme) => {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
};

interface ThemeContextValue {
  /** What the user chose. */
  preference: ThemePreference;
  /** What is actually applied right now ('system' resolved). */
  theme: ResolvedTheme;
  /** Set the preference explicitly. */
  setPreference: (pref: ThemePreference) => void;
  /** Convenience: flip between light and dark (sets an explicit preference). */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readStoredPreference()));

  // Apply + persist whenever the preference changes.
  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* ignore persistence failure */
    }
    const next = resolveTheme(pref);
    setResolved(next);
    applyTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setPreference]);

  // Ensure the DOM matches state on mount (in case the inline script and stored
  // value diverged, e.g. after a manual localStorage edit).
  useEffect(() => {
    applyTheme(resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While in "system" mode, track live OS changes.
  useEffect(() => {
    if (preference !== 'system') return;
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia(MEDIA_QUERY);
    const onChange = () => {
      const next = getSystemTheme();
      setResolved(next);
      applyTheme(next);
    };
    // addEventListener is the modern API; older Safari uses addListener.
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [preference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme: resolved, setPreference, toggleTheme }),
    [preference, resolved, setPreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export default ThemeContext;
