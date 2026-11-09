"use client";

/**
 * Input — Reusable text input with label and error support
 */

import React, { useState } from 'react';
import '../../styles/components/Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

/* Eye / eye-off icons for the password visibility toggle. */
const EyeIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.6 18.6 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
);

const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  fullWidth = true,
  id,
  className = '',
  type,
  ...rest
}) => {
  const inputId = id || `vx-input-${label?.replace(/\s/g, '-').toLowerCase()}`;
  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={`vx-input-group ${fullWidth ? 'vx-input-group--full' : ''} ${className}`}>
      {label && (
        <label htmlFor={inputId} className="vx-input-label">
          {label}
        </label>
      )}
      <div className={isPassword ? 'vx-input-wrap' : undefined}>
        <input
          id={inputId}
          type={isPassword ? (revealed ? 'text' : 'password') : type}
          className={`vx-input ${isPassword ? 'vx-input--with-toggle' : ''} ${error ? 'vx-input--error' : ''}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className="vx-input-toggle"
            onClick={() => setRevealed(v => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && <span className="vx-input-error">{error}</span>}
      {hint && !error && <span className="vx-input-hint">{hint}</span>}
    </div>
  );
};

export default Input;
