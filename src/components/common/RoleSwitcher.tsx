"use client";

/**
 * RoleSwitcher — Dropdown component for switching active role
 * 
 * Displays current active role and allows switching between available roles.
 * Shows all roles including incomplete ones with status indicator.
 * Includes "Add Role" option to add new roles.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../../context/UserContext';
import { Role, RoleStatus } from '../../api/types';
import { getDashboardRoute } from '../../utils/roleRoutes';
import AddRoleModal from './AddRoleModal';
import '../../styles/components/RoleSwitcher.css';

interface RoleSwitcherProps {
  /** Compact mode for navbar - shows smaller UI */
  compact?: boolean;
  /** Dark mode - for use on dark backgrounds */
  darkMode?: boolean;
}

const ROLE_LABELS: Record<Role, string> = {
  INFLUENCER: 'Influencer',
  FREELANCER: 'Freelancer',
  BRAND: 'Brand',
  ADMIN: 'Admin',
};

const ROLE_ICONS: Record<Role, string> = {
  INFLUENCER: '🎬',
  FREELANCER: '💼',
  BRAND: '🏢',
  ADMIN: '⚙️',
};

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ 
  compact = false, 
  darkMode = false 
}) => {
  const { user, roles, activeRole, switchActiveRole } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Get all user roles (including incomplete)
  const userRoles = roles;
  
  // Check which roles are already assigned
  const assignedRoles = new Set(userRoles.map(r => r.role));
  
  // Check if user can add more roles (exclude ADMIN from addable roles)
  const addableRoles = [Role.INFLUENCER, Role.FREELANCER, Role.BRAND].filter(r => !assignedRoles.has(r));
  const canAddRole = addableRoles.length > 0;

  // Don't show if user has no active role
  if (!activeRole) {
    return null;
  }

  const handleRoleSwitch = async (newRole: Role) => {
    if (newRole === activeRole || isSwitching) return;

    setIsSwitching(true);
    try {
      const success = await switchActiveRole(newRole);
      if (success) {
        setIsOpen(false);
        // Use window.location.replace for full page reload with fresh state
        // This ensures route guards read the updated onboarding status from localStorage
        const targetRoute = getDashboardRoute(newRole, user?.freelancerSlug);
        window.location.replace(targetRoute);
      }
    } finally {
      // Don't set isSwitching to false as page will reload
    }
  };

  const handleAddRoleClick = () => {
    setIsOpen(false);
    setShowAddRoleModal(true);
  };

  const currentLabel = ROLE_LABELS[activeRole] || activeRole;
  const currentIcon = ROLE_ICONS[activeRole] || '👤';

  return (
    <>
      <div 
        ref={dropdownRef} 
        className={`vx-role-switcher ${compact ? 'vx-role-switcher--compact' : ''} ${darkMode ? 'vx-role-switcher--dark' : ''} ${isOpen ? 'vx-role-switcher--open' : ''}`}
      >
        <button
          type="button"
          className="vx-role-switcher__trigger"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isSwitching}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="vx-role-switcher__icon">{currentIcon}</span>
          <span className="vx-role-switcher__label">{currentLabel}</span>
          <span className={`vx-role-switcher__chevron ${isOpen ? 'vx-role-switcher__chevron--up' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </button>

        {isOpen && (
          <div className="vx-role-switcher__dropdown" role="listbox">
            <div className="vx-role-switcher__dropdown-header">
              Switch Role
            </div>
            {userRoles.map((roleDto) => {
              const role = roleDto.role;
              const isActive = role === activeRole;
              const isIncomplete = roleDto.status === RoleStatus.INCOMPLETE;
              return (
                <button
                  key={role}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`vx-role-switcher__option ${isActive ? 'vx-role-switcher__option--active' : ''} ${isIncomplete ? 'vx-role-switcher__option--incomplete' : ''}`}
                  onClick={() => handleRoleSwitch(role)}
                  disabled={isSwitching}
                >
                  <span className="vx-role-switcher__option-icon">{ROLE_ICONS[role]}</span>
                  <span className="vx-role-switcher__option-content">
                    <span className="vx-role-switcher__option-label">{ROLE_LABELS[role]}</span>
                    {isIncomplete && (
                      <span className="vx-role-switcher__option-status">Incomplete</span>
                    )}
                  </span>
                  {isActive && (
                    <span className="vx-role-switcher__option-check">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
            
            {/* Add Role Option */}
            {canAddRole && (
              <>
                <div className="vx-role-switcher__divider" />
                <button
                  type="button"
                  className="vx-role-switcher__option vx-role-switcher__option--add"
                  onClick={handleAddRoleClick}
                >
                  <span className="vx-role-switcher__option-icon">➕</span>
                  <span className="vx-role-switcher__option-label">Add Role</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Add Role Modal */}
      <AddRoleModal
        isOpen={showAddRoleModal}
        onClose={() => setShowAddRoleModal(false)}
        assignedRoles={assignedRoles}
      />
    </>
  );
};

export default RoleSwitcher;
