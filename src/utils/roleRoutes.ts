/**
 * Role-Based Routing Utilities
 * 
 * Centralized configuration for role-based navigation.
 * Maps roles to their respective route prefixes and dashboards.
 */

import { Role } from '../api/types';

/**
 * Role route prefixes
 */
export const ROLE_PREFIXES: Record<Role, string> = {
  INFLUENCER: '/influencer',
  FREELANCER: '/freelancer',
  BRAND: '/brand',
  ADMIN: '/admin',
};

/**
 * Role dashboard routes
 */
export const ROLE_DASHBOARDS: Record<Role, string> = {
  INFLUENCER: '/influencer/dashboard',
  // Freelancers have no /freelancer/dashboard route — it would be caught by
  // /freelancer/:slug and 404. getDashboardRoute() overrides this for freelancers;
  // the profile editor is the safe fallback if anything reads the map directly.
  FREELANCER: '/freelancer/profile',
  BRAND: '/brand/dashboard',
  ADMIN: '/admin/dashboard',
};

/**
 * Role onboarding routes (only some roles have onboarding)
 */
export const ROLE_ONBOARDING: Partial<Record<Role, string>> = {
  INFLUENCER: '/influencer/onboarding',
};

/**
 * Get the dashboard route for a given role
 */
/**
 * Where a role lands after login / on "Dashboard".
 *
 * A freelancer's dashboard IS their public profile page, so it resolves to
 * /freelancer/{publicId}. Until they've saved a profile (no id yet) they're
 * sent to the editor instead. Pass `freelancerSlug` from UserContext.
 */
export function getDashboardRoute(role: Role | null, freelancerSlug?: string | null): string {
  if (!role) return '/';
  if (role === Role.FREELANCER) {
    return freelancerSlug ? `/f/${freelancerSlug}` : FREELANCER_PROFILE_EDITOR;
  }
  return ROLE_DASHBOARDS[role] || '/';
}

/** The freelancer's profile editor (where they build the public page). */
export const FREELANCER_PROFILE_EDITOR = '/freelancer/profile';

/**
 * Get the onboarding route for a given role (if applicable)
 */
export function getOnboardingRoute(role: Role | null): string | null {
  if (!role) return null;
  return ROLE_ONBOARDING[role] || null;
}

/**
 * Get the route prefix for a given role
 */
export function getRolePrefix(role: Role | null): string {
  if (!role) return '';
  return ROLE_PREFIXES[role] || '';
}

/**
 * Build a role-prefixed route
 * @param role - The user's active role
 * @param path - The path without role prefix (e.g., '/platforms')
 * @returns The full path with role prefix (e.g., '/influencer/platforms')
 */
export function buildRoleRoute(role: Role | null, path: string): string {
  if (!role) return path;
  const prefix = ROLE_PREFIXES[role];
  // Remove leading slash from path if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${prefix}/${cleanPath}`;
}

/**
 * Extract the role from a URL path
 * @param pathname - The current URL pathname
 * @returns The role if found in path, null otherwise
 */
export function extractRoleFromPath(pathname: string): Role | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  
  const roleSegment = parts[0].toUpperCase();
  if (roleSegment in Role) {
    return roleSegment as Role;
  }
  return null;
}

/**
 * Check if a path belongs to a specific role
 */
export function pathBelongsToRole(pathname: string, role: Role): boolean {
  const prefix = ROLE_PREFIXES[role];
  return pathname.startsWith(prefix);
}
