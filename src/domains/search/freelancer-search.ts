import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { toNumber } from "@/lib/serialize";

/**
 * Freelancer directory search.
 *
 * Ported from `SearchService.searchFreelancers` + `FreelancerSpecifications`, with one
 * deliberate behavioural improvement: **the sort and limit now happen in the database.**
 *
 * The Java version calls `findAll(spec)` — every matching profile is loaded as an entity, then
 * scored, sorted and truncated to 24 in application memory. That is fine at a few hundred
 * freelancers and degrades linearly; the work is already expressible in SQL, so it is done there.
 * Same ordering, same scores, bounded result set.
 *
 * Collection filters stay correlated EXISTS subqueries rather than joins, for the reason the
 * Java comment gives: joining skills × tools × languages multiplies rows (5 × 4 × 3 = 60 per
 * freelancer) and forces a DISTINCT over the whole product.
 */

export const MAX_RESULTS = 60;
export const DEFAULT_LIMIT = 24;

export interface FreelancerSearchFilters {
  keyword?: string;
  skills?: string[];
  tools?: string[];
  languages?: string[];
  location?: string;
  availability?: string;
  maxRate?: number;
  rateCurrency?: string;
}

export interface FreelancerSearchResult {
  userId: number;
  name: string;
  bio: string | null;
  headline: string | null;
  avatarUrl: string | null;
  location: string | null;
  availability: string;
  profileSlug: string | null;
  rateAmount: number | null;
  rateCurrency: string | null;
  rateUnit: string | null;
  projectCount: number;
  skills: string[];
  tools: string[];
  languages: string[];
}

function clean(values: string[] | undefined): string[] {
  return (values ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean);
}

/** Comma-separated bind parameters: `$1, $2, ...` — every value still parameterised. */
function bindList(values: (string | number)[]): SQL {
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );
}

/**
 * "Has ANY of these values", as a correlated EXISTS against a child table.
 * `column` and `table` are internal literals, never user input.
 *
 * IN rather than `= ANY(...)`: Drizzle expands a JS array in a template into a parameter list
 * `($1, $2)`, which is the shape IN wants and the one ANY rejects with
 * "op ANY/ALL (array) requires array on right side".
 */
