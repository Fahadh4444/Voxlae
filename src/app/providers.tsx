"use client";

import React, { Suspense } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserProvider } from "@/context/UserContext";
import { UIProvider } from "@/context/UIContext";
import Modal from "@/components/common/Modal";
import ToastContainer from "@/components/common/Toast";
import ScrollToTop from "@/components/common/ScrollToTop";
import AuthTransitionOverlay from "@/components/layout/AuthTransitionOverlay";
import VoxlaeLoader from "@/components/common/VoxlaeLoader";

/**
 * Everything the old `App.tsx` wrapped around `<Router>`, minus the router itself.
 *
 * Provider nesting order is load-bearing and unchanged: Theme → User → UI.
 *
 * The Suspense boundaries are required, not decorative. Next refuses to prerender a component
 * that calls `useSearchParams` outside one, and the router shim's `useLocation` is built on it —
 * so ScrollToTop, AuthTransitionOverlay and any page reading the location all need covering.
 *
 * The boundary around `children` also restores the old `App.tsx` behaviour exactly: it wrapped
 * the whole route tree in `<Suspense fallback={<VoxlaeLoader ... />}>` for lazy-loaded routes.
 * Same fallback, same feel.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <UserProvider>
        <UIProvider>
          <Suspense fallback={null}>
            <ScrollToTop />
          </Suspense>
          <Suspense
            fallback={
              <VoxlaeLoader variant="page" fullscreen label="Loading Voxlae" />
            }
          >
            {children}
          </Suspense>
          <Modal />
          <ToastContainer />
          <Suspense fallback={null}>
            <AuthTransitionOverlay />
          </Suspense>
        </UIProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
