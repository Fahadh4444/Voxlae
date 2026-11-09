"use client";

/**
 * EmailVerificationPage — Verify email with OTP code
 * 
 * Shows after email signup to verify the email address.
 * User enters the 6-digit OTP sent to their email.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from '@/lib/router';
import { useUser } from '../context/UserContext';
import { useUI } from '../context/UIContext';
import { verifyEmailOtp, resendEmailOtp } from '../api/services';
import { getDashboardRoute } from '../utils/roleRoutes';
import '../styles/pages/EmailVerificationPage.css';

const EmailVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, setIsNewUser } = useUser();
  const { showToast } = useUI();
  
  // Get email from navigation state
  const email = location.state?.email || localStorage.getItem('pendingVerificationEmail') || '';
  
  // OTP input state (6 digits)
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Store email in localStorage for page refresh scenarios
  useEffect(() => {
    if (email) {
      localStorage.setItem('pendingVerificationEmail', email);
    }
  }, [email]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Handle OTP input change
  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newOtp = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
      setOtp(newOtp);
      // Focus the next empty input or last input
      const nextIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  // Verify OTP
  const handleVerify = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      showToast('Please enter the complete 6-digit code', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const response = await verifyEmailOtp({ email, otp: otpString });
      
      // Store auth data
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('userName', response.name);
      localStorage.setItem('email', response.email);
      localStorage.setItem('emailVerified', 'true');
      localStorage.setItem('isNewUser', String(response.isNewUser ?? true));
      localStorage.removeItem('pendingVerificationEmail');
      
      // Login user
      login(response.name, response.email, response.accessToken, {
        isNewUser: response.isNewUser ?? true,
        emailVerified: true,
        roles: response.roles || [],
        activeRole: response.activeRole || null,
      });
      
      showToast('Email verified successfully!', 'success');
      
      // Navigate to role selection (new users without role)
      if (response.isNewUser || !response.activeRole) {
        setIsNewUser(true);
        navigate('/select-role');
      } else {
        // Navigate to role-specific dashboard
        const dashboardRoute = getDashboardRoute(response.activeRole);
        navigate(dashboardRoute);
      }
    } catch (err) {
      console.error('[EmailVerification] Verify error:', err);
      showToast(err instanceof Error ? err.message : 'Verification failed. Please try again.', 'error');
      // Clear OTP inputs
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    try {
      setIsLoading(true);
      const response = await resendEmailOtp({ email });
      showToast('New verification code sent to your email', 'success');
      setResendCooldown(60); // 60 second cooldown
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
      // In dev mode, show the OTP
      if (response.devOtp) {
        console.log('DEV MODE - OTP:', response.devOtp);
        showToast(`DEV: OTP is ${response.devOtp}`, 'info');
      }
    } catch (err) {
      console.error('[EmailVerification] Resend error:', err);
      showToast(err instanceof Error ? err.message : 'Failed to resend code. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect if no email
  if (!email) {
    return (
      <div className="email-verification-page">
        <div className="verification-container">
          <h1>Verification Required</h1>
          <p>No email address found. Please sign up again.</p>
          <button 
            className="vx-btn vx-btn--primary"
            onClick={() => navigate('/')}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="email-verification-page">
      <div className="verification-container">
        <div className="verification-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        
        <h1>Verify Your Email</h1>
        <p className="verification-subtitle">
          We've sent a 6-digit code to<br />
          <strong>{email}</strong>
        </p>

        <div className="otp-container" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleOtpChange(index, e.target.value)}
              onKeyDown={e => handleKeyDown(index, e)}
              className="otp-input"
              autoFocus={index === 0}
              disabled={isLoading}
            />
          ))}
        </div>

        <button
          className="vx-btn vx-btn--primary verify-btn"
          onClick={handleVerify}
          disabled={isLoading || otp.join('').length !== 6}
        >
          {isLoading ? 'Verifying...' : 'Verify Email'}
        </button>

        <div className="resend-section">
          <span>Didn't receive the code?</span>
          <button
            className="resend-btn"
            onClick={handleResend}
            disabled={isLoading || resendCooldown > 0}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;
