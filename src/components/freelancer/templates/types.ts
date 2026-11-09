"use client";

/**
 * Shared contract for every profile template.
 *
 * The public profile page ([FreelancerPublicProfilePage]) is a thin container: it
 * loads the data, computes the derived values once, and hands them to whichever
 * template the freelancer picked. Every template renders the SAME data — only the
 * presentation differs — and every template must preserve the three audiences and
 * the `limited` gate (locked tiles + sign-in CTAs) the container relies on.
 */

import { FreelancerPublicProfile, FreelancerProfileResponse, ProfileTemplateId } from '../../../api/types';

export interface ProfileTemplateProps {
  /** The (possibly gated) public profile being rendered. */
  profile: FreelancerPublicProfile;
  /** The owner's full editable profile — only Classic uses it (strength card). */
  ownProfile: FreelancerProfileResponse | null;
  slug: string;
  /** Absolute URL of this public profile (for the strength card / share). */
  publicUrl: string;
  isOwner: boolean;
  firstName: string;
  /** Pre-formatted rate string, or null when hidden. */
  rate: string | null;
  /** Normalised availability key (AVAILABLE | OPEN_TO_OFFERS | BOOKED). */
  availability: string;
  /** Portfolio items hidden behind the gate (anonymous teaser). */
  hiddenProjects: number;
  /** Optional hero/cover background image. */
  coverImageUrl?: string;
  /** mailto: contact link, or null when the visitor can't contact yet. */
  contactHref: string | null;
  onShare: () => void;
  onAuth: () => void;
  onEdit: () => void;
}

export interface TemplateMeta {
  id: ProfileTemplateId;
  name: string;
  tagline: string;
  bestFor: string;
}

/** The catalogue shown in the sidebar picker, in display order. */
export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'CLASSIC',
    name: 'Classic',
    tagline: 'Clean, professional, résumé-style',
    bestFor: 'Consultants, strategists, anyone who wants the safe default',
  },
  {
    id: 'GALLERY',
    name: 'Gallery',
    tagline: 'Portfolio-first — your work fills the screen',
    bestFor: 'Designers, photographers, illustrators, 3D artists',
  },
  {
    id: 'EDITORIAL',
    name: 'Editorial',
    tagline: 'A magazine spread with big display type',
    bestFor: 'Art directors, writers, brand designers',
  },
  {
    id: 'SPOTLIGHT',
    name: 'Spotlight',
    tagline: 'Immersive dark theme with a cinematic glow',
    bestFor: 'Motion & video editors, game and music creators',
  },
  {
    id: 'STUDIO',
    name: 'Studio',
    tagline: 'Swiss minimal — monochrome and spacious',
    bestFor: 'Architects, product & type designers',
  },
  {
    id: 'INDEX',
    name: 'Index',
    tagline: 'Experimental hover-preview project list',
    bestFor: 'Multidisciplinary creatives who love a designed index',
  },
  {
    id: 'TERMINAL',
    name: 'Terminal',
    tagline: 'A hacker terminal — monospace, code-block work',
    bestFor: 'Developers, technical & generative artists',
  },
  {
    id: 'BRUTALIST',
    name: 'Brutalist',
    tagline: 'Loud neo-brutalism: hard shadows, thick borders',
    bestFor: 'Bold designers, illustrators, agencies with attitude',
  },
  {
    id: 'BENTO',
    name: 'Bento',
    tagline: 'A rounded bento-box mosaic of your highlights',
    bestFor: 'Product designers & multi-hyphenates',
  },
];
