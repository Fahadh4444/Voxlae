"use client";

/**
 * Local (prototype) persistence for a freelancer's profile appearance.
 *
 * Frontend-first: the chosen template, cover image, and which templates suppress
 * that cover live in localStorage keyed by slug so the picker page + edit dialog
 * drive the public profile immediately, before any backend column exists. Phase 2
 * replaces this with persisted fields from the API (see BACKLOG.md).
 */

import { ProfileTemplateId } from '../../../api/types';

export interface ProfileAppearance {
  template?: ProfileTemplateId;
  coverImageUrl?: string;
  /** Templates on which the cover image should NOT render (it looks wrong there). */
  coverHiddenOn?: ProfileTemplateId[];
}

const KEY = (slug: string) => `voxlae:profile-appearance:${slug}`;

const VALID: ProfileTemplateId[] = [
  'CLASSIC', 'GALLERY', 'EDITORIAL', 'SPOTLIGHT', 'STUDIO', 'INDEX', 'TERMINAL', 'BRUTALIST', 'BENTO',
];

/** Narrow an arbitrary string to a known template id, or undefined. */
export const asTemplateId = (value?: string | null): ProfileTemplateId | undefined =>
  value && (VALID as string[]).includes(value) ? (value as ProfileTemplateId) : undefined;

export const getLocalAppearance = (slug?: string | null): ProfileAppearance => {
  if (!slug) return {};
  try {
    const raw = localStorage.getItem(KEY(slug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProfileAppearance;
    return {
      template: asTemplateId(parsed.template),
      coverImageUrl: parsed.coverImageUrl,
      coverHiddenOn: Array.isArray(parsed.coverHiddenOn)
        ? (parsed.coverHiddenOn.map(asTemplateId).filter(Boolean) as ProfileTemplateId[])
        : undefined,
    };
  } catch {
    return {};
  }
};

export const setLocalAppearance = (slug: string, patch: ProfileAppearance): void => {
  try {
    const next = { ...getLocalAppearance(slug), ...patch };
    localStorage.setItem(KEY(slug), JSON.stringify(next));
  } catch {
    /* storage disabled — prototype selection simply won't persist */
  }
};

/** Is the cover suppressed on this template? */
export const isCoverHidden = (appearance: ProfileAppearance, id: ProfileTemplateId): boolean =>
  !!appearance.coverHiddenOn?.includes(id);

/** Toggle whether the cover renders on a specific template. */
export const setCoverHidden = (slug: string, id: ProfileTemplateId, hidden: boolean): void => {
  const set = new Set(getLocalAppearance(slug).coverHiddenOn ?? []);
  if (hidden) set.add(id); else set.delete(id);
  setLocalAppearance(slug, { coverHiddenOn: Array.from(set) });
};
