"use client";

/**
 * UserContext — Global auth & user state
 *
 * Tracks:
 *  - user profile info (name, email, roles)
 *  - isAuthenticated
 *  - onboardingCompleted (inverse of requiresOnboarding)
 *  - requiresOnboarding (direct flag from API)
 *  - isNewUser (no roles assigned)
 *  - emailVerified
 *  - activeRole (first role by default)
 *
 * Provides login / logout / token helpers.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import api, { scheduleTokenRefresh } from '../api/api';
import { Role, RoleStatus, UserRoleDto, UserMeResponse } from '../api/types';
import { switchRole as switchRoleApi, addRole as addRoleApi } from '../api/services';

export interface User {
  name: string;
  email: string;
  roles: UserRoleDto[];
  activeRole: Role | null;
  emailVerified: boolean;
  isNewUser: boolean;
  /** Public profile id for freelancers — their page is /freelancer/{slug}. */
  freelancerSlug?: string | null;
  /** From /auth/me. Decides what the UI shows only — admin APIs re-check on the server. */
  isAdmin?: boolean;
}

interface UserContextValue {
  user: User | null;
  isAuthenticated: boolean;
  /** True while the initial auth state is being hydrated from localStorage.
   *  Route guards must render nothing (null) during this window to avoid
   *  false-positive redirects on page refresh. */
  isAuthLoading: boolean;
  onboardingCompleted: boolean;
  requiresOnboarding: boolean;
  isNewUser: boolean;
  emailVerified: boolean;
  roles: UserRoleDto[];
  activeRole: Role | null;
  activeRoleStatus: RoleStatus;
  login: (name: string, email: string, accessToken?: string, extraData?: Partial<User>) => void;
  logout: () => void;
  setOnboardingCompleted: (v: boolean) => void;
  setIsNewUser: (v: boolean) => void;
  setEmailVerified: (v: boolean) => void;
  setRoles: (roles: UserRoleDto[]) => void;
  setActiveRole: (role: Role) => void;
  switchActiveRole: (role: Role) => Promise<boolean>;
  addNewRole: (role: Role) => Promise<UserRoleDto | null>;
  getAccessToken: () => string | null;
  refreshUserProfile: () => Promise<void>;
  /** Admin (see `identity/access.ts`). UI only — never a security boundary on its own. */
  isAdmin: boolean;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingCompleted, setOnboardingCompletedState] = useState(false);
  // Starts true; set to false once localStorage hydration is done so that
  // route guards don't fire redirects before auth state is known.
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  /* Hydrate from localStorage on mount, then validate session liveness */
  useEffect(() => {
    const name = localStorage.getItem('userName');
    const email = localStorage.getItem('email');
    const accessToken = localStorage.getItem('accessToken');
    const requiresOnboarding = localStorage.getItem('requiresOnboarding');
    const storedRoles = localStorage.getItem('userRoles');
    const storedIsNewUser = localStorage.getItem('isNewUser');
    const storedEmailVerified = localStorage.getItem('emailVerified');
    const storedActiveRole = localStorage.getItem('activeRole');

    // Refresh token lives exclusively in the HttpOnly cookie — only trust accessToken here
    if (name && email && accessToken) {
      const roles: UserRoleDto[] = storedRoles ? JSON.parse(storedRoles) : [];
      const isNewUser = storedIsNewUser === 'true';
      const emailVerified = storedEmailVerified === 'true';
      const activeRole = storedActiveRole ? (storedActiveRole as Role) : (roles.length > 0 ? roles[0].role : null);
      
      setUser({
        name,
        email,
        roles,
        activeRole,
        emailVerified,
        isNewUser,
        freelancerSlug: localStorage.getItem('freelancerSlug'),
        // Cached from the last /auth/me so admin-only nav renders with everything else instead of
        // popping in after the probe returns. Display only — the server re-checks on every admin call.
        isAdmin: localStorage.getItem('isAdmin') === 'true',
      });
      setIsAuthenticated(true);
      setOnboardingCompletedState(requiresOnboarding === 'false');

      // Arm the silent pre-expiry refresh for the currently stored token
      scheduleTokenRefresh(accessToken);

      // Probe the backend to confirm the session is alive and get fresh user data
      api.get<UserMeResponse>('/auth/me')
        .then((response) => {
          // Update user state with fresh data from backend
          const freshRoles = response.roles || [];
          // Use activeRole from backend if available, otherwise use first role
          const freshActiveRole = response.activeRole || (freshRoles.length > 0 ? freshRoles[0].role : null);
          const freshUser: User = {
            name: response.name || name,
            email: response.email,
            roles: freshRoles,
            activeRole: freshActiveRole,
            emailVerified: response.emailVerified,
            isNewUser: response.isNewUser,
            freelancerSlug: response.freelancerSlug ?? null,
            isAdmin: response.isAdmin === true,
          };
          setUser(freshUser);
          setOnboardingCompletedState(response.onboardingCompleted);

          // Persist to localStorage
          if (response.name) localStorage.setItem('userName', response.name);
          localStorage.setItem('userRoles', JSON.stringify(freshRoles));
          localStorage.setItem('isNewUser', String(response.isNewUser));
          localStorage.setItem('emailVerified', String(response.emailVerified));
          localStorage.setItem('requiresOnboarding', String(!response.onboardingCompleted));
          if (freshActiveRole) {
            localStorage.setItem('activeRole', freshActiveRole);
          }
          localStorage.setItem('isAdmin', String(response.isAdmin === true));
          if (response.freelancerSlug) {
            localStorage.setItem('freelancerSlug', response.freelancerSlug);
          } else {
            localStorage.removeItem('freelancerSlug');
          }
        })
        .catch(() => {
          // clearAuthAndRedirect() was already called inside fetchApi on total failure
        });
    }
    // Auth hydration is complete — guards may now render
    setIsAuthLoading(false);
  }, []);

  const login = useCallback((name: string, email: string, accessToken?: string, extraData?: Partial<User>) => {
    const roles = extraData?.roles || [];
    const activeRole = extraData?.activeRole || (roles.length > 0 ? roles[0].role : null);
    const newUser: User = {
      name,
      email,
      roles,
      activeRole,
      emailVerified: extraData?.emailVerified ?? false,
      isNewUser: extraData?.isNewUser ?? true,
    };
    
    setUser(newUser);
    setIsAuthenticated(true);
    localStorage.setItem('userName', name);
    localStorage.setItem('email', email);
    localStorage.setItem('userRoles', JSON.stringify(roles));
    localStorage.setItem('isNewUser', String(newUser.isNewUser));
    localStorage.setItem('emailVerified', String(newUser.emailVerified));
    if (activeRole) {
      localStorage.setItem('activeRole', activeRole);
    }
    
    if (accessToken) {
      localStorage.setItem('accessToken', accessToken);
      // Arm silent pre-expiry refresh for the newly issued token
      scheduleTokenRefresh(accessToken);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    setOnboardingCompletedState(false);
    localStorage.removeItem('userName');
    localStorage.removeItem('email');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('requiresOnboarding');
    localStorage.removeItem('userRoles');
    localStorage.removeItem('isNewUser');
    localStorage.removeItem('emailVerified');
    localStorage.removeItem('activeRole');
    localStorage.removeItem('freelancerSlug');
    localStorage.removeItem('isAdmin');
  }, []);

  const setOnboardingCompleted = useCallback((v: boolean) => {
    setOnboardingCompletedState(v);
    localStorage.setItem('requiresOnboarding', JSON.stringify(!v));
  }, []);

  const setIsNewUser = useCallback((v: boolean) => {
    setUser(prev => prev ? { ...prev, isNewUser: v } : null);
    localStorage.setItem('isNewUser', String(v));
  }, []);

  const setEmailVerified = useCallback((v: boolean) => {
    setUser(prev => prev ? { ...prev, emailVerified: v } : null);
    localStorage.setItem('emailVerified', String(v));
  }, []);

  const setRoles = useCallback((roles: UserRoleDto[]) => {
    setUser(prev => {
      if (!prev) return null;
      return {
        ...prev,
        roles,
        activeRole: roles.length > 0 ? roles[0].role : null,
        isNewUser: roles.length === 0,
      };
    });
    localStorage.setItem('userRoles', JSON.stringify(roles));
    localStorage.setItem('isNewUser', String(roles.length === 0));
  }, []);

  const setActiveRole = useCallback((role: Role) => {
    setUser(prev => prev ? { ...prev, activeRole: role } : null);
    localStorage.setItem('activeRole', role);
  }, []);

  /**
   * Switch active role via backend API
   * Updates both backend and local state
   * Fetches fresh user profile to get correct onboarding status for new role
   * Returns true if successful, false otherwise
   */
  const switchActiveRole = useCallback(async (role: Role): Promise<boolean> => {
    try {
      const response = await switchRoleApi({ role });
      if (response.success) {
        // Fetch fresh user profile to get correct onboarding status for the new role
        // Do this BEFORE updating any state to ensure we have accurate data
        const freshProfile = await api.get<UserMeResponse>('/auth/me');
        const freshRoles = freshProfile.roles || [];
        
        // Update localStorage FIRST (synchronously)
        localStorage.setItem('activeRole', freshProfile.activeRole || response.activeRole);
        localStorage.setItem('userRoles', JSON.stringify(freshRoles));
        localStorage.setItem('isNewUser', String(freshProfile.isNewUser));
        localStorage.setItem('emailVerified', String(freshProfile.emailVerified));
        localStorage.setItem('requiresOnboarding', String(!freshProfile.onboardingCompleted));
        
        // Now update React state
        const freshUser: User = {
          name: freshProfile.name || user?.name || '',
          email: freshProfile.email,
          roles: freshRoles,
          activeRole: freshProfile.activeRole || response.activeRole,
          emailVerified: freshProfile.emailVerified,
          isNewUser: freshProfile.isNewUser,
          isAdmin: freshProfile.isAdmin === true,
        };
        setUser(freshUser);
        setOnboardingCompletedState(freshProfile.onboardingCompleted);
        
        // Wait for React to process state updates before returning
        // This prevents navigation from happening before state is ready
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return true;
      }
      console.error('[UserContext] Role switch failed:', response.message);
      return false;
    } catch (error) {
      console.error('[UserContext] Failed to switch role:', error);
      return false;
    }
  }, [user?.name]);

  /**
   * Add a new role to the user via backend API
   * Updates both backend and local state, switches to the new role
   * Fetches fresh user profile to get correct onboarding status for new role
   * Returns the new UserRoleDto if successful, null otherwise
   */
  const addNewRole = useCallback(async (role: Role): Promise<UserRoleDto | null> => {
    try {
      const newRoleDto = await addRoleApi({ role });
      
      // Switch to the new role in the backend (synchronize activeRole)
      await switchRoleApi({ role: newRoleDto.role });
      
      // Fetch fresh user profile to get correct onboarding status for the new role
      // Do this BEFORE updating any state to ensure we have accurate data
      const freshProfile = await api.get<UserMeResponse>('/auth/me');
      const freshRoles = freshProfile.roles || [];
      
      // Update localStorage FIRST (synchronously)
      localStorage.setItem('userRoles', JSON.stringify(freshRoles));
      localStorage.setItem('activeRole', freshProfile.activeRole || newRoleDto.role);
      localStorage.setItem('isNewUser', String(freshProfile.isNewUser));
      localStorage.setItem('emailVerified', String(freshProfile.emailVerified));
      localStorage.setItem('requiresOnboarding', String(!freshProfile.onboardingCompleted));
      
      // Now update React state
      const freshUser: User = {
        name: freshProfile.name || user?.name || '',
        email: freshProfile.email,
        roles: freshRoles,
        activeRole: freshProfile.activeRole || newRoleDto.role,
        emailVerified: freshProfile.emailVerified,
        isNewUser: freshProfile.isNewUser,
        isAdmin: freshProfile.isAdmin === true,
      };
      setUser(freshUser);
      setOnboardingCompletedState(freshProfile.onboardingCompleted);
      
      // Wait for React to process state updates before returning
      // This prevents navigation from happening before state is ready
      await new Promise(resolve => setTimeout(resolve, 50));
      
      return newRoleDto;
    } catch (error) {
      console.error('[UserContext] Failed to add role:', error);
      return null;
    }
  }, [user?.name]);

  const getAccessToken = useCallback((): string | null => {
    return localStorage.getItem('accessToken');
  }, []);

  const refreshUserProfile = useCallback(async () => {
    try {
      const response = await api.get<UserMeResponse>('/auth/me');
      const freshRoles = response.roles || [];
      const freshActiveRole = response.activeRole || (freshRoles.length > 0 ? freshRoles[0].role : null);
      const freshUser: User = {
        name: response.name || user?.name || '',
        email: response.email,
        roles: freshRoles,
        activeRole: freshActiveRole,
        emailVerified: response.emailVerified,
        isNewUser: response.isNewUser,
        freelancerSlug: response.freelancerSlug ?? null,
        isAdmin: response.isAdmin === true,
      };
      setUser(freshUser);
      setOnboardingCompletedState(response.onboardingCompleted);

      // Persist to localStorage
      if (response.name) localStorage.setItem('userName', response.name);
      localStorage.setItem('userRoles', JSON.stringify(freshRoles));
      if (freshActiveRole) {
        localStorage.setItem('activeRole', freshActiveRole);
      }
      localStorage.setItem('isNewUser', String(response.isNewUser));
      localStorage.setItem('emailVerified', String(response.emailVerified));
      localStorage.setItem('requiresOnboarding', String(!response.onboardingCompleted));
      localStorage.setItem('isAdmin', String(response.isAdmin === true));
      // Minted on first profile save — keeps the Dashboard link in sync immediately
      if (response.freelancerSlug) {
        localStorage.setItem('freelancerSlug', response.freelancerSlug);
      } else {
        localStorage.removeItem('freelancerSlug');
      }
    } catch (error) {
      console.error('[UserContext] Failed to refresh user profile:', error);
    }
  }, [user?.name]);

  const requiresOnboarding = isAuthenticated && !onboardingCompleted;
  const isNewUser = user?.isNewUser ?? false;
  const emailVerified = user?.emailVerified ?? false;
  const roles = user?.roles ?? [];
  const activeRole = user?.activeRole ?? null;
  // isAuthLoading is declared above as state

  // Derive active role status from roles array
  const activeRoleStatus = useMemo(() => {
    if (!activeRole || roles.length === 0) return RoleStatus.INCOMPLETE;
    const activeRoleDto = roles.find(r => r.role === activeRole);
    return activeRoleDto?.status ?? RoleStatus.INCOMPLETE;
  }, [roles, activeRole]);

  const value = useMemo<UserContextValue>(() => ({
    user,
    isAuthenticated,
    isAuthLoading,
    onboardingCompleted,
    requiresOnboarding,
    isNewUser,
    emailVerified,
    roles,
    activeRole,
    activeRoleStatus,
    login,
    logout,
    setOnboardingCompleted,
    setIsNewUser,
    setEmailVerified,
    setRoles,
    setActiveRole,
    switchActiveRole,
    addNewRole,
    getAccessToken,
    refreshUserProfile,
    isAdmin: user?.isAdmin === true,
  }), [
    user, 
    isAuthenticated,
    isAuthLoading,
    onboardingCompleted, 
    requiresOnboarding, 
    isNewUser,
    emailVerified,
    roles,
    activeRole,
    activeRoleStatus,
    login, 
    logout, 
    setOnboardingCompleted, 
    setIsNewUser,
    setEmailVerified,
    setRoles,
    setActiveRole,
    switchActiveRole,
    addNewRole,
    getAccessToken,
    refreshUserProfile,
  ]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextValue => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
};

export default UserContext;
