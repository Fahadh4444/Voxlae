"use client";

/**
 * useUnsavedChanges
 *
 * Warnings are shown via a custom styled dialog (no browser window.confirm).
 * Returns { dialogVisible, confirmLeave, cancelLeave } so the consuming
 * component can render <UnsavedChangesDialog> and control it.
 *
 * Three navigation paths are covered:
 *  1. beforeunload  — tab close / hard refresh (must stay native per browser spec)
 *  2. pushState patch — React Router <Link> + navigate() (all SPA navigation)
 *  3. popstate      — browser Back / Forward button
 */

import { useEffect, useRef, useState, useCallback } from 'react';

type PendingNav =
  | { type: 'push' | 'replace'; state: unknown; title: string; url?: string | URL | null }
  | { type: 'popstate'; previousHref: string };

export interface UseUnsavedChangesResult {
  dialogVisible: boolean;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

export function useUnsavedChanges(isDirty: boolean): UseUnsavedChangesResult {
  // Ref so patched functions always see the latest isDirty without reinstalling.
  const isDirtyRef = useRef(isDirty);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  const [dialogVisible, setDialogVisible] = useState(false);
  const pendingNavRef = useRef<PendingNav | null>(null);

  // Stored once at mount time so confirmLeave can execute the deferred navigation.
  const origPushRef    = useRef<typeof window.history.pushState | null>(null);
  const origReplaceRef = useRef<typeof window.history.replaceState | null>(null);

  // ── Confirm: execute the blocked navigation ────────────────────────────────
  const confirmLeave = useCallback(() => {
    setDialogVisible(false);
    const nav = pendingNavRef.current;
    pendingNavRef.current = null;
    if (!nav) return;

    // Temporarily disable the guard so the replayed navigation goes through
    // our patched pushState/replaceState without being blocked again.
    isDirtyRef.current = false;

    if (nav.type === 'push') {
      // Replay via window.history.pushState so React Router's own listener
      // picks up the URL change and navigates to the correct page.
      window.history.pushState(nav.state, nav.title, nav.url);
    } else if (nav.type === 'replace') {
      window.history.replaceState(nav.state, nav.title, nav.url);
    }
    // popstate: URL already changed — React Router re-renders automatically.
  }, []);

  // ── Cancel: restore URL if it was a popstate ───────────────────────────────
  const cancelLeave = useCallback(() => {
    setDialogVisible(false);
    const nav = pendingNavRef.current;
    pendingNavRef.current = null;
    if (nav?.type === 'popstate') {
      // Restore the URL the user was on before pressing back/forward.
      // Use origPush here (bypassing our guard) since we are NOT navigating
      // away — we are restoring the current page's URL silently.
      origPushRef.current?.(null, '', nav.previousHref);
    }
  }, []);

  // ── 1. Tab close / hard refresh (native — cannot be replaced by custom UI) ─
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, []);

  // ── 2. React Router <Link> + navigate() via pushState / replaceState ────────
  useEffect(() => {
    const origPush    = window.history.pushState.bind(window.history);
    const origReplace = window.history.replaceState.bind(window.history);
    origPushRef.current    = origPush;
    origReplaceRef.current = origReplace;

    window.history.pushState = function (state, title, url) {
      if (isDirtyRef.current) {
        pendingNavRef.current = { type: 'push', state, title, url };
        setDialogVisible(true);
        return; // block navigation until user decides
      }
      origPush(state, title, url);
    };

    window.history.replaceState = function (state, title, url) {
      // Only block when the pathname actually changes (ignore same-page state saves).
      const incoming = url
        ? new URL(String(url), window.location.href).pathname
        : window.location.pathname;
      if (isDirtyRef.current && incoming !== window.location.pathname) {
        pendingNavRef.current = { type: 'replace', state, title, url };
        setDialogVisible(true);
        return;
      }
      origReplace(state, title, url);
    };

    return () => {
      window.history.pushState    = origPush;
      window.history.replaceState = origReplace;
    };
  }, []);

  // ── 3. Browser Back / Forward button ────────────────────────────────────────
  useEffect(() => {
    const handle = (_e: PopStateEvent) => {
      if (!isDirtyRef.current) return;
      // URL already changed at this point — store current href so cancelLeave
      // can push it back if the user decides to stay.
      pendingNavRef.current = { type: 'popstate', previousHref: window.location.href };
      setDialogVisible(true);
    };
    window.addEventListener('popstate', handle);
    return () => window.removeEventListener('popstate', handle);
  }, []);

  return { dialogVisible, confirmLeave, cancelLeave };
}

