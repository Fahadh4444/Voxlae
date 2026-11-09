"use client";

/**
 * BrandDashboardPage — Dashboard for brands
 * 
 * Shows:
 * - Profile completion status with percentage
 * - Restricted view when INCOMPLETE (CTA to complete profile)
 * - Company summary when ACTIVE
 * - Quick actions
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from '@/lib/router';
import { useUser } from '../context/UserContext';
import { getBrandProfile } from '../api/services';
import { BrandProfileResponse, RoleStatus } from '../api/types';
import Button from '../components/common/Button';
import VoxlaeLoader from '../components/common/VoxlaeLoader';
import '../styles/pages/BrandDashboard.css';

const BrandDashboardPage: React.FC = () => {
  const { user, activeRoleStatus } = useUser();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<BrandProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getBrandProfile();
      setProfile(response);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-fetch when the role status changes (e.g. the setup gate flips BRAND
  // INCOMPLETE→ACTIVE): this page mounts behind the gate with an empty profile,
  // so without this it would keep showing "incomplete" until a manual refresh.
  useEffect(() => {
    loadProfile();
  }, [loadProfile, activeRoleStatus]);

  const roleStatus = profile?.roleStatus ?? RoleStatus.INCOMPLETE;
  // isComplete is derived from the live role status (context), the fetched
  // profile's roleStatus, OR its isComplete flag — whichever is true first.
  const isComplete =
    activeRoleStatus === RoleStatus.ACTIVE ||
    roleStatus === RoleStatus.ACTIVE ||
    (profile?.isComplete ?? false);

  // Calculate profile completion percentage
  const completionPercent = useMemo(() => {
    if (!profile) return 0;
    let filled = 0;
    const total = 2; // companyName, description (required fields)
    if (profile.companyName && profile.companyName.trim().length > 0) filled++;
    if (profile.description && profile.description.trim().length > 0) filled++;
    return Math.round((filled / total) * 100);
  }, [profile]);

  return (

      <div className="brand-dashboard">
        <header className="brand-dashboard__header">
          <div className="brand-dashboard__welcome">
            <h1 className="brand-dashboard__title">
              Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </h1>
            <p className="brand-dashboard__subtitle">
              Your brand dashboard
            </p>
          </div>
        </header>

        {/* Profile Status Banner */}
        {!isComplete && !isLoading && (
          <div className="brand-dashboard__incomplete-banner">
            <div className="brand-dashboard__incomplete-content">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <h3>Complete your brand profile to start using features</h3>
                <p>Add your company name and description to get started</p>
                {completionPercent > 0 && (
                  <div className="brand-dashboard__progress">
                    <div className="brand-dashboard__progress-bar">
                      <div 
                        className="brand-dashboard__progress-fill"
                        style={{ width: `${completionPercent}%` }}
                      />
                    </div>
                    <span className="brand-dashboard__progress-label">{completionPercent}% complete</span>
                  </div>
                )}
              </div>
            </div>
            <Button variant="primary" onClick={() => navigate('/brand/profile')}>
              Go to Profile
            </Button>
          </div>
        )}

        <div className="brand-dashboard__grid">
          {/* Profile Card */}
          <div className="brand-dashboard__card brand-dashboard__card--profile">
            <div className="brand-dashboard__card-header">
              <h2 className="brand-dashboard__card-title">Company Profile</h2>
              <span className={`brand-dashboard__status brand-dashboard__status--${roleStatus.toLowerCase()}`}>
                {roleStatus === RoleStatus.ACTIVE ? 'Active' : 'Incomplete'}
              </span>
            </div>
            <div className="brand-dashboard__card-body">
              {isLoading ? (
                <VoxlaeLoader variant="inline" label="Loading…" />
              ) : (
                <>
                  {profile?.companyName ? (
                    <h3 style={{ margin: '0 0 8px', fontSize: 'var(--vx-font-lg)' }}>
                      {profile.companyName}
                    </h3>
                  ) : (
                    <p className="brand-dashboard__empty">No company name set</p>
                  )}
                  <div className="brand-dashboard__description">
                    {profile?.description ? (
                      <p>{profile.description.length > 200 ? `${profile.description.substring(0, 200)}...` : profile.description}</p>
                    ) : (
                      <p className="brand-dashboard__empty">No description added yet</p>
                    )}
                  </div>
                  {profile?.industry && (
                    <div className="brand-dashboard__info-row">
                      <span className="brand-dashboard__label">Industry:</span>
                      <span>{profile.industry}</span>
                    </div>
                  )}
                  {profile?.website && (
                    <div className="brand-dashboard__info-row">
                      <span className="brand-dashboard__label">Website:</span>
                      <a 
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="brand-dashboard__website-link"
                      >
                        {profile.website}
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="brand-dashboard__card-footer">
              <Button variant="ghost" size="sm" onClick={() => navigate('/brand/profile')}>
                Edit Profile
              </Button>
            </div>
          </div>

          {/* Coming Soon Card */}
          {isComplete ? (
          <div className="brand-dashboard__card brand-dashboard__card--coming-soon">
            <div className="brand-dashboard__coming-soon-content">
              <div className="brand-dashboard__coming-soon-icon">🚀</div>
              <h3>More Features Coming Soon</h3>
              <p>Creator discovery, campaign management, and collaboration tools are on the way!</p>
            </div>
          </div>
          ) : (
          <div className="brand-dashboard__card brand-dashboard__card--restricted">
            <div className="brand-dashboard__card-header">
              <h2 className="brand-dashboard__card-title">Features</h2>
              <span className="brand-dashboard__restricted-badge">Locked</span>
            </div>
            <div className="brand-dashboard__card-body">
              <p className="brand-dashboard__empty">Complete your profile to access creator discovery, campaigns, and collaboration tools</p>
            </div>
            <div className="brand-dashboard__card-footer">
              <Button variant="ghost" size="sm" onClick={() => navigate('/brand/profile')}>
                Go to Profile
              </Button>
            </div>
          </div>
          )}
        </div>
      </div>

  );
};

export default BrandDashboardPage;
