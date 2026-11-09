import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Influencer directory search.
 *
 * Ported from `SearchService.searchInfluencers` / `UserRepository.searchActiveInfluencers`,
 * which was already a native query — so this is a direct translation rather than a
 * reinterpretation of JPA criteria.
 *
 * Note the deliberate asymmetry with freelancer search: there is no strength scoring or ordering
 * here because the Java version has none either. Adding one would be a product change smuggled in
 * as a migration.
 */

export interface InfluencerSearchResult {
  userId: number;
  name: string;
  niche: string | null;
  location: string | null;
}

/** Trim, lowercase, null when blank — matching `SearchService.normalize`. */
function normalize(value: string | undefined | null): string | null {
  if (!value || !value.trim()) return null;
  return value.trim().toLowerCase();
}

export async function searchInfluencers(
  keyword?: string,
  niche?: string,
): Promise<InfluencerSearchResult[]> {
  const k = normalize(keyword);
  const n = normalize(niche);

  const rows = await db.execute<{
    user_id: number;
    name: string;
    niche_domain: string | null;
    location: string | null;
  }>(sql`
    SELECT DISTINCT u.user_id, u.name, u.niche_domain, u.location
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.user_id
    WHERE ur.role = 'INFLUENCER'
      AND ur.status = 'ACTIVE'
      AND (${k}::text IS NULL OR u.name ILIKE '%' || ${k} || '%')
      AND (${n}::text IS NULL OR u.niche_domain ILIKE '%' || ${n} || '%')
  `);

  return rows.map((r) => ({
    userId: Number(r.user_id),
    name: String(r.name),
    niche: r.niche_domain ?? null,
    location: r.location ?? null,
  }));
}
