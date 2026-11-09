"use client";

/**
 * AdminGuard — renders children only for admins; everyone else is sent home.
 *
 * `isAdmin` arrives with /auth/me, after the cached session has already hydrated, so "not yet known"
 * (undefined) waits instead of redirecting — otherwise a refresh on an admin page would bounce the
 * admin away before the answer lands. This is UI only: every admin API re-checks with `requireAdmin`.
 */

import React from 'react';
import { Navigate } from '@/lib/router';
import { useUser } from '../../context/UserContext';

const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isAuthLoading } = useUser();

  if (isAuthLoading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (user?.isAdmin === undefined) return null; // still waiting on /auth/me
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default AdminGuard;
