"use client";

/**
 * DashboardLayout — Layout with sidebar for authenticated pages
 * 
 * Used for all pages after onboarding is complete.
 * Includes a mobile-only topbar with burger menu, logo, and RoleSwitcher.
 * Mobile drawer provides navigation on smaller screens.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Link, useLocation } from '@/lib/router';
import Sidebar from './Sidebar';
import RoleSwitcher from '../common/RoleSwitcher';
import VoxlaeLogo from '../common/VoxlaeLogo';
import RoleSetupGate from '../setup/RoleSetupGate';
import { useUser } from '../../context/UserContext';
import { Role } from '../../api/types';
import { buildRoleRoute } from '../../utils/roleRoutes';
import '../../styles/components/DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Desktop sidebar width is user-adjustable (drag the edge). Bounds keep it usable
// on any screen; the chosen width persists across sessions.
const SIDEBAR_MIN_WIDTH = 208;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 260;
const SIDEBAR_WIDTH_KEY = 'vx:sidebarWidth';

const clampSidebarWidth = (w: number) =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(w)));

// ─────────────────────────────────────────────────────────────
// Mobile Drawer Navigation Items
// ─────────────────────────────────────────────────────────────

/** A drawer entry. A group has children and no route of its own. */
interface MobileNavItem {
  path?: string;
  groupKey?: string;
  label: string;
  icon: React.ReactNode;
  /** `path` is a site path (e.g. /admin), not relative to the active role. */
  absolute?: boolean;
  children?: MobileNavItem[];
}

/**
 * Burger-drawer nav items — surfaces that aren't in the mobile bottom bar.
 * For influencers: the "Creator Tools" group (mirroring the desktop sidebar); the bottom bar carries Home, My Platforms, Trends, Brands,
 * Freelancers and Settings.
 */
const ADMIN_NAV_ITEM: MobileNavItem = {
  path: '/admin',
  absolute: true,
  label: 'Admin',
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};

/** Admins get an Admin entry in every role's drawer, mirroring the desktop sidebar. */
const getMobileNavItems = (activeRole: Role | null, isAdmin: boolean): MobileNavItem[] => {
  const items = getRoleMobileNavItems(activeRole);
  return isAdmin ? [...items, ADMIN_NAV_ITEM] : items;
};

const getRoleMobileNavItems = (activeRole: Role | null): MobileNavItem[] => {
  if (activeRole === Role.INFLUENCER) {
    return [
      {
        groupKey: 'creator-tools',
        label: 'Creator Tools',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        ),
        children: [
          {
            // Automations lives under Creator Tools (mirrors the desktop sidebar) rather than
            // as a separate top-level drawer group.
            path: 'automations',
            label: 'Automations',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M12 7v3l2 1" />
              </svg>
            ),
          },
        ],
      },
    ];
  }
  // Other roles can be added here
  return [];
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

