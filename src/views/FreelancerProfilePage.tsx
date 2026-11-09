"use client";

/**
 * FreelancerProfilePage — the landing spot for a freelancer with no public
 * profile yet (/freelancer/profile).
 *
 * Editing lives in FreelancerProfileDialog, on the profile page itself — this
 * page exists only to get a brand-new freelancer their first profile. Once one
 * is saved they get a public id, and we send them to their real profile, which
 * is where they live from then on.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { getFreelancerProfile } from '../api/services';
import { FreelancerProfileResponse } from '../api/types';
import Button from '../components/common/Button';
import VoxlaeLoader from '../components/common/VoxlaeLoader';
import FreelancerProfileDialog from '../components/freelancer/FreelancerProfileDialog';
import '../styles/pages/FreelancerProfilePage.css';

const FreelancerProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<FreelancerProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    getFreelancerProfile()
      .then(data => {
        // Already has a public profile? That page is the real home — go there.
        if (data.profileSlug) {
          navigate(`/f/${data.profileSlug}`, { replace: true });
          return;
        }
        setProfile(data);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="freelancer-profile-page">
        <VoxlaeLoader variant="page" label="Loading…" />
      </div>
    );
  }

  return (
    <div className="freelancer-profile-page">
      <div className="freelancer-profile-page__empty">
        <div className="freelancer-profile-page__empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="40" height="40">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>

        <h1>Build your profile</h1>
        <p>
          This is what clients see when they find you — your work, your skills and
          how to reach you. It takes a few minutes, and you can refine it any time.
        </p>

        <ul className="freelancer-profile-page__checklist">
          <li>A headline that says what you do, and for whom</li>
          <li>Portfolio projects led by the result, not the task</li>
          <li>Your skills, tools, languages and rate</li>
        </ul>

        <Button variant="primary" onClick={() => setEditOpen(true)}>
          Create my profile
        </Button>
      </div>

      <FreelancerProfileDialog
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onSaved={(saved) => {
          // The first save mints the public id — that page becomes their home
          if (saved.profileSlug) {
            navigate(`/f/${saved.profileSlug}`, { replace: true });
          }
        }}
      />
    </div>
  );
};

export default FreelancerProfilePage;
