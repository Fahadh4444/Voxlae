import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { freelancerProfiles, freelancerSkills, users } from "@/db/schema";
import { toIso } from "@/lib/serialize";

/**
 * Public freelancer profile — the first read path migrated off Spring.
 *
 * Chosen first deliberately: it is read-only, anonymous, and the single most-shared URL on the
 * platform, so it is where server-rendered metadata actually pays off. It replaces the
 * `/api/seo/render` crawler path, whose whole existence was a workaround for the SPA having no
 * server-rendered HTML.
 */

export interface PublicProfileCard {
  slug: string;
  name: string;
  headline: string | null;
  location: string | null;
  availability: string;
  avatarUrl: string | null;
  profileTemplate: string;
  skills: string[];
  bio: string | null;
  updatedAt: string | null;
}

/**
 * Fetch the fields needed for metadata and the OG card.
 *
 * Deliberately narrower than Spring's `getPublicProfile`: that returns rate, contact email,
 * portfolio and experience, gated on whether the caller is authenticated. None of that belongs in
 * a `<meta>` tag or a social preview, and fetching it here would mean reproducing the
 * anonymous-gating rules in a second place — the exact kind of duplication that drifts. The
 * interactive page still calls the existing endpoint for the full, gated payload.
 *
 * Slug matching is case-insensitive, matching `findByProfileSlugIgnoreCase`.
 */
export async function getPublicProfileCard(
  slug: string,
): Promise<PublicProfileCard | null> {
  const [profile] = await db
    .select({
      id: freelancerProfiles.id,
      slug: freelancerProfiles.profileSlug,
      name: users.name,
      headline: freelancerProfiles.headline,
      location: freelancerProfiles.location,
      availability: freelancerProfiles.availability,
      avatarUrl: freelancerProfiles.avatarUrl,
      profileTemplate: freelancerProfiles.profileTemplate,
      bio: freelancerProfiles.bio,
      updatedAt: freelancerProfiles.updatedAt,
    })
    .from(freelancerProfiles)
    .innerJoin(users, eq(users.userId, sql`${freelancerProfiles.userId}`))
    .where(sql`lower(${freelancerProfiles.profileSlug}) = lower(${slug})`)
    .limit(1);

  if (!profile?.slug) return null;

  const skills = await db
    .select({ skill: freelancerSkills.skill })
    .from(freelancerSkills)
    .where(eq(freelancerSkills.profileId, Number(profile.id)))
    .orderBy(asc(freelancerSkills.skill));

  return {
    slug: profile.slug,
    name: profile.name,
    headline: profile.headline,
    location: profile.location,
    availability: profile.availability,
    avatarUrl: profile.avatarUrl,
    profileTemplate: profile.profileTemplate,
    skills: skills.map((s) => s.skill),
    bio: profile.bio,
    updatedAt: toIso(profile.updatedAt),
  };
}

/** Every public slug, for the sitemap. Replaces `FreelancerProfileRepository.findPublicSlugs`. */
export async function listPublicSlugs(): Promise<
  { slug: string; updatedAt: string | null }[]
> {
  const rows = await db
    .select({
      slug: freelancerProfiles.profileSlug,
      updatedAt: freelancerProfiles.updatedAt,
    })
    .from(freelancerProfiles)
    .where(
      and(
        isNotNull(freelancerProfiles.profileSlug),
        sql`btrim(${freelancerProfiles.profileSlug}) <> ''`,
      ),
    );
  return rows
    .filter((r): r is { slug: string; updatedAt: string | null } => Boolean(r.slug))
    .map((r) => ({ slug: r.slug.trim(), updatedAt: toIso(r.updatedAt) }));
}

/**
 * Cache-busting token for the OG image, derived from what the card actually shows.
 *
 * Carried over from Spring's `cardVersion`: when the freelancer edits a visible field the URL
 * changes, so Facebook/X/LinkedIn re-fetch instead of serving a stale preview from their own
 * long-lived caches. Hashing the *visible* fields (not `updatedAt`) means an unrelated edit does
 * not invalidate previews everywhere.
 */
export function cardVersion(card: PublicProfileCard): string {
  const basis = [
    card.name,
    card.headline ?? "",
    card.location ?? "",
    card.availability,
    card.avatarUrl ?? "",
    card.profileTemplate,
    card.skills.join(","),
  ].join("|");

  let hash = 0;
  for (let i = 0; i < basis.length; i++) {
    hash = (Math.imul(31, hash) + basis.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
