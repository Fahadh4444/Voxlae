"use client";

import React, { useEffect, useRef } from "react";
import { useLocation } from "@/lib/router";
import { useUI } from "../../context/UIContext";
import VoxlaeLoader from "../common/VoxlaeLoader";

/**
 * A full-screen loader shown from the moment a sign-in succeeds until the user lands on their
 * destination page.
 *
 * AuthModal closes itself and then navigates a tick later, which would otherwise flash the
 * landing page. This bridges that gap, then auto-dismisses on the first route change so the
 * destination's own loaders take over. A safety timeout ensures it can never get stuck.
 */
const AuthTransitionOverlay: React.FC = () => {
  const { authTransition, setAuthTransition } = useUI();
  const location = useLocation();
  const startPath = useRef<string | null>(null);

  // Remember where the transition began; clear it when inactive.
  useEffect(() => {
    if (authTransition) {
      if (startPath.current === null) startPath.current = location.pathname;
    } else {
      startPath.current = null;
    }
  }, [authTransition, location.pathname]);

  // Once the route moves off the starting path, the destination is mounting.
  useEffect(() => {
    if (
      authTransition &&
      startPath.current !== null &&
      location.pathname !== startPath.current
    ) {
      setAuthTransition(false);
    }
  }, [location.pathname, authTransition, setAuthTransition]);

  // Safety net: never leave the overlay up indefinitely.
  useEffect(() => {
    if (!authTransition) return;
    const t = setTimeout(() => setAuthTransition(false), 10000);
    return () => clearTimeout(t);
  }, [authTransition, setAuthTransition]);

  if (!authTransition) return null;
  return <VoxlaeLoader variant="page" fullscreen label="Signing you in…" />;
};

export default AuthTransitionOverlay;