// Launcher pages own the full width, so the sidebar auto-collapses to its icon
// rail here (desktop). Leaving the page restores the user's own preference.
const LAUNCHER_PATHS = ['/influencer/dashboard', '/influencer/creator-tools'];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // The user's own collapse preference — restored whenever they leave a launcher page.
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { activeRole, isAdmin } = useUser();
  const location = useLocation();

  const isLauncherPage = LAUNCHER_PATHS.includes(location.pathname);

  // Collapse on launcher pages; elsewhere fall back to the user's preference.
  // Runs on navigation only, so a manual toggle while on a launcher page sticks
  // until the user leaves (we don't fight them).
  useEffect(() => {
    setSidebarCollapsed(isLauncherPage ? true : userCollapsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      // Only non-launcher toggles update the remembered baseline.
      if (!isLauncherPage) setUserCollapsed(next);
      return next;
    });
  }, [isLauncherPage]);

  // ── Resizable desktop sidebar ──────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
    return Number.isFinite(saved) && saved >= SIDEBAR_MIN_WIDTH && saved <= SIDEBAR_MAX_WIDTH
      ? saved
      : SIDEBAR_DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);

  // Persist the chosen width.
  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  // Begin a drag from the sidebar's edge handle.
  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Keyboard nudge for accessibility (arrow keys on the focused handle).
  const nudgeSidebarWidth = useCallback((delta: number) => {
    setSidebarWidth(w => clampSidebarWidth(w + delta));
  }, []);

  // While dragging, follow the pointer (width = distance from the left edge).
  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: PointerEvent) => setSidebarWidth(clampSidebarWidth(e.clientX));
    const onUp = () => setIsResizing(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    // Prevent text selection / cursor flicker across the whole page mid-drag.
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const mobileNavItems = useMemo(() => getMobileNavItems(activeRole, isAdmin), [activeRole, isAdmin]);

  const isActive = useCallback((basePath: string) => {
    const fullPath = basePath.startsWith('/') ? basePath : buildRoleRoute(activeRole, basePath);
    return location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
  }, [activeRole, location.pathname]);

  // Drawer groups the user has explicitly toggled. Untouched groups default to
  // open when one of their children is the current page.
  const [openDrawerGroups, setOpenDrawerGroups] = useState<Record<string, boolean>>({});

  const isDrawerGroupOpen = useCallback((item: MobileNavItem) => {
    const hasActiveChild = !!item.children?.some(c => c.path && isActive(c.path));
    return openDrawerGroups[item.groupKey!] ?? hasActiveChild;
  }, [openDrawerGroups, isActive]);

  const toggleDrawerGroup = useCallback((key: string, currentlyOpen: boolean) => {
    setOpenDrawerGroups(prev => ({ ...prev, [key]: !currentlyOpen }));
  }, []);

  return (
    <div
      className={[
        'vx-dashboard-layout',
        sidebarCollapsed && 'vx-dashboard-layout--collapsed',
        isResizing && 'vx-dashboard-layout--resizing',
      ].filter(Boolean).join(' ')}
      style={{ '--vx-sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      {/* Blocks the app behind the role setup wizard until the active role is set up */}
      <RoleSetupGate />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        onResizeStart={startResize}
        onResizeKey={nudgeSidebarWidth}
      />
      <main className="vx-dashboard-layout__main">
        {/* Mobile-only topbar — visible only on small screens where sidebar becomes bottom nav */}
        <div className="vx-dashboard-layout__mobile-topbar">
          <button 
            className="vx-dashboard-layout__burger"
            onClick={toggleDrawer}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="vx-dashboard-layout__mobile-logo">
            <VoxlaeLogo variant="full" size={24} />
          </div>
          <RoleSwitcher compact />
        </div>

        {/* Mobile Drawer */}
        {drawerOpen && (
          <div className="vx-dashboard-layout__drawer-overlay" onClick={closeDrawer}>
            <nav 
              className="vx-dashboard-layout__drawer" 
              onClick={(e) => e.stopPropagation()}
              role="navigation"
              aria-label="Mobile navigation"
            >
              <div className="vx-dashboard-layout__drawer-header">
                <VoxlaeLogo variant="full" size={28} />
                <button 
                  className="vx-dashboard-layout__drawer-close"
                  onClick={closeDrawer}
                  aria-label="Close navigation menu"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <ul className="vx-dashboard-layout__drawer-nav">
                {mobileNavItems.map(item => (
                  <li key={item.groupKey ?? item.path}>
                    {item.children?.length ? (
                      <div className="vx-dashboard-layout__drawer-group">
                        <button
                          type="button"
                          className={`vx-dashboard-layout__drawer-link vx-dashboard-layout__drawer-group-btn ${
                            item.children.some(c => c.path && isActive(c.path))
                              ? 'vx-dashboard-layout__drawer-link--active'
                              : ''
                          }`}
                          onClick={() => toggleDrawerGroup(item.groupKey!, isDrawerGroupOpen(item))}
                          aria-expanded={isDrawerGroupOpen(item)}
                        >
                          <span className="vx-dashboard-layout__drawer-icon">{item.icon}</span>
                          <span>{item.label}</span>
                          <span
                            className={`vx-dashboard-layout__drawer-chevron ${
                              isDrawerGroupOpen(item) ? 'vx-dashboard-layout__drawer-chevron--open' : ''
                            }`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </span>
                        </button>

                        {isDrawerGroupOpen(item) && (
                          <div className="vx-dashboard-layout__drawer-children">
                            {item.children.map(child => (
                              <Link
                                key={child.path}
                                to={buildRoleRoute(activeRole, child.path!)}
                                className={`vx-dashboard-layout__drawer-link ${
                                  isActive(child.path!) ? 'vx-dashboard-layout__drawer-link--active' : ''
                                }`}
                                onClick={closeDrawer}
                              >
                                <span className="vx-dashboard-layout__drawer-icon">{child.icon}</span>
                                <span>{child.label}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Link
                        to={item.absolute ? item.path! : buildRoleRoute(activeRole, item.path!)}
                        className={`vx-dashboard-layout__drawer-link ${isActive(item.path!) ? 'vx-dashboard-layout__drawer-link--active' : ''}`}
                        onClick={closeDrawer}
                      >
                        <span className="vx-dashboard-layout__drawer-icon">{item.icon}</span>
                        <span>{item.label}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        )}

        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
