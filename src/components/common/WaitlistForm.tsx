"use client";

/**
 * WaitlistForm — email + who they are, posted to /api/waitlist.
 *
 * Rendered inside AuthModal while Voxlae is invite-only, which is what puts it behind every
 * "Get started" / "Sign in" button on the site without touching each one.
 */

import React, { useState } from 'react';
import { joinWaitlist } from '../../api/services';
import type { WaitlistRole } from '../../api/types';

const ROLES: { value: WaitlistRole; label: string }[] = [
  { value: 'CREATOR', label: 'Creator' },
  { value: 'BRAND', label: 'Brand' },
  { value: 'FREELANCER', label: 'Freelancer' },
];

interface Props {
  defaultRole?: WaitlistRole;
  source?: string;
  /** Shown above the form, e.g. why a sign-in was just refused. */
  notice?: string | null;
  /** Renders "Already have access? Log in" when given. */
  onSignIn?: () => void;
}

const WaitlistForm: React.FC<Props> = ({ defaultRole = 'CREATOR', source = 'landing', notice, onSignIn }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WaitlistRole>(defaultRole);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('sending');
    try {
      await joinWaitlist({ email: email.trim(), role, source });
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStatus('idle');
    }
  };

  if (status === 'done') {
    return (
      <div className="auth-modal__form">
        <h2 className="auth-modal__title">You&apos;re on the list 🎉</h2>
        <p className="auth-modal__subtitle">
          We&apos;re letting people in a few at a time. We&apos;ll email <b>{email.trim()}</b> as soon as
          your spot opens.
        </p>
      </div>
    );
  }

  return (
    <form className="auth-modal__form" onSubmit={submit}>
      <h2 className="auth-modal__title">Join the waitlist</h2>
      <p className="auth-modal__subtitle">
        Voxlae is invite-only while we get it right. Leave your email and we&apos;ll let you in soon.
      </p>
      {notice && <p className="auth-modal__notice" role="status">{notice}</p>}

      <div className="auth-modal__field">
        <label htmlFor="waitlist-email">Email</label>
        <input
          id="waitlist-email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'sending'}
          autoFocus
        />
      </div>

      <div className="auth-modal__field">
        <label>I&apos;m a</label>
        <div className="auth-modal__roles" role="radiogroup" aria-label="I'm a">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={role === r.value}
              className={`auth-modal__role${role === r.value ? ' auth-modal__role--active' : ''}`}
              onClick={() => setRole(r.value)}
              disabled={status === 'sending'}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="auth-modal__error" role="alert">{error}</p>}

      <button type="submit" className="auth-modal__submit-btn" disabled={status === 'sending' || !email.trim()}>
        {status === 'sending' ? 'Joining…' : 'Join the waitlist'}
      </button>

      {onSignIn && (
        <p className="auth-modal__alternate">
          Already have access?{' '}
          <button type="button" className="auth-modal__link" onClick={onSignIn}>Log in</button>
        </p>
      )}
    </form>
  );
};

export default WaitlistForm;
