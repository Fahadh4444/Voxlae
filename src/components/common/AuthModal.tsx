"use client";

/**
 * AuthModal — Sign-in/Sign-up modal with multi-auth support
 * 
 * Features:
 * - Multiple auth providers (Google, Email)
 * - Clean modal design inspired by Duolingo
 * - Handles both sign-in and sign-up flows
 * - Email signup/login forms
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useUser } from '../../context/UserContext';
import { useUI } from '../../context/UIContext';
import {
  authenticateWithGoogle,
  signupWithEmail,
  loginWithEmail,
  requestPasswordReset,
  resetPassword,
  getCurrentUser,
  lookupInvite,
  signupWithInvite,
} from '../../api/services';
import { AuthResponse, EmailSignupResponse, InviteInfo, Role, WaitlistRole } from '../../api/types';
import { ApiError } from '../../api/api';
import { FEATURES } from '../../config/features';
import WaitlistForm from './WaitlistForm';
import { getDashboardRoute, getOnboardingRoute } from '../../utils/roleRoutes';
import '../../styles/components/AuthModal.css';

/* ── Google Identity Services type ── */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type AuthView =
  | 'providers'
  | 'email-login'
  | 'email-signup'
  | 'forgot-request'
  | 'forgot-reset'
  | 'waitlist'
  | 'invite-loading'
  | 'invite-signup'
  | 'invite-error';

/** The server's 403 for an email that is not an admin and not approved off the waitlist. */
function isWaitlistOnly(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 403 &&
    (err.data as { error?: string } | null)?.error === 'waitlist_only'
  );
}

