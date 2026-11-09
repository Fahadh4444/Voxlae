"use client";

/**
 * FreelancerTemplatesPage — the "Profile Templates" area in the freelancer
 * sidebar. Browse the template catalogue, preview each one live, and pick the
 * look for your public profile. Also sets the optional cover image.
 *
 * Frontend-first: the choice is saved to localStorage (see appearanceStore) and
 * drives /freelancer/:slug immediately. Phase 2 persists it to the backend so
 * anonymous visitors see it too (see BACKLOG.md).
 */

import React, { useEffect, useState } from 'react';
import { Link } from '@/lib/router';
import { useUser } from '../context/UserContext';
import { useUI } from '../context/UIContext';
import { getFreelancerProfile, saveAppearance } from '../api/services';
import { ProfileTemplateId } from '../api/types';
import { FREELANCER_PROFILE_EDITOR } from '../utils/roleRoutes';
import { TEMPLATES } from '../components/freelancer/templates';
import TemplateThumb from '../components/freelancer/templates/TemplateThumb';
import VoxlaeLoader from '../components/common/VoxlaeLoader';
import { getLocalAppearance, setLocalAppearance } from '../components/freelancer/templates/appearanceStore';
import '../styles/pages/FreelancerTemplatesPage.css';

const FreelancerTemplatesPage: React.FC = () => {
  const { user, isAuthLoading } = useUser();
  const { showToast } = useUI();

  const [slug, setSlug] = useState<string | null>(user?.freelancerSlug || null);
  const [selected, setSelected] = useState<ProfileTemplateId>('CLASSIC');
  // Whether the freelancer actually has a profile — resolved from the fetch, not
  // from context, so we never flash "Build my profile" before auth has hydrated.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to hydrate — freelancerSlug arrives async via /auth/me, so
    // reading it too early makes an existing profile look absent.
    if (isAuthLoading) return;
    let cancelled = false;
    setLoading(true);

    getFreelancerProfile()
      .then((p) => {
        if (cancelled) return;
        const resolved = p.profileSlug || user?.freelancerSlug || null;
        setSlug(resolved);
        const local = getLocalAppearance(resolved);
        setSelected(local.template ?? p.profileTemplate ?? 'CLASSIC');
      })
      .catch(() => {
        // No saved profile (or fetch failed) — fall back to whatever context has.
        if (!cancelled) setSlug(user?.freelancerSlug || null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [isAuthLoading, user?.freelancerSlug]);

  const choose = (id: ProfileTemplateId) => {
    if (!slug) return;
    setSelected(id);            // optimistic
    setLocalAppearance(slug, { template: id });
    const name = TEMPLATES.find(t => t.id === id)?.name ?? 'Template';
    // Persist so the shared link shows this template on every device.
    saveAppearance({ profileTemplate: id })
      .then(() => showToast(`${name} applied to your profile`, 'success'))
      .catch(() => showToast(`Applied locally, but couldn't publish ${name}. Please try again.`, 'error'));
  };

  const previewHref = (id: ProfileTemplateId) => `/f/${slug}?template=${id}`;

  // Still resolving auth + profile — don't guess yet.
  if (isAuthLoading || loading) {
    return (
      <div className="ftp">
        <VoxlaeLoader variant="page" label="Loading…" />
      </div>
    );
  }

  // Confirmed: no public profile yet → nothing to theme. Send them to build one.
  if (!slug) {
    return (
      <div className="ftp">
        <div className="ftp__empty">
          <h1>Profile Templates</h1>
          <p>Create your public profile first — then you can dress it up with a template.</p>
          <Link to={FREELANCER_PROFILE_EDITOR} className="ftp__btn ftp__btn--primary">Build my profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ftp">
      <header className="ftp__head">
        <div>
          <h1 className="ftp__title">Profile Templates</h1>
          <p className="ftp__sub">
            Pick the look of your public profile. Every template shows the same
            details — only the styling changes. Preview any of them before you commit.
          </p>
        </div>
        <Link to={`/f/${slug}`} className="ftp__btn ftp__btn--ghost">View my profile ↗</Link>
      </header>

      {/* ── Template grid ──
          The thumbnail is a live-preview link (opens the profile with ?template).
          Applying the template only ever happens via the explicit button below. */}
      <div className="ftp__grid">
        {TEMPLATES.map((t) => {
          const isSelected = selected === t.id;
          return (
            <div key={t.id} className={`ftp__card ${isSelected ? 'ftp__card--selected' : ''}`}>
              <a
                className="ftp__card-pick"
                href={previewHref(t.id)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Preview the ${t.name} template`}
              >
                <span className="ftp__thumb"><TemplateThumb id={t.id} /></span>
                {isSelected && (
                  <span className="ftp__selected-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="14" height="14">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Selected
                  </span>
                )}
                <span className="ftp__thumb-hint">Click to preview ↗</span>
              </a>
              <div className="ftp__card-body">
                <div className="ftp__card-head">
                  <h2 className="ftp__card-name">{t.name}</h2>
                  <a className="ftp__preview" href={previewHref(t.id)} target="_blank" rel="noopener noreferrer">
                    Preview ↗
                  </a>
                </div>
                <p className="ftp__card-tagline">{t.tagline}</p>
                <p className="ftp__card-bestfor"><span>Best for</span> {t.bestFor}</p>
                <button
                  type="button"
                  className={`ftp__btn ${isSelected ? 'ftp__btn--done' : 'ftp__btn--primary'} ftp__btn--block`}
                  onClick={() => choose(t.id)}
                  disabled={isSelected}
                >
                  {isSelected ? '✓ Using this template' : 'Use this template'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="ftp__footnote">
        Saved to this browser while we finish the designs. Soon your choice will
        publish automatically so every visitor sees it.
      </p>
    </div>
  );
};

export default FreelancerTemplatesPage;
