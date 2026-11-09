"use client";

/**
 * RoleGuard — Route guard component for role-based access control
 * 
 * Validates that the user has the required role before rendering children.
 * Redirects to appropriate dashboard if role doesn't match.
 * 
 * Usage:
 * ```tsx
 * <Route
 *   path="/influencer/dashboard"
 *   element={
 *     <RoleGuard requiredRole={Role.INFLUENCER}>
 *       <Dashboard />
 *     </RoleGuard>
 *   }
 * />
 * ```
 */

import React from 'react';
import { Navigate } from '@/lib/router';
import { useUser } from '../../context/UserContext';
import { Role } from '../../api/types';
import { getDashboardRoute } from '../../utils/roleRoutes';

interface RoleGuardProps {
  /** Required role(s) for accessing this route */
  requiredRole: Role | Role[];
  /** Content to render if role check passes */
  children: React.ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({ 
  requiredRole, 
  children, 
}) => {
  const {
    user,
    isAuthenticated, 
    activeRole, 
    isNewUser, 
    isAuthLoading,
  } = useUser();

  // Suspend until localStorage hydration is done — prevents false redirects on refresh
  if (isAuthLoading) return null;

  // Must be authenticated
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // New users need role selection first
  if (isNewUser) {
    return <Navigate to="/select-role" replace />;
  }

  // Convert single role to array for consistent handling
  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  // Check if user has required role
  const hasRequiredRole = activeRole && allowedRoles.includes(activeRole);

  if (!hasRequiredRole) {
    // User doesn't have the required role - redirect to their dashboard
    const targetRoute = getDashboardRoute(activeRole, user?.freelancerSlug);
    return <Navigate to={targetRoute} replace />;
  }

  // Role setup (was: influencer onboarding) is handled in-app by RoleSetupGate,
  // which blocks the app with a setup wizard until the role is ACTIVE.
  return <>{children}</>;
};

export default RoleGuard;
