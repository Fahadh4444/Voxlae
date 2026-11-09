"use client";

/**
 * Sidebar — Main navigation sidebar (Rebuilt)
 * 
 * Navigation:
 * - Home (Growth Command Center)
 * - My Platforms
 * - Trends (locked indicator based on gamification)
 * - Brands (locked indicator based on gamification)
 * - Account
 * 
 * Preserves auth logout logic.
 * Integrates gamification context for lock status.
 * Uses role-based routing.
 */

import React, { useMemo, useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from '@/lib/router';
import { useUser } from '../../context/UserContext';
import { logout } from '../../api/services';
import { useUI } from '../../context/UIContext';
import { Role } from '../../api/types';
import { getDashboardRoute, buildRoleRoute } from '../../utils/roleRoutes';
import VoxlaeLogo from '../common/VoxlaeLogo';
import RoleSwitcher from '../common/RoleSwitcher';
import { FEATURES } from '../../config/features';
import '../../styles/components/Sidebar.css';

/** A nav entry before role-prefixing. A `group` has children and no route of its own. */
interface NavItemDef {
  basePath?: string;
  groupKey?: string;
  label: string;
  icon: React.ReactNode;
  locked?: boolean;
  isShared?: boolean;
  hideOnMobile?: boolean;
  /**
   * Shown only to admins (`isAdmin` from /auth/me). Mark any item with it to keep it from end users;
   * the page behind it should also sit in an `AdminGuard`, and its API in `requireAdmin`.
   */
  adminOnly?: boolean;
  children?: NavItemDef[];
}

/** A nav entry with its final, role-prefixed path resolved. */
interface NavItem {
  key: string;
  path: string;
  label: string;
  icon: React.ReactNode;
  locked?: boolean;
  hideOnMobile?: boolean;
  children?: NavItem[];
}

/**
 * Base nav items for Influencers (without role prefix)
 * Paths will be prefixed based on active role
 */
const influencerNavItems: NavItemDef[] = [
  {
    basePath: 'dashboard',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    basePath: 'platforms',
    label: 'My Platforms',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    groupKey: 'creator-tools',
    basePath: 'creator-tools', // Resolves to the Creator Tools hub — used when collapsed.
    label: 'Creator Tools',
    hideOnMobile: true, // Lives in the mobile burger drawer; bottom bar stays uncluttered
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    children: [
      {
        // Nested group: Creator Tools ▸ Automations ▸ Instagram DM Automations
        groupKey: 'automations',
        label: 'Automations',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M12 7v3l2 1" />
          </svg>
        ),
        children: [
          {
            basePath: 'automations',
            label: 'Instagram DM',
            // Shows a "Soon" badge until the Meta app is Live (see FEATURES.automations).
            locked: !FEATURES.automations,
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
              </svg>
            ),
          },
        ],
      },
    ],
  },
  {
    basePath: 'freelancers',
    label: 'Freelancers',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    basePath: 'trends',
    label: 'Trends',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    basePath: 'brands',
    label: 'Brands',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
];

/**
 * Nav items for Freelancers
 */
