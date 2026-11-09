"use client";

/**
 * BrandProfilePage — Profile management for brands
 * 
 * Allows brands to:
 * - View and edit their profile
 * - Set company name, industry, description, website
 * - See profile completion status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from '@/lib/router';
import { useUI } from '../context/UIContext';
import { useUser } from '../context/UserContext';
import { getBrandProfile, saveBrandProfile } from '../api/services';
import { RoleStatus } from '../api/types';
import Button from '../components/common/Button';
import VoxlaeLoader from '../components/common/VoxlaeLoader';
import Input from '../components/common/Input';
import '../styles/pages/BrandProfilePage.css';

const BrandProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useUI();
  const { refreshUserProfile } = useUser();

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<RoleStatus>(RoleStatus.INCOMPLETE);
  const [isComplete, setIsComplete] = useState(false);

  // Load profile on mount
  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getBrandProfile();
      setCompanyName(response.companyName || '');
      setIndustry(response.industry || '');
      setDescription(response.description || '');
      setWebsite(response.website || '');
      setProfileStatus(response.roleStatus);
      // isComplete is true if roleStatus is ACTIVE OR if the backend flag says so
      setIsComplete(response.roleStatus === RoleStatus.ACTIVE || response.isComplete);
    } catch (error) {
      console.error('Failed to load profile:', error);
      showToast('Failed to load profile', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Save profile
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await saveBrandProfile({
        companyName: companyName.trim(),
        industry: industry.trim(),
        description: description.trim(),
        website: website.trim(),
      });
      
      // Refresh user context to update role status
      await refreshUserProfile();
      
      // Reload profile to ensure we have the latest data including isComplete flag
      await loadProfile();
      
      showToast(
        response.roleStatus === RoleStatus.ACTIVE 
          ? 'Profile saved! Your profile is now complete.' 
          : 'Profile saved. Complete all required fields to activate your profile.',
        response.roleStatus === RoleStatus.ACTIVE ? 'success' : 'info'
      );
    } catch (error) {
      console.error('Failed to save profile:', error);
      showToast('Failed to save profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (

        <div className="brand-profile-page">
          <VoxlaeLoader variant="page" label="Loading profile…" />
        </div>

    );
  }

  return (

      <div className="brand-profile-page">
        <header className="brand-profile-page__header">
          <div className="brand-profile-page__header-content">
            <h1 className="brand-profile-page__title">Brand Profile</h1>
            <p className="brand-profile-page__subtitle">
              Manage your brand profile to connect with creators
            </p>
          </div>
          <div className={`brand-profile-page__status brand-profile-page__status--${profileStatus.toLowerCase()}`}>
            <span className="brand-profile-page__status-dot" />
            <span className="brand-profile-page__status-label">
              {profileStatus === RoleStatus.ACTIVE ? 'Active' : 'Incomplete'}
            </span>
          </div>
        </header>

        {/* Completion Warning */}
        {!isComplete && (
          <div className="brand-profile-page__warning">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Complete your profile to access all features. Required: Company Name and Description.</span>
          </div>
        )}

        <div className="brand-profile-page__form">
          {/* Company Info Section */}
          <section className="brand-profile-page__section">
            <h2 className="brand-profile-page__section-title">Company Information</h2>
            <div className="brand-profile-page__field">
              <Input
                label="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., XYZ Fitness"
                maxLength={255}
                required
              />
            </div>

            <div className="brand-profile-page__field">
              <Input
                label="Industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g., Fitness, Technology, Fashion"
                maxLength={255}
              />
            </div>

            <div className="brand-profile-page__field">
              <Input
                label="Website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourcompany.com"
                type="url"
                maxLength={500}
              />
            </div>
          </section>

          {/* Description Section */}
          <section className="brand-profile-page__section">
            <h2 className="brand-profile-page__section-title">About Your Brand</h2>
            <div className="brand-profile-page__field">
              <label htmlFor="description" className="brand-profile-page__label">
                Description <span className="brand-profile-page__required">*</span>
              </label>
              <textarea
                id="description"
                className="brand-profile-page__textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell creators about your brand, what you do, and what kind of partnerships you're looking for..."
                rows={5}
                maxLength={2000}
              />
              <span className="brand-profile-page__char-count">{description.length}/2000</span>
            </div>
          </section>

          {/* Actions */}
          <div className="brand-profile-page__actions">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/brand/dashboard')}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </div>
      </div>

  );
};

export default BrandProfilePage;
