"use client";

/**
 * AddRoleModal — Modal for adding a new role to user account
 * 
 * Shows available roles that haven't been assigned yet.
 * Calls POST /api/user/roles to add the selected role.
 */

import React, { useState } from 'react';
import { useUser } from '../../context/UserContext';
import { useUI } from '../../context/UIContext';
import { Role } from '../../api/types';
import { getDashboardRoute } from '../../utils/roleRoutes';
import '../../styles/components/AddRoleModal.css';

interface AddRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignedRoles: Set<Role>;
}

interface RoleOption {
  role: Role;
  label: string;
  icon: string;
  description: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: Role.INFLUENCER,
    label: 'Influencer',
    icon: '🎬',
    description: 'Create content and grow your social media presence',
  },
  {
    role: Role.FREELANCER,
    label: 'Freelancer',
    icon: '💼',
    description: 'Offer your skills and services to businesses',
  },
  {
    role: Role.BRAND,
    label: 'Brand',
    icon: '🏢',
    description: 'Connect with influencers and freelancers for campaigns',
  },
];

const AddRoleModal: React.FC<AddRoleModalProps> = ({ isOpen, onClose, assignedRoles }) => {
  const { user, addNewRole } = useUser();
  const { showToast } = useUI();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  if (!isOpen) return null;

  // Filter out already assigned roles
  const availableRoles = ROLE_OPTIONS.filter(option => !assignedRoles.has(option.role));

  const handleAddRole = async () => {
    if (!selectedRole || isLoading) return;

    setIsLoading(true);
    try {
      const newRole = await addNewRole(selectedRole);
      if (newRole) {
        showToast(`${ROLE_OPTIONS.find(r => r.role === selectedRole)?.label || selectedRole} role added successfully!`, 'success');
        onClose();
        // Use window.location.replace for full page reload with fresh state
        // This ensures route guards read the updated onboarding status from localStorage
        const targetRoute = getDashboardRoute(selectedRole, user?.freelancerSlug);
        window.location.replace(targetRoute);
      } else {
        showToast('Failed to add role. Please try again.', 'error');
      }
    } catch (error) {
      console.error('[AddRoleModal] Error adding role:', error);
      showToast('An error occurred while adding the role.', 'error');
    } finally {
      // Don't set isLoading to false as page will reload
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="vx-add-role-modal-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-role-modal-title"
    >
      <div className="vx-add-role-modal">
        <header className="vx-add-role-modal__header">
          <h2 id="add-role-modal-title" className="vx-add-role-modal__title">Add a New Role</h2>
          <button 
            className="vx-add-role-modal__close" 
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="vx-add-role-modal__body">
          {availableRoles.length === 0 ? (
            <p className="vx-add-role-modal__empty">You've already added all available roles.</p>
          ) : (
            <>
              <p className="vx-add-role-modal__description">
                Select a role to add to your account. You can switch between roles anytime.
              </p>
              <div className="vx-add-role-modal__options">
                {availableRoles.map((option) => (
                  <button
                    key={option.role}
                    type="button"
                    className={`vx-add-role-modal__option ${selectedRole === option.role ? 'vx-add-role-modal__option--selected' : ''}`}
                    onClick={() => setSelectedRole(option.role)}
                    disabled={isLoading}
                  >
                    <span className="vx-add-role-modal__option-icon">{option.icon}</span>
                    <div className="vx-add-role-modal__option-content">
                      <span className="vx-add-role-modal__option-label">{option.label}</span>
                      <span className="vx-add-role-modal__option-description">{option.description}</span>
                    </div>
                    <span className="vx-add-role-modal__option-check">
                      {selectedRole === option.role && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <footer className="vx-add-role-modal__footer">
          <button 
            type="button" 
            className="vx-add-role-modal__btn vx-add-role-modal__btn--cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          {availableRoles.length > 0 && (
            <button 
              type="button" 
              className="vx-add-role-modal__btn vx-add-role-modal__btn--confirm"
              onClick={handleAddRole}
              disabled={!selectedRole || isLoading}
            >
              {isLoading ? (
                <>
                  <span className="vx-add-role-modal__spinner" />
                  Adding...
                </>
              ) : (
                'Add Role'
              )}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default AddRoleModal;
