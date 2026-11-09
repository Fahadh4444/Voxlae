"use client";

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from '@/lib/router';
import { useUser } from '../../context/UserContext';
import { getDashboardRoute } from '../../utils/roleRoutes';
import VoxlaeLogo from '../common/VoxlaeLogo';
import Button from '../common/Button';
import RoleSwitcher from '../common/RoleSwitcher';
import { FEATURES } from '../../config/features';
import '../../styles/components/Navbar.css';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, onboardingCompleted, logout, activeRole } = useUser();
  const location = useLocation();
  
  // Track scroll for navbar state
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Determine if we're on a dark hero page (home page)
  const isDarkHeroPage = location.pathname === '/';

  // Handle scroll state
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial state
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (location.pathname.includes('/onboarding')) return null;

  // Build navbar class names
  const navbarClasses = [
    'vx-navbar',
    isDarkHeroPage && 'vx-navbar--dark',
    isScrolled && 'vx-navbar--scrolled',
  ].filter(Boolean).join(' ');

  return (
    <nav className={navbarClasses}>
      <div className="vx-navbar__inner">
        <Link to="/" className="vx-navbar__brand">
          <VoxlaeLogo 
            size={36} 
            variant="full" 
            darkMode={isDarkHeroPage && !isScrolled} 
          />
        </Link>

        <div className="vx-navbar__links">
          {isAuthenticated && onboardingCompleted && (() => {
            const dashRoute = getDashboardRoute(activeRole, user?.freelancerSlug);
            return (
              <Link to={dashRoute} className={`vx-navbar__link ${location.pathname === dashRoute ? 'vx-navbar__link--active' : ''}`}>
                Dashboard
              </Link>
            );
          })()}
        </div>

        <div className="vx-navbar__actions">
          {isAuthenticated ? (
            <div className="vx-navbar__user">
              <RoleSwitcher 
                compact 
                darkMode={isDarkHeroPage && !isScrolled} 
              />
              <div className="vx-navbar__avatar">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="vx-navbar__username">{user?.name}</span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="vx-navbar__guest-actions">
              {/* Auth has its own pages. "Log in" stays visible while invite-only: the server decides who
                  gets in (identity/access.ts), and approved waitlist users need a normal way back. */}
              <Link to="/signin">
                <Button variant="ghost" size="sm" className="vx-navbar__signin">Log in</Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm">{FEATURES.waitlist ? 'Join waitlist' : 'Get Started'}</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