function anyOf(table: string, column: string, wanted: string[]): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ${sql.raw(table)} t
    WHERE t.profile_id = fp.id AND lower(t.${sql.raw(column)}) IN (${bindList(wanted)})
  )`;
}

export async function searchFreelancers(
  filters: FreelancerSearchFilters,
  limit: number = DEFAULT_LIMIT,
): Promise<FreelancerSearchResult[]> {
  const conditions: SQL[] = [
    // Only freelancers whose role is actually active — same gate as the Specification.
    sql`EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = u.user_id AND ur.role = 'FREELANCER' AND ur.status = 'ACTIVE'
    )`,
  ];

  const keyword = filters.keyword?.trim().toLowerCase();
  if (keyword) {
    const like = `%${keyword}%`;
    conditions.push(
      sql`(lower(u.name) LIKE ${like} OR lower(fp.headline) LIKE ${like} OR lower(fp.bio) LIKE ${like})`,
    );
  }

  const location = filters.location?.trim().toLowerCase();
  if (location) {
    conditions.push(sql`lower(fp.location) LIKE ${`%${location}%`}`);
  }

  if (filters.availability?.trim()) {
    conditions.push(sql`fp.availability = ${filters.availability.trim()}`);
  }

  // Rate only compares like-for-like: 2000 INR/hr is not "cheaper" than 50 USD/hr, so a max-rate
  // filter without a currency is ignored rather than silently comparing across currencies.
  if (filters.maxRate != null && filters.rateCurrency?.trim()) {
    conditions.push(
      sql`(fp.rate_currency = ${filters.rateCurrency.trim()} AND fp.rate_amount <= ${filters.maxRate})`,
    );
  }

  const skills = clean(filters.skills);
  if (skills.length) conditions.push(anyOf("freelancer_skills", "skill", skills));
  const tools = clean(filters.tools);
  if (tools.length) conditions.push(anyOf("freelancer_tools", "tool", tools));
  const languages = clean(filters.languages);
  if (languages.length)
    conditions.push(anyOf("freelancer_languages", "language", languages));

  const where = sql.join(conditions, sql` AND `);
  const capped = Math.max(1, Math.min(limit, MAX_RESULTS));

  /**
   * Profile strength, weighted identically to `SearchService.strengthOf` — and to the
   * freelancer's own strength meter, so what we tell them to improve is what actually moves them
   * up the list.
   */
  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT
      u.user_id       AS user_id,
      u.name          AS name,
      fp.id           AS profile_id,
      fp.bio, fp.headline, fp.avatar_url, fp.location, fp.availability,
      fp.profile_slug, fp.rate_amount, fp.rate_currency, fp.rate_unit,
      (SELECT count(*) FROM freelancer_portfolio_items pi WHERE pi.profile_id = fp.id) AS project_count,
      (
        LEAST((SELECT count(*) FROM freelancer_portfolio_items pi WHERE pi.profile_id = fp.id), 3) * 10
        + CASE WHEN coalesce(btrim(fp.headline), '') <> '' THEN 15 ELSE 0 END
        + CASE WHEN EXISTS (SELECT 1 FROM freelancer_skills s WHERE s.profile_id = fp.id) THEN 15 ELSE 0 END
        + CASE WHEN coalesce(btrim(fp.avatar_url), '') <> '' THEN 10 ELSE 0 END
        + CASE WHEN coalesce(btrim(fp.bio), '') <> '' THEN 10 ELSE 0 END
        + CASE WHEN EXISTS (SELECT 1 FROM freelancer_tools t WHERE t.profile_id = fp.id) THEN 5 ELSE 0 END
        + CASE WHEN EXISTS (SELECT 1 FROM freelancer_languages l WHERE l.profile_id = fp.id) THEN 5 ELSE 0 END
        + CASE WHEN fp.rate_amount IS NOT NULL THEN 5 ELSE 0 END
        + CASE WHEN EXISTS (SELECT 1 FROM freelancer_experience e WHERE e.profile_id = fp.id) THEN 5 ELSE 0 END
      ) AS strength
    FROM freelancer_profiles fp
    JOIN users u ON u.user_id = fp.user_id
    WHERE ${where}
    ORDER BY strength DESC, fp.updated_at DESC NULLS LAST
    LIMIT ${capped}
  `);

  if (rows.length === 0) return [];

  // Child collections fetched in one pass for the page of results, rather than per row.
  const ids = rows.map((r) => Number(r.profile_id));
  const [skillRows, toolRows, langRows] = await Promise.all([
    db.execute<{ profile_id: number; value: string }>(
      sql`SELECT profile_id, skill AS value FROM freelancer_skills WHERE profile_id IN (${bindList(ids)}) ORDER BY skill`,
    ),
    db.execute<{ profile_id: number; value: string }>(
      sql`SELECT profile_id, tool AS value FROM freelancer_tools WHERE profile_id IN (${bindList(ids)}) ORDER BY sort_order`,
    ),
    db.execute<{ profile_id: number; value: string }>(
      sql`SELECT profile_id, language AS value FROM freelancer_languages WHERE profile_id IN (${bindList(ids)}) ORDER BY sort_order`,
    ),
  ]);

  const group = (src: { profile_id: number; value: string }[]) => {
    const map = new Map<number, string[]>();
    for (const r of src) {
      const key = Number(r.profile_id);
      const list = map.get(key);
      if (list) list.push(r.value);
      else map.set(key, [r.value]);
    }
    return map;
  };
  const bySkill = group(skillRows);
  const byTool = group(toolRows);
  const byLang = group(langRows);

  return rows.map((r) => {
    const pid = Number(r.profile_id);
    return {
      userId: Number(r.user_id),
      name: String(r.name),
      bio: (r.bio as string) ?? null,
      headline: (r.headline as string) ?? null,
      avatarUrl: (r.avatar_url as string) ?? null,
      location: (r.location as string) ?? null,
      availability: String(r.availability),
      profileSlug: (r.profile_slug as string) ?? null,
      rateAmount: toNumber(r.rate_amount as string | null),
      rateCurrency: (r.rate_currency as string) ?? null,
      rateUnit: (r.rate_unit as string) ?? null,
      projectCount: Number(r.project_count ?? 0),
      skills: bySkill.get(pid) ?? [],
      tools: byTool.get(pid) ?? [],
      languages: byLang.get(pid) ?? [],
    };
  });
}

/** Directory counts. Two COUNTs, no rows loaded — same as `getFreelancerStats`. */
export async function getFreelancerStats(): Promise<{
  listed: number;
  total: number;
}> {
  const rows = await db.execute<{ listed: string; total: string }>(sql`
    SELECT
      count(*) FILTER (WHERE status = 'ACTIVE') AS listed,
      count(*)                                  AS total
    FROM user_roles WHERE role = 'FREELANCER'
  `);
  const row = rows[0];
  return { listed: Number(row?.listed ?? 0), total: Number(row?.total ?? 0) };
}
