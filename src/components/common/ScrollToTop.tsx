"use client";

/**
 * ScrollToTop — global scroll-reset on route change
 *
 * Placed once inside <Router> so every navigation (link click, programmatic
 * navigate(), or browser back/forward) resets the scroll position to the top
 * of the page before the incoming page renders.
 *
 * Also disables the browser's native scroll restoration so that a hard refresh
 * doesn't re-apply the previous scroll offset.
 */

import { useEffect } from 'react';
import { useLocation } from '@/lib/router';

// Disable browser scroll restoration globally, so a hard refresh doesn't re-apply the previous
// scroll offset.
//
// This used to run at module scope. Under Next that breaks the build: "use client" modules are
// still evaluated on the server during prerender, where `window` doesn't exist. The typeof guard
// keeps it as early as it can legitimately run while staying SSR-safe.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

export default ScrollToTop;
