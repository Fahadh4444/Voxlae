"use client";

/**
 * AccountPage — Combined Profile + Settings
 * 
 * Sections:
 * - Personal Info (editable name)
 * - Email (read-only)
 * - Preferences (notification placeholders)
 * - Subscription placeholder
 * - Danger Zone (sign out, delete account)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from '@/lib/router';
import { useUser } from '../context/UserContext';
import { useUI } from '../context/UIContext';
import { useTheme, ThemePreference } from '../context/ThemeContext';
import { deleteAccount, updateMyProfile, getUserProfile, setPassword } from '../api/services';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Section from '../components/common/Section';
import Container from '../components/common/Container';
import Badge from '../components/common/Badge';
import '../styles/pages/Account.css';

/* Appearance options — icons are inline SVG so they inherit currentColor and
   need no asset/network dependency. */
const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'light',
    label: 'Light',
    hint: 'Bright interface',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    hint: 'Easy on the eyes',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System',
    hint: 'Match your device',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
];

const AccountPage: React.FC = () => {
  const { user, logout, refreshUserProfile } = useUser();
  const { showToast, showModal } = useUI();
  const { preference, setPreference } = useTheme();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || localStorage.getItem('userName') || '');
  const [email] = useState(user?.email || localStorage.getItem('email') || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Delete-account modal state ──────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Password section state ──────────────────────────────────────────────
  // hasPassword is null until we know (avoids flashing the wrong form).
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    getUserProfile()
      .then((profile) => setHasPassword(!!profile.hasPassword))
      .catch((err) => console.error('[AccountPage] failed to load password status:', err));
  }, []);

  const handleSavePassword = useCallback(async () => {
    if (hasPassword && !passwordForm.current) {
      showToast('Enter your current password', 'error');
      return;
    }
    if (passwordForm.next.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setIsSavingPassword(true);
    try {
      await setPassword({
        currentPassword: hasPassword ? passwordForm.current : undefined,
        newPassword: passwordForm.next,
      });
      setHasPassword(true);
      setShowPasswordForm(false);
      setPasswordForm({ current: '', next: '', confirm: '' });
      showToast('Password saved. You can now sign in with email and password too.', 'success');
    } catch (err) {
      console.error('[AccountPage] set password failed:', err);
      showToast(err instanceof Error ? err.message : 'Could not save password. Please try again.', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  }, [hasPassword, passwordForm, showToast]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      showToast('Name must be at least 2 characters', 'error');
      return;
    }
    setIsSaving(true);
    try {
      // Persist to the backend, then re-pull /auth/me so the new name shows on the
      // navbar and the freelancer's public profile — not just here.
      await updateMyProfile(trimmed);
      await refreshUserProfile();
      localStorage.setItem('userName', trimmed);
      showToast('Profile updated successfully!', 'success');
      setIsEditing(false);
    } catch (err) {
      console.error('[AccountPage] name update failed:', err);
      showToast('Could not update your name. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [name, showToast, refreshUserProfile]);

  const handleLogout = useCallback(() => {
    showModal({
      title: 'Sign Out',
      content: 'Are you sure you want to sign out? You can always sign back in later.',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Cancel',
      variant: 'danger',
      onConfirm: logout,
    });
  }, [showModal, logout]);

  const handleDeleteAccount = useCallback(() => {
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setDeleteConfirmText('');
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await deleteAccount();
      logout();
      showToast('Your account has been permanently deleted.', 'success');
      navigate('/');
    } catch (err) {
      console.error('Account deletion failed:', err);
      showToast('Failed to delete account. Please try again.', 'error');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }, [deleteConfirmText, logout, navigate, showToast]);

  return (
    <Container className="account-page" size="md">
      <header className="account-page__header">
        <h1 className="account-page__title">Settings</h1>
        <p className="account-page__subtitle">Manage your account and preferences</p>
      </header>

      {/* ── Personal Info ── */}
      <Section title="Personal Information">
        <Card variant="outlined" padding="lg">
          <div className="account-page__avatar-row">
            <div className="account-page__avatar">
              {name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="account-page__avatar-info">
              <h3>{name || 'Creator'}</h3>
              <p>{email || 'Not set'}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>

          {isEditing && (
            <div className="account-page__edit-form">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={isSaving}
              />
              <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          )}
        </Card>
      </Section>

      {/* ── Email ── */}
      <Section title="Email">
        <Card variant="outlined" padding="lg">
          <div className="account-page__field">
            <Input
              label="Email Address"
              value={email}
              disabled
              hint="Email cannot be changed."
            />
          </div>
        </Card>
      </Section>

      {/* ── Password & Security ── */}
      <Section title="Password & Security">
        <Card variant="outlined" padding="lg">
          {hasPassword === null ? (
            <p className="account-page__pref-hint">Loading…</p>
          ) : !showPasswordForm ? (
            <div className="account-page__danger-row">
              <div>
                <h4>{hasPassword ? 'Password' : 'Sign in with email and password'}</h4>
                <p>
                  {hasPassword
                    ? 'Change the password used to sign in with your email.'
                    : "Add a password so you can sign in with your email too, not just Google."}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowPasswordForm(true)}>
                {hasPassword ? 'Change Password' : 'Set Password'}
              </Button>
            </div>
          ) : (
            <div className="account-page__edit-form">
              {hasPassword && (
                <Input
                  label="Current Password"
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                  placeholder="Your current password"
                  disabled={isSavingPassword}
                />
              )}
              <Input
                label="New Password"
                type="password"
                value={passwordForm.next}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, next: e.target.value }))}
                placeholder="At least 8 characters"
                disabled={isSavingPassword}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                placeholder="Re-enter your new password"
                disabled={isSavingPassword}
              />
              <div className="account-page__avatar-row">
                <Button variant="primary" size="sm" onClick={handleSavePassword} disabled={isSavingPassword}>
                  {isSavingPassword ? 'Saving…' : 'Save Password'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordForm({ current: '', next: '', confirm: '' });
                  }}
                  disabled={isSavingPassword}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      </Section>

      {/* ── Appearance ── */}
      <Section title="Appearance">
        <Card variant="outlined" padding="lg">
          <div className="account-page__appearance">
            <div className="account-page__appearance-copy">
              <span className="account-page__pref-label">Theme</span>
              <span className="account-page__pref-hint">
                Choose how Voxlae looks. “System” follows your device settings.
              </span>
            </div>
            <div
              className="account-page__theme-options"
              role="radiogroup"
              aria-label="Theme"
            >
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={preference === opt.value}
                  className={`account-page__theme-option${
                    preference === opt.value ? ' account-page__theme-option--active' : ''
                  }`}
                  onClick={() => setPreference(opt.value)}
                >
                  <span className="account-page__theme-option-icon">{opt.icon}</span>
                  <span className="account-page__theme-option-label">{opt.label}</span>
                  <span className="account-page__theme-option-hint">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </Section>

      {/* ── Preferences ── */}
      <Section title="Preferences">
        <Card variant="outlined" padding="lg">
          <div className="account-page__pref-list">
            <div className="account-page__pref-row">
              <div>
                <span className="account-page__pref-label">Email notifications</span>
                <span className="account-page__pref-hint">Receive weekly analytics reports</span>
              </div>
              <Badge variant="muted" size="sm">Coming Soon</Badge>
            </div>
            <div className="account-page__pref-row">
              <div>
                <span className="account-page__pref-label">Performance alerts</span>
                <span className="account-page__pref-hint">Get notified of significant changes</span>
              </div>
              <Badge variant="muted" size="sm">Coming Soon</Badge>
            </div>
            <div className="account-page__pref-row">
              <div>
                <span className="account-page__pref-label">Weekly digest</span>
                <span className="account-page__pref-hint">Growth summary delivered to your inbox</span>
              </div>
              <Badge variant="muted" size="sm">Coming Soon</Badge>
            </div>
          </div>
        </Card>
      </Section>

      {/* ── Subscription ── */}
      <Section title="Subscription">
        <Card variant="outlined" padding="lg">
          <div className="account-page__subscription">
            <div className="account-page__plan-row">
              <Badge variant="primary" size="md">Pro (Dev)</Badge>
              <span className="account-page__plan-info">All features unlocked for development</span>
            </div>
            <Button variant="secondary" size="sm" disabled>
              Manage Subscription
            </Button>
          </div>
        </Card>
      </Section>

      {/* ── Danger Zone ── */}
      <Section title="Danger Zone">
        <Card variant="outlined" padding="lg" className="account-page__danger">
          <div className="account-page__danger-row">
            <div>
              <h4>Sign Out</h4>
              <p>Sign out of your VOXLAE account on this device.</p>
            </div>
            <Button variant="danger" size="sm" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
          <div className="account-page__danger-divider" />
          <div className="account-page__danger-row">
            <div>
              <h4>Delete Account</h4>
              <p>Permanently delete your account and all associated data.</p>
            </div>
            <Button variant="danger" size="sm" onClick={handleDeleteAccount}>
              Delete Account
            </Button>
          </div>
        </Card>
      </Section>

      {/* ── Delete-account confirmation modal ── */}
      {showDeleteModal && (
        <div className="account-page__delete-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="account-page__delete-modal">
            <h3 id="delete-modal-title" className="account-page__delete-modal-title">
              Delete Account
            </h3>
            <p className="account-page__delete-modal-body">
              This action is <strong>permanent and irreversible</strong>. All your profile
              information, connected platforms, and analytics data will be permanently deleted.
            </p>
            <p className="account-page__delete-modal-instruction">
              Type <strong>DELETE</strong> below to confirm:
            </p>
            <Input
              label=""
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={isDeleting}
            />
            <div className="account-page__delete-modal-actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              >
                {isDeleting ? 'Deleting…' : 'Delete My Account'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer with Privacy Link */}
      <footer className="account-page__footer">
        <p>&copy; {new Date().getFullYear()} VOXLAE. All rights reserved.</p>
        <div className="account-page__footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <a href="#">Terms of Service</a>
        </div>
      </footer>
    </Container>
  );
};

export default AccountPage;