/* Password input with a show/hide toggle — used by every password field in this modal. */
const PasswordField: React.FC<{
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}> = ({ id, label, placeholder, value, onChange, disabled }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="auth-modal__field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-modal__field-wrap">
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
        <button
          type="button"
          className="auth-modal__field-toggle"
          onClick={() => setRevealed(v => !v)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {revealed ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <path d="M1 1l22 22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * `signin` is always a real sign-in — the server decides who gets in. `signup` opens the waitlist
   * while Voxlae is invite-only (FEATURES.waitlist), and the normal sign-up flow otherwise.
   */
  mode?: 'signin' | 'signup';
  /** `page` renders the same content as a card for the /signin and /signup pages: no backdrop or close. */
  variant?: 'modal' | 'page';
  /** Pre-selects who they are on the waitlist form, e.g. from a "Find talent" CTA. */
  waitlistRole?: WaitlistRole;
  /** From an invite email (`/signup?invite=…`): shows "Create your account" for the invited email. */
  inviteToken?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  mode = 'signin',
  variant = 'modal',
  waitlistRole,
  inviteToken,
}) => {
  const isPage = variant === 'page';
  // While invite-only there is no sign-up: the providers view always means "sign in".
  const signinMode = FEATURES.waitlist || mode === 'signin';
  const initialView: AuthView = inviteToken
    ? 'invite-loading'
    : FEATURES.waitlist && mode === 'signup'
      ? 'waitlist'
      : 'providers';
  /** Set when a sign-in was refused because the email is not approved yet. */
  const [waitlistNotice, setWaitlistNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, setOnboardingCompleted, setIsNewUser } = useUser();
  const { showToast, setAuthTransition } = useUI();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const googleInitRef = useRef(false);

  // Auth state
  const [currentView, setCurrentView] = useState<AuthView>(initialView);
  const [isLoading, setIsLoading] = useState(false);
  
  // Email form state
  const [emailForm, setEmailForm] = useState({ email: '', password: '', name: '' });

  // Invite-link flow (/signup?invite=…)
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteProblem, setInviteProblem] = useState<{ code: string; message: string } | null>(null);
  const [inviteForm, setInviteForm] = useState({ name: '', password: '' });
  /** Read inside the Google callback, which is memoised and must not go stale on it. */
  const inviteRef = useRef<InviteInfo | null>(null);
  useEffect(() => {
    inviteRef.current = currentView === 'invite-signup' ? invite : null;
  }, [currentView, invite]);

  // Forgot-password flow state (email is reused from emailForm.email)
  const [resetForm, setResetForm] = useState({ otp: '', newPassword: '', confirm: '' });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentView(initialView);
      setWaitlistNotice(null);
      setEmailForm({ email: '', password: '', name: '' });
      setResetForm({ otp: '', newPassword: '', confirm: '' });
      setIsLoading(false);
    }
  }, [isOpen, initialView]);

  // Resolve the invite link: who it is for, or why it no longer works.
  useEffect(() => {
    if (!isOpen || !inviteToken) return;
    let cancelled = false;
    lookupInvite(inviteToken)
      .then((info) => {
        if (cancelled) return;
        setInvite(info);
        setCurrentView('invite-signup');
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err instanceof ApiError ? (err.data as { error?: string } | null)?.error ?? '' : '';
        setInviteProblem({
          code,
          message: err instanceof Error ? err.message : "This invite link isn't valid.",
        });
        setCurrentView('invite-error');
      });
    return () => { cancelled = true; };
  }, [isOpen, inviteToken]);

  /** Not approved yet: show the waitlist with an explanation instead of a bare error toast. */
  const sendToWaitlist = useCallback((email?: string) => {
    setWaitlistNotice(
      email
        ? `${email} isn't approved yet — Voxlae is invite-only right now. Join the waitlist and we'll let you in soon.`
        : "That account isn't approved yet — Voxlae is invite-only right now. Join the waitlist and we'll let you in soon.",
    );
    setCurrentView('waitlist');
  }, []);

  // Handle successful auth response
  const handleAuthSuccess = useCallback(async (data: AuthResponse) => {
    // Show the global full-screen loader now so there's no flash of the landing
    // page between the modal closing and the destination route mounting.
    setAuthTransition(true);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('userName', data.name);
    localStorage.setItem('email', data.email);
    localStorage.setItem('requiresOnboarding', JSON.stringify(data.requiresOnboarding));
    localStorage.setItem('isNewUser', String(data.isNewUser ?? true));
    localStorage.setItem('emailVerified', String(data.emailVerified ?? false));

    try {
      // Fetch user roles to determine navigation
      const userInfo = await getCurrentUser();
      const roles = userInfo.roles || [];
      const activeRole = roles.length > 0 ? roles[0].role : null;

      // Update context with complete user info
      login(data.name, data.email, data.accessToken, {
        isNewUser: userInfo.isNewUser,
        emailVerified: userInfo.emailVerified,
        roles: roles,
        activeRole: activeRole,
      });

      // Store roles in localStorage
      localStorage.setItem('userRoles', JSON.stringify(roles));
      localStorage.setItem('isNewUser', String(userInfo.isNewUser));
      localStorage.setItem('requiresOnboarding', String(!userInfo.onboardingCompleted));

      onClose();

      // Wait for state to propagate before navigation
      // This ensures RoleProtectedRoute sees the updated activeRole
      setTimeout(() => {
        // Check if this is a new user who needs role selection
        if (userInfo.isNewUser || !activeRole) {
          setIsNewUser(true);
          navigate('/select-role');
          return;
        }

        // Navigate based on user's active role
        if (activeRole === Role.FREELANCER) {
          // A freelancer's dashboard IS their public profile page
          navigate(getDashboardRoute(Role.FREELANCER, userInfo.freelancerSlug));
        } else if (activeRole === Role.BRAND) {
          navigate('/brand/dashboard');
        } else if (activeRole === Role.INFLUENCER) {
          // Influencer flow - check if onboarding is needed
          setOnboardingCompleted(userInfo.onboardingCompleted);
          if (!userInfo.onboardingCompleted) {
            const onboardingRoute = getOnboardingRoute(Role.INFLUENCER);
            navigate(onboardingRoute || '/influencer/onboarding');
          } else {
            const dashboardRoute = getDashboardRoute(Role.INFLUENCER);
            navigate(dashboardRoute);
          }
        } else {
          // Fallback to role-specific dashboard
          const dashboardRoute = getDashboardRoute(activeRole);
          navigate(dashboardRoute);
        }
      }, 100);
    } catch (err) {
      console.error('[AuthModal] Failed to fetch user info:', err);
      showToast('Authentication succeeded but failed to load user profile. Please refresh.', 'error');
      
      // Fallback: use basic login without role info
      login(data.name, data.email, data.accessToken, {
        isNewUser: data.isNewUser ?? true,
        emailVerified: data.emailVerified ?? false,
        roles: [],
        activeRole: null,
      });
      
      onClose();
      
      // Wait for state to propagate before navigation
      setTimeout(() => {
        if (data.isNewUser) {
          setIsNewUser(true);
          navigate('/select-role');
        } else {
          // Navigate to influencer dashboard as default fallback
          navigate('/influencer/dashboard');
        }
      }, 100);
    }
  }, [login, setOnboardingCompleted, setIsNewUser, navigate, onClose, showToast, setAuthTransition]);

  // Google credential handler
  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    try {
      setIsLoading(true);
      const data = await authenticateWithGoogle(response.credential);
      handleAuthSuccess(data);
    } catch (err) {
      console.error('[AuthModal] Google Sign-In error:', err);
      const invited = inviteRef.current;
      if (invited && isWaitlistOnly(err)) {
        // On an invite, a refusal means they picked a different Google account than the invited one.
        showToast(`Use the Google account for ${invited.email} — that's the address you were invited with.`, 'error');
      } else if (isWaitlistOnly(err)) sendToWaitlist();
      else showToast(err instanceof Error ? err.message : 'Sign-in failed. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [handleAuthSuccess, showToast, sendToWaitlist]);

  // Email signup handler - navigates to OTP verification after signup
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.email || !emailForm.password || !emailForm.name) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const data: EmailSignupResponse = await signupWithEmail({
        email: emailForm.email,
        password: emailForm.password,
        name: emailForm.name,
      });
      
      // Email signup requires OTP verification
      if (data.requiresEmailVerification) {
        // Stored where EmailVerificationPage reads it (localStorage), so a refresh on that page still
        // knows the address. It used to be written to sessionStorage and read from localStorage, so
        // this fallback never fired.
        localStorage.setItem('pendingVerificationEmail', data.email);
        onClose();
        navigate('/email-verification', { state: { email: data.email } });
        showToast('Verification code sent to your email', 'success');
      }
    } catch (err) {
      console.error('[AuthModal] Email signup error:', err);
      if (isWaitlistOnly(err)) sendToWaitlist(emailForm.email);
      else showToast(err instanceof Error ? err.message : 'Signup failed. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Invite signup — creates the account for the invited email and signs straight in (no code needed:
  // opening the emailed link already proved they own the inbox).
  const handleInviteSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken || !inviteForm.password) {
      showToast('Please choose a password', 'error');
      return;
    }
    try {
      setIsLoading(true);
      const data = await signupWithInvite({
        token: inviteToken,
        name: inviteForm.name,
        password: inviteForm.password,
      });
      handleAuthSuccess(data);
    } catch (err) {
      console.error('[AuthModal] Invite signup error:', err);
      showToast(err instanceof Error ? err.message : 'Could not create your account. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Email login handler
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.email || !emailForm.password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const data = await loginWithEmail({
        email: emailForm.email,
        password: emailForm.password,
      });
      handleAuthSuccess(data);
    } catch (err) {
      console.error('[AuthModal] Email login error:', err);
      if (isWaitlistOnly(err)) sendToWaitlist(emailForm.email);
      else showToast(err instanceof Error ? err.message : 'Login failed. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password — request a reset code
  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.email) {
      showToast('Please enter your email', 'error');
      return;
    }
    try {
      setIsLoading(true);
      await requestPasswordReset({ email: emailForm.email });
      // Generic response — always advance to the code step (no account enumeration)
      showToast('If an account exists, a reset code has been sent.', 'success');
      setCurrentView('forgot-reset');
    } catch (err) {
      console.error('[AuthModal] Forgot password error:', err);
      showToast(err instanceof Error ? err.message : 'Something went wrong. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password — submit code + new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetForm.otp || !resetForm.newPassword) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    if (resetForm.newPassword.length < 8) {
      showToast('Password must be at least 8 characters', 'error');
      return;
    }
    if (resetForm.newPassword !== resetForm.confirm) {
      showToast('Passwords do not match', 'error');
      return;
    }
    try {
      setIsLoading(true);
      await resetPassword({
        email: emailForm.email,
        otp: resetForm.otp.trim(),
        newPassword: resetForm.newPassword,
      });
      showToast('Password updated. Please sign in with your new password.', 'success');
      // Back to login with the email pre-filled; clear sensitive fields
      setEmailForm(prev => ({ ...prev, password: '' }));
      setResetForm({ otp: '', newPassword: '', confirm: '' });
      setCurrentView('email-login');
    } catch (err) {
      console.error('[AuthModal] Reset password error:', err);
      showToast(err instanceof Error ? err.message : 'Invalid or expired code. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Initialize Google Identity Services ── */
  useEffect(() => {
    if (!isOpen || (currentView !== 'providers' && currentView !== 'invite-signup')) return;

    const initGIS = () => {
      if (!window.google || googleInitRef.current) return;
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set — the Google button will not render');
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (googleBtnRef.current) {
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          text: signinMode ? 'signin_with' : 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          width: 320,
        });
      }

      googleInitRef.current = true;
    };

    googleInitRef.current = false;

    if (window.google) {
      setTimeout(initGIS, 50);
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          initGIS();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isOpen, currentView, handleGoogleCredential, signinMode]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // A page has nothing to close and must keep scrolling.
    if (isOpen && !isPage) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, isPage]);

  if (!isOpen) return null;

  // Render different views
  const renderView = () => {
    switch (currentView) {
      case 'invite-loading':
        return (
          <div className="auth-modal__form">
            <h2 className="auth-modal__title">Checking your invite…</h2>
            <p className="auth-modal__subtitle">One moment.</p>
          </div>
        );

      case 'invite-error':
        return (
          <div className="auth-modal__form">
            <h2 className="auth-modal__title">
              {inviteProblem?.code === 'invite_used' ? 'Invite already used' : "This invite link doesn't work"}
            </h2>
            <p className="auth-modal__subtitle">{inviteProblem?.message}</p>
            <button
              type="button"
              className="auth-modal__submit-btn"
              onClick={() => setCurrentView('providers')}
            >
              Log in
            </button>
            {FEATURES.waitlist && (
              <p className="auth-modal__alternate">
                Not invited yet?{' '}
                <button type="button" className="auth-modal__link" onClick={() => setCurrentView('waitlist')}>
                  Join the waitlist
                </button>
              </p>
            )}
          </div>
        );

      case 'invite-signup':
        return (
          <form className="auth-modal__form" onSubmit={handleInviteSignup}>
            <h2 className="auth-modal__title">You&apos;re in! Create your account</h2>
            <p className="auth-modal__subtitle">
              Signing up as <b>{invite?.email}</b>
            </p>

            <div className="auth-modal__providers">
              <div className="auth-modal__provider">
                <div ref={googleBtnRef} className="auth-modal__google-btn" />
              </div>
            </div>
            <p className="auth-modal__hint">Use the Google account for {invite?.email}.</p>

            <div className="auth-modal__divider"><span>or with a password</span></div>

            <div className="auth-modal__field">
              <label htmlFor="invite-email">Email</label>
              <input id="invite-email" type="email" value={invite?.email ?? ''} disabled readOnly />
            </div>

            <div className="auth-modal__field">
              <label htmlFor="invite-name">Name</label>
              <input
                id="invite-name"
                type="text"
                placeholder="Your name"
                value={inviteForm.name}
                onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={isLoading}
              />
            </div>

            <PasswordField
              id="invite-password"
              label="Password"
              placeholder="Create a password (8+ characters)"
              value={inviteForm.password}
              onChange={(e) => setInviteForm((prev) => ({ ...prev, password: e.target.value }))}
              disabled={isLoading}
            />

            <button type="submit" className="auth-modal__submit-btn" disabled={isLoading}>
              {isLoading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        );

      case 'waitlist':
        return (
          <WaitlistForm
            defaultRole={waitlistRole}
            notice={waitlistNotice}
            onSignIn={() => { setWaitlistNotice(null); setCurrentView('providers'); }}
          />
        );

      case 'email-signup':
        return (
          <form className="auth-modal__form" onSubmit={handleEmailSignup}>
            <h2 className="auth-modal__title">Create your account</h2>
            <p className="auth-modal__subtitle">Sign up with your email</p>
            
            <div className="auth-modal__field">
              <label htmlFor="signup-name">Name</label>
              <input
                id="signup-name"
                type="text"
                placeholder="Your name"
                value={emailForm.name}
                onChange={(e) => setEmailForm(prev => ({ ...prev, name: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            
            <div className="auth-modal__field">
              <label htmlFor="signup-email">Email</label>
              <input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={emailForm.email}
                onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            
            <PasswordField
              id="signup-password"
              label="Password"
              placeholder="Create a password"
              value={emailForm.password}
              onChange={(e) => setEmailForm(prev => ({ ...prev, password: e.target.value }))}
              disabled={isLoading}
            />

            <button type="submit" className="auth-modal__submit-btn" disabled={isLoading}>
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
            
            <button 
              type="button" 
              className="auth-modal__back-btn"
              onClick={() => setCurrentView('providers')}
              disabled={isLoading}
            >
              ← Back to options
            </button>
          </form>
        );

      case 'email-login':
        return (
          <form className="auth-modal__form" onSubmit={handleEmailLogin}>
            <h2 className="auth-modal__title">Welcome back</h2>
            <p className="auth-modal__subtitle">Sign in with your email</p>
            
            <div className="auth-modal__field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={emailForm.email}
                onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            
            <PasswordField
              id="login-password"
              label="Password"
              placeholder="Your password"
              value={emailForm.password}
              onChange={(e) => setEmailForm(prev => ({ ...prev, password: e.target.value }))}
              disabled={isLoading}
            />

            <button type="submit" className="auth-modal__submit-btn" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              className="auth-modal__link auth-modal__forgot-link"
              onClick={() => setCurrentView('forgot-request')}
              disabled={isLoading}
            >
              Forgot password?
            </button>

            <button
              type="button"
              className="auth-modal__back-btn"
              onClick={() => setCurrentView('providers')}
              disabled={isLoading}
            >
              ← Back to options
            </button>
          </form>
        );

      case 'forgot-request':
        return (
          <form className="auth-modal__form" onSubmit={handleForgotRequest}>
            <h2 className="auth-modal__title">Reset your password</h2>
            <p className="auth-modal__subtitle">
              Enter your email and we'll send you a reset code.
            </p>

            <div className="auth-modal__field">
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                placeholder="you@example.com"
                value={emailForm.email}
                onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <button type="submit" className="auth-modal__submit-btn" disabled={isLoading}>
              {isLoading ? 'Sending code...' : 'Send reset code'}
            </button>

            <button
              type="button"
              className="auth-modal__back-btn"
              onClick={() => setCurrentView('email-login')}
              disabled={isLoading}
            >
              ← Back to sign in
            </button>
          </form>
        );

      case 'forgot-reset':
        return (
          <form className="auth-modal__form" onSubmit={handleResetPassword}>
            <h2 className="auth-modal__title">Enter your code</h2>
            <p className="auth-modal__subtitle">
              We sent a 6-digit code to {emailForm.email || 'your email'}. It expires in 5 minutes.
            </p>

            <div className="auth-modal__field">
              <label htmlFor="reset-otp">Reset code</label>
              <input
                id="reset-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={resetForm.otp}
                onChange={(e) => setResetForm(prev => ({ ...prev, otp: e.target.value.replace(/\D/g, '') }))}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <PasswordField
              id="reset-password"
              label="New password"
              placeholder="At least 8 characters"
              value={resetForm.newPassword}
              onChange={(e) => setResetForm(prev => ({ ...prev, newPassword: e.target.value }))}
              disabled={isLoading}
            />

            <PasswordField
              id="reset-confirm"
              label="Confirm new password"
              placeholder="Re-enter your new password"
              value={resetForm.confirm}
              onChange={(e) => setResetForm(prev => ({ ...prev, confirm: e.target.value }))}
              disabled={isLoading}
            />

            <button type="submit" className="auth-modal__submit-btn" disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update password'}
            </button>

            <button
              type="button"
              className="auth-modal__link"
              onClick={() => handleForgotRequest({ preventDefault: () => {} } as React.FormEvent)}
              disabled={isLoading}
            >
              Resend code
            </button>

            <button
              type="button"
              className="auth-modal__back-btn"
              onClick={() => setCurrentView('email-login')}
              disabled={isLoading}
            >
              ← Back to sign in
            </button>
          </form>
        );

      default:
        return (
          <>
            <h2 className="auth-modal__title">
              {signinMode ? 'Welcome back' : 'Get started'}
            </h2>
            <p className="auth-modal__subtitle">
              {signinMode 
                ? 'Sign in to continue to VOXLAE' 
                : 'Create your account to get started'}
            </p>

            <div className="auth-modal__providers">
              {/* Google Sign In */}
              <div className="auth-modal__provider">
                <div 
                  ref={googleBtnRef} 
                  className="auth-modal__google-btn"
                />
              </div>

              {/* Email Auth */}
              <button
                className="auth-modal__provider-btn auth-modal__provider-btn--email"
                onClick={() => setCurrentView(signinMode ? 'email-login' : 'email-signup')}
                disabled={isLoading}
              >
                <span className="auth-modal__provider-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                </span>
                <span>Continue with Email</span>
              </button>
            </div>

            <div className="auth-modal__divider">
              <span>or</span>
            </div>

            <p className="auth-modal__alternate">
              {FEATURES.waitlist ? (
                <>
                  New to Voxlae?{' '}
                  <button className="auth-modal__link" onClick={() => setCurrentView('waitlist')}>
                    Join the waitlist
                  </button>
                </>
              ) : mode === 'signin' ? (
                <>
                  Don't have an account?{' '}
                  <button 
                    className="auth-modal__link"
                    onClick={() => setCurrentView('email-signup')}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button 
                    className="auth-modal__link" 
                    onClick={() => setCurrentView('email-login')}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </>
        );
    }
  };

  if (isPage) {
    return (
      <div className="auth-modal auth-modal--page">
        <div className="auth-modal__content">{renderView()}</div>
      </div>
    );
  }

  return (
    <div className="auth-modal-backdrop" onClick={handleBackdropClick}>
      <div className="auth-modal" role="dialog" aria-modal="true">
        <button 
          className="auth-modal__close" 
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="auth-modal__content">
          {renderView()}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
