"use client";

/**
 * AuthPage — the full-page sign-in (/signin) and sign-up (/signup) experience.
 *
 * Split layout: a dark brand panel in the landing page's palette on the left, and the auth card on
 * the right — the same AuthModal content rendered with `variant="page"`, so the sign-in, sign-up,
 * forgot-password and waitlist flows exist exactly once. On narrow screens the brand panel collapses
 * to a compact header above the card.
 *
 * `/signup` shows the waitlist while Voxlae is invite-only; `?role=CREATOR|BRAND|FREELANCER`
 * pre-selects who they are (the landing page's "Grow as a creator" / "Get hired" / "Find talent").
 */

import React from 'react';
import AuthModal from '../common/AuthModal';
import VoxlaeLogo from '../common/VoxlaeLogo';
import { Link, useNavigate, useSearchParams } from '@/lib/router';
import { FEATURES } from '../../config/features';
import type { WaitlistRole } from '../../api/types';
import '../../styles/pages/AuthPage.css';

const PILLARS = [
  { k: 'Creators', t: 'See how your content really performs — and turn comments into DMs automatically.' },
  { k: 'Freelancers', t: 'A profile that gets you found and hired by the people who need you.' },
  { k: 'Brands', t: 'Find the right creators and freelancers by the signals that matter.' },
];

const ROLES: WaitlistRole[] = ['CREATOR', 'BRAND', 'FREELANCER'];

const AuthPage: React.FC<{ mode: 'signin' | 'signup' }> = ({ mode }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roleParam = params.get('role')?.toUpperCase() as WaitlistRole | undefined;
  const waitlistRole = roleParam && ROLES.includes(roleParam) ? roleParam : undefined;
  /** From the "You're in" email — opens "Create your account" for the invited address. */
  const inviteToken = mode === 'signup' ? params.get('invite') ?? undefined : undefined;

  return (
    <div className="auth-page">
      <aside className="auth-page__brand" aria-hidden="false">
        <div className="auth-page__blob auth-page__blob--1" />
        <div className="auth-page__blob auth-page__blob--2" />

        <Link to="/" className="auth-page__logo" aria-label="Voxlae home">
          <VoxlaeLogo size={34} darkMode />
        </Link>

        <div className="auth-page__pitch">
          {FEATURES.waitlist && <span className="auth-page__eyebrow">Invite-only beta</span>}
          <h1>
            Grow as a creator, get hired, <span className="auth-page__accent">or find people to work with.</span>
          </h1>
          <ul className="auth-page__pillars">
            {PILLARS.map((p) => (
              <li key={p.k}>
                <b>{p.k}</b>
                <span>{p.t}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-page__fine">© {new Date().getFullYear()} Voxlae</p>
      </aside>

      <main className="auth-page__main">
        <div className="auth-page__topbar">
          <Link to="/" className="auth-page__logo auth-page__logo--mobile" aria-label="Voxlae home">
            <VoxlaeLogo size={30} />
          </Link>
          <Link to="/" className="auth-page__back">← Back to home</Link>
        </div>

        <div className="auth-page__card-wrap">
          <AuthModal
            isOpen
            variant="page"
            mode={mode}
            waitlistRole={waitlistRole}
            inviteToken={inviteToken}
            onClose={() => navigate('/')}
          />
        </div>

        <nav className="auth-page__legal">
          <Link to="/privacy">Privacy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/terms">Terms</Link>
        </nav>
      </main>
    </div>
  );
};

export default AuthPage;
