"use client";

/**
 * SelectRolePage — Role selection for new users.
 *
 * First branded surface a new user sees. It's a split stage:
 *  - a Voxlae-orange visual panel whose animated SVG scene changes to match the
 *    hovered/selected role (the *scene* changes, not the colour — the palette
 *    stays on-brand throughout), and
 *  - a solid dark panel holding the copy + role cards, so text is always crisp
 *    (the previous version washed the heading out over the orange).
 */

import React, { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useUI } from '../context/UIContext';
import { addRole } from '../api/services';
import { Role } from '../api/types';
import VoxlaeLogo from '../components/common/VoxlaeLogo';
import RoleScene from '../components/select-role/RoleScene';
import '../styles/pages/SelectRole.css';

interface RoleOption {
  role: Role;
  title: string;
  description: string;
  tagline: string;
  icon: React.ReactNode;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: Role.INFLUENCER,
    title: 'Influencer',
    description: 'Content creator growing your audience across social platforms',
    tagline: 'Grow · Monetize · Create',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
      </svg>
    ),
  },
  {
    role: Role.FREELANCER,
    title: 'Freelancer',
    description: 'Professional offering services to creators and brands',
    tagline: 'Get hired · Build a profile',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    role: Role.BRAND,
    title: 'Brand',
    description: 'Company looking to collaborate with creators',
    tagline: 'Discover · Partner · Launch',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
];

const SelectRolePage: React.FC = () => {
  const { showToast } = useUI();
  const reduceMotion = useReducedMotion();

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [hoveredRole, setHoveredRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Hover wins on desktop; on touch there's no hover so the selection drives it.
  const activeRole = hoveredRole ?? selectedRole;

  const handleContinue = async () => {
    if (!selectedRole) {
      showToast('Please select a role to continue', 'error');
      return;
    }
    try {
      setIsLoading(true);
      const response = await addRole({ role: selectedRole });

      // Land on the role's dashboard; the RoleSetupGate shows the blocking setup
      // wizard there until the (now INCOMPLETE) role is set up.
      let targetPath = '/influencer/dashboard';
      switch (selectedRole) {
        case Role.INFLUENCER:
          targetPath = '/influencer/dashboard';
          break;
        case Role.FREELANCER:
          // A freelancer has no public slug yet, so /freelancer/dashboard would be
          // caught by /freelancer/:slug and render "Profile not found". Send them to
          // the editor; the gate's blocking dialog covers it and, on save, redirects
          // to their real /freelancer/{slug}.
          targetPath = '/freelancer/profile';
          break;
        case Role.BRAND:
          targetPath = '/brand/dashboard';
          break;
      }

      localStorage.setItem('userRoles', JSON.stringify([{ role: response.role, status: response.status, verificationStatus: response.verificationStatus }]));
      localStorage.setItem('isNewUser', 'false');
      window.location.replace(targetPath);
    } catch (err) {
      console.error('[SelectRole] Assignment error:', err);
      showToast(err instanceof Error ? err.message : 'Failed to assign role. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const orbFloat = (dx: number[], dy: number[], dur: number) =>
    reduceMotion
      ? undefined
      : { x: dx, y: dy, transition: { duration: dur, repeat: Infinity, repeatType: 'mirror' as const, ease: 'easeInOut' as const } };

  return (
    <div className="sr">
      {/* ── Full-page animated background (blends both sides — no seam) ── */}
      <div className="sr__bg" aria-hidden="true">
        <motion.div className="sr__orb sr__orb--1" animate={orbFloat([0, 40, -20, 0], [0, -30, 20, 0], 18)} />
        <motion.div className="sr__orb sr__orb--2" animate={orbFloat([0, -40, 25, 0], [0, 25, -30, 0], 22)} />
        <div className="sr__grid" />
        <div className="sr__vignette" />
      </div>

      {/* ── Left: animated brand stage ── */}
      <div className="sr__stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeRole ?? 'neutral'}
            className="sr__scene-wrap"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -16, scale: reduceMotion ? 1 : 0.98 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <RoleScene role={activeRole} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Right: content ── */}
      <div className="sr__panel">
        <div className="sr__panel-inner">
          <motion.div
            className="sr__brand"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <VoxlaeLogo size={34} darkMode />
          </motion.div>

          <motion.h1
            className="sr__title"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}
          >
            What best describes you?
          </motion.h1>
          <motion.p
            className="sr__subtitle"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
          >
            Choose your role to get started with the right experience. You can add another later.
          </motion.p>

          <div className="sr__options" role="radiogroup" aria-label="Select your role">
            {ROLE_OPTIONS.map((option, i) => {
              const isSelected = selectedRole === option.role;
              return (
                <motion.button
                  key={option.role}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`sr__option ${isSelected ? 'is-selected' : ''}`}
                  onMouseEnter={() => setHoveredRole(option.role)}
                  onMouseLeave={() => setHoveredRole(null)}
                  onFocus={() => setHoveredRole(option.role)}
                  onBlur={() => setHoveredRole(null)}
                  onClick={() => setSelectedRole(option.role)}
                  disabled={isLoading}
                  initial={{ opacity: 0, x: 22 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.16 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={reduceMotion ? undefined : { x: 4 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                >
                  <span className="sr__option-sheen" aria-hidden="true" />
                  <span className="sr__option-icon">{option.icon}</span>
                  <span className="sr__option-body">
                    <span className="sr__option-title">{option.title}</span>
                    <span className="sr__option-desc">{option.description}</span>
                    <span className="sr__option-tag">{option.tagline}</span>
                  </span>
                  <span className="sr__option-check" aria-hidden="true">
                    {isSelected && (
                      <motion.svg
                        width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </motion.svg>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </div>

          <motion.button
            className="sr__continue"
            onClick={handleContinue}
            disabled={!selectedRole || isLoading}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.42, ease: 'easeOut' }}
            whileHover={!selectedRole || isLoading || reduceMotion ? undefined : { y: -2 }}
            whileTap={!selectedRole || isLoading || reduceMotion ? undefined : { scale: 0.99 }}
          >
            {isLoading ? 'Setting up…' : selectedRole ? `Continue as ${ROLE_OPTIONS.find(o => o.role === selectedRole)?.title}` : 'Continue'}
          </motion.button>
        </div>
      </div>
    </div>
  );
};

export default SelectRolePage;