const freelancerNavItems: NavItemDef[] = [
  {
    // A freelancer's profile IS their dashboard — one page, one nav item.
    // "Dashboard" and "My Profile" used to be two entries for the same thing.
    basePath: 'dashboard',
    label: 'My Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    // Pick the artistic template for the public profile at /freelancer/{slug}.
    basePath: 'templates',
    label: 'Profile Templates',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

/**
 * Nav items for Brands
 */
const brandNavItems: NavItemDef[] = [
  {
    basePath: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    basePath: 'profile',
    label: 'Company Profile',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    basePath: 'influencers',
    label: 'Find Influencers',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
];

/**
 * Shared nav items (available to all roles)
 */
const sharedNavItems: NavItemDef[] = [
  {
    basePath: '/admin',
    label: 'Admin',
    isShared: true,
    adminOnly: true,
    hideOnMobile: true, // Keeps the bottom bar for end-user items; reach it at /admin on a phone.
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    basePath: '/account',
    label: 'Settings',
    isShared: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  /** Begin a drag-to-resize from the sidebar's edge handle (desktop only). */
  onResizeStart?: (e: React.PointerEvent) => void;
  /** Keyboard width nudge (px delta) when the resize handle is focused. */
  onResizeKey?: (delta: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggle, onResizeStart, onResizeKey }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout: logoutUser, activeRole, isAdmin } = useUser();
  const { showToast } = useUI();

  // Get role-specific nav items
  const getRoleNavItems = useCallback(() => {
    switch (activeRole) {
      case Role.FREELANCER:
        return freelancerNavItems;
      case Role.BRAND:
        return brandNavItems;
      case Role.INFLUENCER:
      default:
        return influencerNavItems;
    }
  }, [activeRole]);

  // Build nav items with role-prefixed paths
  const navItems: NavItem[] = useMemo(() => {
    const allItems: NavItemDef[] = [...getRoleNavItems(), ...sharedNavItems];

    // Shared routes (like /account) are absolute; role routes get a role prefix.
    const resolvePath = (item: NavItemDef): string => {
      if (!item.basePath) return '';
      if (item.isShared) return item.basePath;
      // A freelancer's "Dashboard" IS their public profile page, so it links
      // straight to /freelancer/{publicId} — no intermediate dashboard route.
      if (activeRole === Role.FREELANCER && item.basePath === 'dashboard') {
        return getDashboardRoute(Role.FREELANCER, user?.freelancerSlug);
      }
      return activeRole
        ? buildRoleRoute(activeRole, item.basePath)
        : `/influencer/${item.basePath}`;
    };

    const toNavItem = (item: NavItemDef): NavItem => ({
      key: item.groupKey ?? item.basePath ?? item.label,
      path: resolvePath(item),
      label: item.label,
      icon: item.icon,
      locked: item.locked,
      hideOnMobile: item.hideOnMobile,
      children: item.children?.map(toNavItem),
    });

    const visible = (items: NavItemDef[]): NavItemDef[] =>
      items
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => (item.children ? { ...item, children: visible(item.children) } : item));

    return visible(allItems).map(toNavItem);
  }, [activeRole, getRoleNavItems, user?.freelancerSlug, isAdmin]);

  const dynamicNavItems = navItems;

  const isPathActive = useCallback(
    (path: string) =>
      !!path && (location.pathname === path || location.pathname.startsWith(path + '/')),
    [location.pathname]
  );

  // Groups the user has explicitly toggled. Untouched groups fall back to
  // "open when one of their children is the current page".
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string, openByDefault: boolean) =>
    setOpenGroups(prev => ({ ...prev, [key]: !(prev[key] ?? openByDefault) }));

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.warn('Logout API call failed', e);
    }
    logoutUser();
    showToast('Logged out successfully', 'success');
    navigate('/');
  };

  const classes = [
    'vx-sidebar',
    collapsed && 'vx-sidebar--collapsed',
  ].filter(Boolean).join(' ');

  // Get dashboard route for logo link
  const dashboardRoute = getDashboardRoute(activeRole, user?.freelancerSlug);

  return (
    <aside className={classes}>
      {/* Logo */}
      <div className="vx-sidebar__header">
        {collapsed && onToggle ? (
          /* Collapsed: the toggle button is hidden, so the logo becomes the way
             back out — clicking it expands the sidebar instead of navigating. */
          <button
            type="button"
            className="vx-sidebar__logo vx-sidebar__logo--expand"
            onClick={onToggle}
            aria-label="Expand sidebar"
            aria-expanded={false}
            title="Expand sidebar"
          >
            <VoxlaeLogo size={24} variant="icon" />
            <span className="vx-sidebar__logo-expand-hint" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </button>
        ) : (
          <Link to={dashboardRoute} className="vx-sidebar__logo">
            <VoxlaeLogo size={28} variant="full" />
          </Link>
        )}
        {onToggle && (
          <button className="vx-sidebar__toggle" onClick={onToggle} aria-label="Collapse sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed ? (
                <polyline points="9 18 15 12 9 6" />
              ) : (
                <polyline points="15 18 9 12 15 6" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="vx-sidebar__nav">
        {(() => {
          const renderLink = (navItem: NavItem, isChild = false, forceActive = false) => {
            const active = forceActive || isPathActive(navItem.path);
            return (
              <Link
                key={navItem.key}
                to={navItem.path}
                className={[
                  'vx-sidebar__link',
                  isChild && 'vx-sidebar__link--child',
                  active && 'vx-sidebar__link--active',
                  navItem.locked && 'vx-sidebar__link--locked',
                  navItem.hideOnMobile && 'vx-sidebar__link--hide-mobile',
                ].filter(Boolean).join(' ')}
                title={collapsed ? navItem.label : undefined}
              >
                <span className="vx-sidebar__link-icon">{navItem.icon}</span>
                {!collapsed && (
                  <>
                    <span className="vx-sidebar__link-label">{navItem.label}</span>
                    {navItem.locked && <span className="vx-sidebar__soon-badge">Soon</span>}
                  </>
                )}
              </Link>
            );
          };

          const hasActiveDescendant = (node: NavItem): boolean =>
            isPathActive(node.path) || !!node.children?.some(hasActiveDescendant);

          // Recursive so a group can contain a group (e.g. Creator Tools ▸ Automations ▸ …).
          const renderNode = (item: NavItem, depth: number): React.ReactNode => {
            // Plain link
            if (!item.children?.length) return renderLink(item, depth > 0);

            // Collapsed rail has no room for group headers. If the group has its own
            // destination (e.g. Creator Tools → its hub page), show its single icon so
            // the rail matches the expanded sidebar. Otherwise fall back to surfacing
            // the group's descendants as icons.
            if (collapsed) {
              if (item.path) return renderLink(item, depth > 0, hasActiveDescendant(item));
              return <React.Fragment key={item.key}>{item.children.map(c => renderNode(c, depth))}</React.Fragment>;
            }

            const hasActiveChild = item.children.some(hasActiveDescendant);
            const isOpen = openGroups[item.key] ?? hasActiveChild;
            const nested = depth > 0;

            return (
              <div
                key={item.key}
                className={[
                  'vx-sidebar__group',
                  nested && 'vx-sidebar__group--nested',
                  item.hideOnMobile && 'vx-sidebar__link--hide-mobile',
                ].filter(Boolean).join(' ')}
              >
                <button
                  type="button"
                  className={[
                    'vx-sidebar__link vx-sidebar__group-btn',
                    nested && 'vx-sidebar__link--child',
                    hasActiveChild && 'vx-sidebar__link--active',
                  ].filter(Boolean).join(' ')}
                  onClick={() => toggleGroup(item.key, hasActiveChild)}
                  aria-expanded={isOpen}
                >
                  <span className="vx-sidebar__link-icon">{item.icon}</span>
                  <span className="vx-sidebar__link-label">{item.label}</span>
                  <span className={`vx-sidebar__chevron ${isOpen ? 'vx-sidebar__chevron--open' : ''}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>

                {isOpen && (
                  <div className="vx-sidebar__group-children">
                    {item.children.map(c => renderNode(c, depth + 1))}
                  </div>
                )}
              </div>
            );
          };

          return dynamicNavItems.map(item => renderNode(item, 0));
        })()}
      </nav>

      {/* Bottom Section */}
      <div className="vx-sidebar__footer">
        {/* Role Switcher */}
        <div className="vx-sidebar__role-switcher">
          <RoleSwitcher />
        </div>

        {/* User Info */}
        {user && (
          <div className="vx-sidebar__user">
            <div className="vx-sidebar__user-avatar">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="vx-sidebar__user-info">
                <span className="vx-sidebar__user-name">{user.name}</span>
                <span className="vx-sidebar__user-email">{user.email}</span>
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <button 
          className="vx-sidebar__logout" 
          onClick={handleLogout}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>

      {/* Drag handle on the right edge — resize the sidebar (desktop, expanded only).
          Focusable so it can also be nudged with the arrow keys. */}
      {!collapsed && onResizeStart && (
        <div
          className="vx-sidebar__resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={0}
          title="Drag to resize"
          onPointerDown={onResizeStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); onResizeKey?.(-16); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); onResizeKey?.(16); }
          }}
        />
      )}
    </aside>
  );
};

export default Sidebar;
