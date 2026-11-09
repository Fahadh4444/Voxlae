"use client";

/**
 * ProfileStrengthCard — the owner's rail on their own profile.
 *
 * Replaces what used to be a duplicate Edit/Share button stack. It answers the
 * two questions an owner actually has: "is this good enough to get me hired?"
 * and "who can even see this?"
 *
 * Every item is weighted by how much it actually affects getting hired — the
 * portfolio dominates because that's what clients decide on.
 */

import React from 'react';
import { FreelancerProfileResponse } from '../../api/types';
import '../../styles/components/ProfileStrengthCard.css';

interface Check {
  label: string;
  done: boolean;
  /** Why it matters — shown only when it's missing, so it reads as advice, not noise. */
  why: string;
  weight: number;
}

interface Props {
  profile: FreelancerProfileResponse | null;
  publicUrl: string;
  onEdit: () => void;
  onShare: () => void;
}

const ProfileStrengthCard: React.FC<Props> = ({ profile, publicUrl, onEdit, onShare }) => {
  const checks: Check[] = [
    {
      label: 'Headline',
      done: !!profile?.headline?.trim(),
      why: 'The first line clients read.',
      weight: 15,
    },
    {
      label: 'Profile photo',
      done: !!profile?.avatarUrl?.trim(),
      why: 'Profiles with a face get taken seriously.',
      weight: 10,
    },
    {
      label: 'Bio',
      done: !!profile?.bio?.trim(),
      why: 'Say what you solve, and for whom.',
      weight: 10,
    },
    {
      label: '3+ portfolio projects',
      done: (profile?.portfolioItems?.length || 0) >= 3,
      why: 'Clients decide on your work, not your words.',
      weight: 30,
    },
    {
      label: 'Skills',
      done: (profile?.skills?.length || 0) > 0,
      why: 'This is what client search matches on.',
      weight: 15,
    },
    {
      label: 'Tools',
      done: (profile?.tools?.length || 0) > 0,
      why: 'Clients often filter by the software you use.',
      weight: 5,
    },
    {
      label: 'Languages',
      done: (profile?.languages?.length || 0) > 0,
      why: 'Matters for anyone hiring across regions.',
      weight: 5,
    },
    {
      label: 'Rate',
      done: profile?.rateAmount != null,
      why: 'Filters out enquiries that were never going to fit.',
      weight: 5,
    },
    {
      label: 'Experience',
      done: (profile?.experienceEntries?.length || 0) > 0,
      why: 'Backs up the portfolio with a track record.',
      weight: 5,
    },
  ];

  const score = checks.reduce((sum, c) => sum + (c.done ? c.weight : 0), 0);
  const missing = checks.filter(c => !c.done);

  const tier =
    score >= 90 ? { label: 'Excellent', className: 'is-strong' }
    : score >= 65 ? { label: 'Good', className: 'is-good' }
    : score >= 35 ? { label: 'Getting there', className: 'is-fair' }
    : { label: 'Just started', className: 'is-weak' };

  return (
    <div className="vx-strength">
      <div className="vx-strength__head">
        <span className="vx-strength__label">Profile strength</span>
        <span className={`vx-strength__tier ${tier.className}`}>{tier.label}</span>
      </div>

      <div
        className="vx-strength__bar"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Profile strength"
      >
        <div className={`vx-strength__fill ${tier.className}`} style={{ width: `${score}%` }} />
      </div>
      <span className="vx-strength__score">{score}% complete</span>

      {missing.length > 0 ? (
        <>
          <p className="vx-strength__nudge">
            {missing.length === 1 ? 'One thing left:' : `${missing.length} things would make this stronger:`}
          </p>
          <ul className="vx-strength__list">
            {missing.slice(0, 4).map(c => (
              <li key={c.label}>
                <span className="vx-strength__dot" aria-hidden="true" />
                <span>
                  <b>{c.label}</b>
                  <em>{c.why}</em>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="vx-strength__done">
          Your profile is complete. Share the link — that's what gets you found.
        </p>
      )}

      <button type="button" className="vx-strength__cta" onClick={onEdit}>
        {missing.length > 0 ? 'Improve profile' : 'Edit profile'}
      </button>

      {/* Owners consistently ask "who can actually see this?" — answer it here. */}
      <div className="vx-strength__link">
        <span className="vx-strength__link-label">Your public link</span>
        <code>{publicUrl.replace(/^https?:\/\//, '')}</code>
        <button type="button" onClick={onShare}>Copy link</button>
        <p className="vx-strength__visibility">
          Anyone with the link sees a preview. Full portfolio, rate and contact
          are shown only to signed-in clients.
        </p>
      </div>
    </div>
  );
};

export default ProfileStrengthCard;
