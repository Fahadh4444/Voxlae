"use client";

/**
 * FreelancerPublicProfilePage — the profile at /freelancer/:slug.
 *
 * A thin container: it loads the data, computes the derived values once, resolves
 * which artistic template the freelancer picked, and renders that template. The
 * layout itself lives in components/freelancer/templates/*.
 *
 * One container serves three audiences:
 *  - anonymous visitors → standalone page, gated teaser (limited=true), sign-in CTA
 *  - signed-in visitors → full profile inside the dashboard chrome, Contact CTA
 *  - the owner          → same page, plus Edit (this is their "My Profile")
 *
 * Template resolution (prototype): ?template=<id> preview → local pick
 * (localStorage, set by the Profile Templates page) → saved profile.profileTemplate
 * → CLASSIC. Backend persistence lands in phase 2 (see BACKLOG.md).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from '@/lib/router';
import { getPublicFreelancerProfile, getFreelancerProfile } from '../api/services';
import { FreelancerPublicProfile, FreelancerProfileResponse, ProfileTemplateId } from '../api/types';
import { useUser } from '../context/UserContext';
import { useUI } from '../context/UIContext';
import { formatRate } from '../data/profileOptions';
import AuthModal from '../components/common/AuthModal';
import VoxlaeLogo from '../components/common/VoxlaeLogo';
import VoxlaeLoader from '../components/common/VoxlaeLoader';
import Seo from '../components/common/Seo';
import { ogImageUrl, absoluteUrl } from '../utils/seo';
import DashboardLayout from '../components/layout/DashboardLayout';
import FreelancerProfileDialog from '../components/freelancer/FreelancerProfileDialog';
import { TEMPLATE_COMPONENTS } from '../components/freelancer/templates';
import { enquirySubject } from '../components/freelancer/templates/shared';
import { getLocalAppearance, asTemplateId, isCoverHidden } from '../components/freelancer/templates/appearanceStore';
import '../styles/pages/FreelancerPublicProfilePage.css';

const FreelancerPublicProfilePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useUser();
  const { showToast } = useUI();

  const [profile, setProfile] = useState<FreelancerPublicProfile | null>(null);
  const [ownProfile, setOwnProfile] = useState<FreelancerProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  /** The owner is the signed-in user whose own public id matches this page. */
  const isOwner = isAuthenticated && !!slug && user?.freelancerSlug === slug;
  const embedded = isAuthenticated;

  const wrap = useCallback((node: React.ReactNode) => (
    embedded
      ? <DashboardLayout><div className="fpp fpp--embedded">{node}</div></DashboardLayout>
      : <div className="fpp">{node}</div>
  ), [embedded]);

  const load = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    getPublicFreelancerProfile(slug)
      .then(setProfile)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // The owner needs the *editable* shape — the public one is gated and trimmed
  useEffect(() => {
    if (!isOwner) return;
    getFreelancerProfile().then(setOwnProfile).catch(() => setOwnProfile(null));
  }, [isOwner]);

  const handleShare = async () => {
    const url = `${window.location.origin}/f/${slug}`;
    const title = profile ? `${profile.name} — Voxlae` : 'Voxlae freelancer profile';
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // share sheet dismissed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Profile link copied', 'success');
    } catch {
      showToast(url, 'info');
    }
  };

  if (loading) {
    return wrap(
      <div className="fpp__center-slot">
        <VoxlaeLoader variant="page" label="Loading profile…" />
      </div>
    );
  }

  if (notFound || !profile) {
    return wrap(
      <div className="fpp__center-slot">
        <div className="fpp__notfound">
          <h1>Profile not found</h1>
          <p>This freelancer profile doesn't exist or isn't public yet.</p>
          <Link to="/" className="fpp__btn fpp__btn--primary">Go to Voxlae</Link>
        </div>
      </div>
    );
  }

  // ── Derived values, computed once and threaded into the chosen template ──
  const hiddenProjects = profile.portfolioTotal - profile.portfolioItems.length;
  const availability = profile.availability || 'OPEN_TO_OFFERS';
  const rate = formatRate(profile.rateAmount, profile.rateCurrency, profile.rateUnit);
  const firstName = profile.name.split(' ')[0];
  const publicUrl = `${window.location.origin}/f/${slug}`;
  const contactHref = (!profile.limited && profile.contactEmail)
    ? `mailto:${profile.contactEmail}?subject=${enquirySubject(profile.name)}`
    : null;

  // ── SEO / social preview — mirrors the crawler HTML the backend serves at
  //   /api/seo/render, and points og:image at the freelancer's generated card. ──
  const seoTitle = profile.headline
    ? `${profile.name} — ${profile.headline} | Voxlae`
    : `${profile.name} — Freelancer on Voxlae`;
  const seoDescription = (profile.bio && profile.bio.trim())
    ? profile.bio.trim().slice(0, 200)
    : [profile.headline, (profile.skills || []).slice(0, 6).join(', ')]
        .filter(Boolean).join(' · ') || `${profile.name} on Voxlae.`;
  const seoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: profile.name,
      ...(profile.headline ? { jobTitle: profile.headline } : {}),
      ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
      description: seoDescription,
      url: absoluteUrl(`/f/${slug}`),
      worksFor: { '@type': 'Organization', name: 'Voxlae' },
    },
  };

  // ── Resolve the active template + cover image ──
  const local = getLocalAppearance(slug);
  const activeTemplate: ProfileTemplateId =
    asTemplateId(searchParams.get('template'))
    ?? local.template
    ?? profile.profileTemplate
    ?? 'CLASSIC';
  const rawCover = local.coverImageUrl ?? profile.coverImageUrl ?? undefined;
  // The user can suppress the cover on templates where it looks wrong — honour both
  // the local pick and what the backend persisted (so it applies on every device).
  const coverHidden = isCoverHidden(local, activeTemplate)
    || (profile.coverHiddenOn?.includes(activeTemplate) ?? false);
  const coverImageUrl = coverHidden ? undefined : rawCover;
  const Template = TEMPLATE_COMPONENTS[activeTemplate] ?? TEMPLATE_COMPONENTS.CLASSIC;

  return wrap(
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        canonicalPath={`/f/${slug}`}
        image={`${ogImageUrl('f', slug || '')}?v=${profile.profileTemplate ?? 'CLASSIC'}`}
        imageAlt={`${profile.name} — Voxlae`}
        type="profile"
        jsonLd={seoJsonLd}
      />
      {!embedded && (
        <header className="fpp__topbar">
          <Link to="/" className="fpp__logo" aria-label="Voxlae home">
            <VoxlaeLogo size={26} variant="full" darkMode />
          </Link>
          {profile.limited && (
            <button className="fpp__btn fpp__btn--ghost" onClick={() => setAuthOpen(true)}>
              Sign in
            </button>
          )}
        </header>
      )}

      <Template
        profile={profile}
        ownProfile={ownProfile}
        slug={slug || ''}
        publicUrl={publicUrl}
        isOwner={!!isOwner}
        firstName={firstName}
        rate={rate}
        availability={availability}
        hiddenProjects={hiddenProjects}
        coverImageUrl={coverImageUrl}
        contactHref={contactHref}
        onShare={handleShare}
        onAuth={() => setAuthOpen(true)}
        onEdit={() => setEditOpen(true)}
      />

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} mode="signin" />

      {isOwner && (
        <FreelancerProfileDialog
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          profile={ownProfile}
          onSaved={(saved) => {
            setOwnProfile(saved);
            load(); // re-read the public view so the page shows what clients now see
          }}
        />
      )}
    </>
  );
};

export default FreelancerPublicProfilePage;
