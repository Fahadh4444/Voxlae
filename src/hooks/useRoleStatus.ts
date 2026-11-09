"use client";

/**
 * useRoleStatus — Hook for accessing the current active role's status
 * 
 * Provides:
 * - isActiveRole: whether current active role is ACTIVE (profile complete)
 * - isIncomplete: whether current active role is INCOMPLETE
 * - activeRoleStatus: the RoleStatus enum value
 * - getProfileRoute: route to the profile page for the active role
 * 
 * Uses the roles array from UserContext — no extra API calls needed.
 */

import { useMemo } from 'react';
import { useUser } from '../context/UserContext';
import { Role, RoleStatus } from '../api/types';

interface RoleStatusInfo {
  /** Whether the active role's profile is complete (ACTIVE) */
  isActiveRole: boolean;
  /** Whether the active role's profile is incomplete */
  isIncomplete: boolean;
  /** The active role's status enum value */
  activeRoleStatus: RoleStatus;
  /** Route to the profile page for the active role */
  profileRoute: string;
  /** Human-readable label for the restriction message */
  restrictionMessage: string;
}

/**
 * Get the profile route for a given role
 */
function getProfileRoute(role: Role | null): string {
  switch (role) {
    case Role.FREELANCER:
      return '/freelancer/profile';
    case Role.BRAND:
      return '/brand/profile';
    case Role.INFLUENCER:
      return '/influencer/dashboard'; // No separate profile page yet
    default:
      return '/';
  }
}

/**
 * Get the restriction message for a given role
 */
function getRestrictionMessage(role: Role | null): string {
  switch (role) {
    case Role.FREELANCER:
      return 'Complete your freelancer profile to unlock all features';
    case Role.BRAND:
      return 'Complete your brand profile to start using features';
    default:
      return 'Complete your profile to access all features';
  }
}

export function useRoleStatus(): RoleStatusInfo {
  const { roles, activeRole } = useUser();

  return useMemo(() => {
    // Find the active role's status from the roles array
    const activeRoleDto = roles.find(r => r.role === activeRole);
    const status = activeRoleDto?.status ?? RoleStatus.INCOMPLETE;

    return {
      isActiveRole: status === RoleStatus.ACTIVE,
      isIncomplete: status === RoleStatus.INCOMPLETE,
      activeRoleStatus: status,
      profileRoute: getProfileRoute(activeRole),
      restrictionMessage: getRestrictionMessage(activeRole),
    };
  }, [roles, activeRole]);
}
