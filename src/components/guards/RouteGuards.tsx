"use client";

/**
 * Route guards, lifted verbatim out of the old `App.tsx` <Route> tree.
 *
 * In React Router these wrapped `element={...}`; under the App Router each page composes the
 * guard it needs. The logic is unchanged on purpose — auth redirects are exactly the place where
 * a "while I'm here" tidy-up turns into a security bug.
 *
 * All four suspend on `isAuthLoading` first: that flag covers localStorage hydration, and acting
 * before it settles produces false redirects on refresh.
 */

import React from "react";
import { Navigate } from "@/lib/router";
import { useUser } from "../../context/UserContext";
import { Role } from "../../api/types";
import { getDashboardRoute } from "../../utils/roleRoutes";
import VoxlaeLoader from "../common/VoxlaeLoader";

const Loading = () => (
  <VoxlaeLoader variant="page" fullscreen label="Loading Voxlae" />
);

/**
 * Accessible only when NOT authenticated. Authenticated visitors are pushed on to role
 * selection (new users) or their role's dashboard.
 */
export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated, isNewUser, activeRole, isAuthLoading } =
    useUser();

  if (isAuthLoading) return <Loading />;

  if (isAuthenticated) {
    if (isNewUser) return <Navigate to="/select-role" replace />;
    // Role setup itself is handled in-app by RoleSetupGate, not by routing.
    return (
      <Navigate
        to={getDashboardRoute(activeRole, user?.freelancerSlug)}
        replace
      />
    );
  }
  return <>{children}</>;
};

/** Accessible only when authenticated with a role selected. */
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, isNewUser, isAuthLoading } = useUser();
  if (isAuthLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (isNewUser) return <Navigate to="/select-role" replace />;
  return <>{children}</>;
};

/**
 * Accessible only when authenticated AND still a new user.
 *
 * Deliberately does not redirect new users away — SelectRolePage drives its own navigation with
 * a hard `window.location.replace`.
 */
export const RoleSelectionRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user, isAuthenticated, isNewUser, activeRole, isAuthLoading } =
    useUser();
  if (isAuthLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!isNewUser) {
    return (
      <Navigate
        to={getDashboardRoute(activeRole, user?.freelancerSlug)}
        replace
      />
    );
  }
  return <>{children}</>;
};

/** Accessible only when authenticated AND holding one of `allowedRoles`. */
export const RoleProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles: Role[];
}> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, activeRole, isNewUser, isAuthLoading } =
    useUser();
  if (isAuthLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (isNewUser) return <Navigate to="/select-role" replace />;
  if (!activeRole || !allowedRoles.includes(activeRole)) {
    return (
      <Navigate
        to={getDashboardRoute(activeRole, user?.freelancerSlug)}
        replace
      />
    );
  }
  return <>{children}</>;
};
