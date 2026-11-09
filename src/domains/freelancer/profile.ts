import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { toIso, toNumber } from "@/lib/serialize";

/**
 * Freelancer profile read/write. Ports `FreelancerProfileService`.
 *
 * The profile is spread over six tables — the base row plus five child collections that JPA mapped
 * as `@ElementCollection` with `@OrderColumn`. Four of those (`languages`, `tools`,
 * `experience`, `portfolio_items`) have a composite primary key of `(profile_id, sort_order)`, so
 * order is data, not incidental, and writes must renumber from zero. `freelancer_skills` has no
 * sort column at all.
 *
 * Saves use **replace-all** semantics, matching the Java's `clear()`-then-add. That is the right
 * shape for this UI — the edit form submits the whole profile — but it means a save must be
 * transactional: a delete that commits without its inserts leaves the user's portfolio empty.
 */

/** How much of the bio anonymous visitors see. */
const ANON_BIO_CHARS = 160;
/** How many portfolio items anonymous visitors see. */
const ANON_PORTFOLIO_ITEMS = 2;

/** Mirrors the `chk_freelancer_profile_template` CHECK constraint and the UI's template list. */
export const TEMPLATES = [
  "CLASSIC",
  "GALLERY",
  "EDITORIAL",
  "SPOTLIGHT",
  "STUDIO",
  "INDEX",
  "TERMINAL",
  "BRUTALIST",
  "BENTO",
] as const;

export const AVAILABILITY = ["AVAILABLE", "OPEN_TO_OFFERS", "BOOKED"] as const;
export const RATE_UNITS = ["HOUR", "DAY", "PROJECT"] as const;

export interface PortfolioItem {
  title: string;
  outcome?: string | null;
  role?: string | null;
  projectUrl?: string | null;
  thumbnailUrl?: string | null;
  previewTitle?: string | null;
  previewDescription?: string | null;
  previewSite?: string | null;
}

export interface ExperienceEntry {
  title: string;
  organization?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
}

export interface FreelancerProfileResponse {
  id: number | null;
  bio: string | null;
  skills: string[];
  languages: string[];
  tools: string[];
  portfolioItems: PortfolioItem[];
  experienceEntries: ExperienceEntry[];
  experience: string | null;
  headline: string | null;
  avatarUrl: string | null;
  location: string | null;
  availability: string;
  rateAmount: number | null;
  rateCurrency: string | null;
  rateUnit: string | null;
  profileSlug: string | null;
  profileTemplate: string;
  coverImageUrl: string | null;
  coverHiddenOn: string[];
  isComplete: boolean;
  roleStatus: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FreelancerProfileInput {
  bio?: string | null;
  skills?: string[] | null;
  languages?: string[] | null;
  tools?: string[] | null;
  experience?: string | null;
  headline?: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  availability?: string | null;
  rateAmount?: number | null;
  rateCurrency?: string | null;
  rateUnit?: string | null;
  portfolioItems?: PortfolioItem[] | null;
  experienceEntries?: ExperienceEntry[] | null;
}

export class NoFreelancerProfileError extends Error {
  constructor(message = "No freelancer profile to style yet") {
    super(message);
    this.name = "NoFreelancerProfileError";
  }
}

export class MissingFreelancerRoleError extends Error {
  constructor() {
    super("User does not have FREELANCER role");
    this.name = "MissingFreelancerRoleError";
  }
}

/** `"STUDIO,INDEX"` ⇄ `["STUDIO","INDEX"]` — `cover_hidden_on` is a compact CSV column. */
function csvToList(csv: string | null | undefined): string[] {
  if (!csv?.trim()) return [];
  return csv
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function listToCsv(values: string[] | null | undefined): string | null {
  if (!values?.length) return null;
  const cleaned = [...new Set(values.map((v) => v?.trim()).filter(Boolean))];
  return cleaned.length > 0 ? cleaned.join(",") : null;
}

/** The completeness rule from `FreelancerProfile.isComplete` — bio, ≥1 skill, ≥1 portfolio item. */
function isComplete(
  bio: string | null,
  skills: string[],
  portfolioItems: unknown[],
): boolean {
  return Boolean(bio?.trim()) && skills.length > 0 && portfolioItems.length > 0;
}

async function roleStatusOf(userId: number): Promise<string> {
  const rows = await db.execute<{ [key: string]: unknown; status: string }>(sql`
    SELECT status FROM user_roles WHERE user_id = ${userId} AND role = 'FREELANCER'
  `);
  return rows[0]?.status ?? "INCOMPLETE";
}

interface ProfileRow {
  [key: string]: unknown;
  id: number;
  bio: string | null;
  experience: string | null;
  headline: string | null;
  avatar_url: string | null;
  location: string | null;
  availability: string;
  profile_slug: string | null;
  rate_amount: string | null;
  rate_currency: string | null;
  rate_unit: string | null;
  profile_template: string;
  cover_image_url: string | null;
  cover_hidden_on: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const PROFILE_COLUMNS = sql`
  id, bio, experience, headline, avatar_url, location, availability, profile_slug,
  rate_amount, rate_currency, rate_unit, profile_template, cover_image_url, cover_hidden_on,
  created_at, updated_at
`;

/** The five child collections, in their stored order. */
async function loadChildren(profileId: number) {
  const [skills, languages, tools, portfolio, experience] = await Promise.all([
    db.execute<{ [key: string]: unknown; skill: string }>(sql`
      SELECT skill FROM freelancer_skills WHERE profile_id = ${profileId}
    `),
    db.execute<{ [key: string]: unknown; language: string }>(sql`
      SELECT language FROM freelancer_languages WHERE profile_id = ${profileId} ORDER BY sort_order
    `),
    db.execute<{ [key: string]: unknown; tool: string }>(sql`
      SELECT tool FROM freelancer_tools WHERE profile_id = ${profileId} ORDER BY sort_order
    `),
    db.execute<Record<string, unknown>>(sql`
      SELECT title, outcome, role, project_url, thumbnail_url,
             preview_title, preview_description, preview_site
      FROM freelancer_portfolio_items WHERE profile_id = ${profileId} ORDER BY sort_order
    `),
    db.execute<Record<string, unknown>>(sql`
      SELECT title, organization, start_date, end_date, description
      FROM freelancer_experience WHERE profile_id = ${profileId} ORDER BY sort_order
    `),
  ]);

  return {
    skills: skills.map((r) => r.skill),
    languages: languages.map((r) => r.language),
    tools: tools.map((r) => r.tool),
    portfolioItems: portfolio.map(
      (r): PortfolioItem => ({
        title: String(r.title),
        outcome: (r.outcome as string) ?? null,
        role: (r.role as string) ?? null,
        projectUrl: (r.project_url as string) ?? null,
        thumbnailUrl: (r.thumbnail_url as string) ?? null,
        previewTitle: (r.preview_title as string) ?? null,
        previewDescription: (r.preview_description as string) ?? null,
        previewSite: (r.preview_site as string) ?? null,
      }),
    ),
    experienceEntries: experience.map(
      (r): ExperienceEntry => ({
        title: String(r.title),
        organization: (r.organization as string) ?? null,
        // DATE columns come back without a time component; passed through as-is because the UI
        // renders them as dates, and `toIso` would invent a midnight UTC instant.
        startDate: (r.start_date as string) ?? null,
        endDate: (r.end_date as string) ?? null,
        description: (r.description as string) ?? null,
      }),
    ),
  };
}

function toResponse(
  row: ProfileRow,
  children: Awaited<ReturnType<typeof loadChildren>>,
  complete: boolean,
  roleStatus: string,
): FreelancerProfileResponse {
  return {
    id: Number(row.id),
    bio: row.bio,
    skills: children.skills,
    languages: children.languages,
    tools: children.tools,
    portfolioItems: children.portfolioItems,
    experienceEntries: children.experienceEntries,
    experience: row.experience,
    headline: row.headline,
    avatarUrl: row.avatar_url,
    location: row.location,
    availability: row.availability,
    // `numeric` arrives from pg as a string; the frontend does arithmetic on the rate.
    rateAmount: toNumber(row.rate_amount),
    rateCurrency: row.rate_currency,
    rateUnit: row.rate_unit,
    profileSlug: row.profile_slug,
    profileTemplate: row.profile_template,
    coverImageUrl: row.cover_image_url,
    coverHiddenOn: csvToList(row.cover_hidden_on),
    isComplete: complete,
    roleStatus,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * The signed-in freelancer's own profile.
 *
 * A user with the role but no profile row yet gets an empty shell rather than a 404 — the edit form
 * needs something to render, and `availability` has to carry the column's default or the first save
 * trips the CHECK constraint.
 */
export async function getOwnProfile(
  userId: number,
): Promise<FreelancerProfileResponse> {
  const roleStatus = await roleStatusOf(userId);
  const rows = await db.execute<ProfileRow>(sql`
    SELECT ${PROFILE_COLUMNS} FROM freelancer_profiles WHERE user_id = ${userId}
  `);
  const row = rows[0];

  if (!row) {
    return {
      id: null,
      bio: "",
      skills: [],
      languages: [],
      tools: [],
      portfolioItems: [],
      experienceEntries: [],
      experience: "",
      headline: null,
      avatarUrl: null,
      location: null,
      availability: "OPEN_TO_OFFERS",
      rateAmount: null,
      rateCurrency: null,
      rateUnit: null,
      profileSlug: null,
      profileTemplate: "CLASSIC",
      coverImageUrl: null,
      coverHiddenOn: [],
      isComplete: false,
      roleStatus,
      createdAt: null,
      updatedAt: null,
    };
  }

  const children = await loadChildren(Number(row.id));
  /**
   * `roleStatus === ACTIVE || computed` — carried over from the Java, and not redundant. A profile
   * that was complete when the role was activated can later lose a portfolio item; reporting it
   * incomplete would bounce a fully onboarded user back through the setup gate.
   */
  const complete =
    roleStatus === "ACTIVE" ||
    isComplete(row.bio, children.skills, children.portfolioItems);
  return toResponse(row, children, complete, roleStatus);
}

/** Anything that can run a query — `db`, or a transaction handle. */
type Executor = Pick<typeof db, "execute">;

/**
 * An 8-digit random public id, unique across profiles.
 *
 * Deliberately not derived from the name or the user id: the slug appears in a shareable URL, and
 * either derivation would leak something — the person's real name, or how many users exist.
 *
 * **Takes its executor as an argument.** It is called from inside a transaction, and the pool is
 * `max: 1` by design (the pooler does the pooling, not the instance). Querying the outer `db` here
 * would wait for a connection that the enclosing transaction is itself holding — a self-deadlock
 * that hangs the request until the socket times out, with no error to read.
 */
async function allocateSlug(tx: Executor): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = String(10_000_000 + crypto.randomInt(90_000_000));
    const taken = await tx.execute<{ [key: string]: unknown; id: number }>(sql`
      SELECT id FROM freelancer_profiles WHERE lower(profile_slug) = lower(${candidate})
    `);
    if (taken.length === 0) return candidate;
  }
  throw new Error("Could not allocate a unique freelancer profile id");
}

/**
 * Whole-profile save. Ports `saveProfile`.
 *
 * Also recomputes the FREELANCER role status, which is what opens and closes the setup gate.
 */
export async function saveProfile(
  userId: number,
  input: FreelancerProfileInput,
): Promise<FreelancerProfileResponse> {
  const roleRows = await db.execute<{ [key: string]: unknown; status: string }>(sql`
    SELECT status FROM user_roles WHERE user_id = ${userId} AND role = 'FREELANCER'
  `);
  if (!roleRows[0]) throw new MissingFreelancerRoleError();

  const skills = input.skills ?? [];
  const languages = input.languages ?? [];
  const tools = input.tools ?? [];
  const portfolioItems = input.portfolioItems ?? [];
  const experienceEntries = input.experienceEntries ?? [];
  const complete = isComplete(input.bio ?? null, skills, portfolioItems);

  const profileId = await db.transaction(async (tx) => {
    const existing = await tx.execute<{
      [key: string]: unknown;
      id: number;
      profile_slug: string | null;
    }>(sql`
      SELECT id, profile_slug FROM freelancer_profiles WHERE user_id = ${userId}
    `);

    // Allocated once and then never changed — a shared link must not break when the profile is
    // edited, so the slug is deliberately not regenerated on save.
    const slug = existing[0]?.profile_slug || (await allocateSlug(tx));

    let id: number;
    if (existing[0]) {
      id = Number(existing[0].id);
      await tx.execute(sql`
        UPDATE freelancer_profiles SET
          bio = ${input.bio ?? null},
          experience = ${input.experience ?? null},
          headline = ${input.headline ?? null},
          avatar_url = ${input.avatarUrl ?? null},
          location = ${input.location ?? null},
          -- Only overwritten when supplied: the Java left it untouched on null, and the column is
          -- NOT NULL with a CHECK, so writing null would fail the constraint rather than clear it.
          availability = COALESCE(${input.availability ?? null}, availability),
          rate_amount = ${input.rateAmount ?? null},
          rate_currency = ${input.rateCurrency ?? null},
          rate_unit = ${input.rateUnit ?? null},
          profile_slug = ${slug},
          updated_at = now()
        WHERE id = ${id}
      `);
    } else {
      const inserted = await tx.execute<{ [key: string]: unknown; id: number }>(sql`
        INSERT INTO freelancer_profiles
          (user_id, bio, experience, headline, avatar_url, location, availability,
           rate_amount, rate_currency, rate_unit, profile_slug)
        VALUES (${userId}, ${input.bio ?? null}, ${input.experience ?? null},
                ${input.headline ?? null}, ${input.avatarUrl ?? null}, ${input.location ?? null},
                ${input.availability ?? "OPEN_TO_OFFERS"}, ${input.rateAmount ?? null},
                ${input.rateCurrency ?? null}, ${input.rateUnit ?? null}, ${slug})
        RETURNING id
      `);
      id = Number(inserted[0].id);
    }

    // Replace-all, inside the transaction so a failure cannot leave the collections emptied.
    await tx.execute(sql`DELETE FROM freelancer_skills WHERE profile_id = ${id}`);
    await tx.execute(sql`DELETE FROM freelancer_languages WHERE profile_id = ${id}`);
    await tx.execute(sql`DELETE FROM freelancer_tools WHERE profile_id = ${id}`);
    await tx.execute(sql`DELETE FROM freelancer_portfolio_items WHERE profile_id = ${id}`);
    await tx.execute(sql`DELETE FROM freelancer_experience WHERE profile_id = ${id}`);

    for (const skill of skills) {
      await tx.execute(sql`
        INSERT INTO freelancer_skills (profile_id, skill) VALUES (${id}, ${skill})
      `);
    }
    // `sort_order` is renumbered from zero on every save — it is half the composite primary key, so
    // reusing the submitted indexes would collide the moment the user reorders or removes an item.
    for (const [index, language] of languages.entries()) {
      await tx.execute(sql`
        INSERT INTO freelancer_languages (profile_id, sort_order, language)
        VALUES (${id}, ${index}, ${language})
      `);
    }
    for (const [index, tool] of tools.entries()) {
      await tx.execute(sql`
        INSERT INTO freelancer_tools (profile_id, sort_order, tool) VALUES (${id}, ${index}, ${tool})
      `);
    }
    for (const [index, item] of portfolioItems.entries()) {
      await tx.execute(sql`
        INSERT INTO freelancer_portfolio_items
          (profile_id, sort_order, title, outcome, role, project_url, thumbnail_url,
           preview_title, preview_description, preview_site)
        VALUES (${id}, ${index}, ${item.title}, ${item.outcome ?? null}, ${item.role ?? null},
                ${item.projectUrl ?? null}, ${item.thumbnailUrl ?? null}, ${item.previewTitle ?? null},
                ${item.previewDescription ?? null}, ${item.previewSite ?? null})
      `);
    }
    for (const [index, entry] of experienceEntries.entries()) {
      await tx.execute(sql`
        INSERT INTO freelancer_experience
          (profile_id, sort_order, title, organization, start_date, end_date, description)
        VALUES (${id}, ${index}, ${entry.title}, ${entry.organization ?? null},
                ${entry.startDate ?? null}, ${entry.endDate ?? null}, ${entry.description ?? null})
      `);
    }

    // Completing the profile is what flips FREELANCER to ACTIVE — there is no separate setup
    // endpoint for this role, unlike the influencer wizard.
    await tx.execute(sql`
      UPDATE user_roles SET status = ${complete ? "ACTIVE" : "INCOMPLETE"}
      WHERE user_id = ${userId} AND role = 'FREELANCER'
    `);

    return id;
  });

  const rows = await db.execute<ProfileRow>(sql`
    SELECT ${PROFILE_COLUMNS} FROM freelancer_profiles WHERE id = ${profileId}
  `);
  const children = await loadChildren(profileId);
  return toResponse(rows[0], children, complete, complete ? "ACTIVE" : "INCOMPLETE");
}

export interface AppearanceInput {
  profileTemplate?: string | null;
  coverImageUrl?: string | null;
  coverHiddenOn?: string[] | null;
}

/**
 * Partial appearance update. Ports `updateAppearance`.
 *
 * Absent fields are left unchanged so the templates page and the edit dialog can each own their part
 * without clobbering the other. An unrecognised template is silently ignored rather than rejected —
 * the Java did the same, and the CHECK constraint would turn it into a 500 otherwise.
 */
export async function updateAppearance(
  userId: number,
  input: AppearanceInput,
): Promise<FreelancerProfileResponse> {
  const rows = await db.execute<{ [key: string]: unknown; id: number }>(sql`
    SELECT id FROM freelancer_profiles WHERE user_id = ${userId}
  `);
  if (!rows[0]) throw new NoFreelancerProfileError();
  const id = Number(rows[0].id);

  const template =
    input.profileTemplate && (TEMPLATES as readonly string[]).includes(input.profileTemplate)
      ? input.profileTemplate
      : null;
  const cover =
    input.coverImageUrl === undefined || input.coverImageUrl === null
      ? undefined
      : input.coverImageUrl.trim() || null;

  await db.execute(sql`
    UPDATE freelancer_profiles SET
      profile_template = COALESCE(${template}, profile_template),
      -- An empty string means "remove the cover", which is why this is a three-state field:
      -- undefined leaves it alone, "" clears it, a url sets it.
      cover_image_url = ${cover === undefined ? sql`cover_image_url` : sql`${cover}`},
      cover_hidden_on = ${
        input.coverHiddenOn === undefined || input.coverHiddenOn === null
          ? sql`cover_hidden_on`
          : sql`${listToCsv(input.coverHiddenOn)}`
      },
      updated_at = now()
    WHERE id = ${id}
  `);

  return getOwnProfile(userId);
}

export interface PublicProfile {
  name: string | null;
  headline: string | null;
  avatarUrl: string | null;
  location: string | null;
  availability: string;
  rateAmount: number | null;
  rateCurrency: string | null;
  rateUnit: string | null;
  skills: string[];
  languages: string[];
  tools: string[];
  bio: string | null;
  portfolioItems: PortfolioItem[];
  portfolioTotal: number;
  experienceEntries: ExperienceEntry[];
  experienceTotal: number;
  contactEmail: string | null;
  profileSlug: string | null;
  profileTemplate: string;
  coverImageUrl: string | null;
  coverHiddenOn: string[];
  limited: boolean;
}

/**
 * Public profile by slug, with LinkedIn-style partial gating. Ports `getPublicProfile`.
 *
 * An anonymous viewer gets a truncated bio, at most two portfolio items, no experience, no rate and
 * no contact email. The totals are still returned so the UI can honestly say "and 6 more" rather
 * than pretending the rest does not exist.
 *
 * The gating happens here, server-side, not in the response shape the client filters — the whole
 * point is that the withheld fields never leave the server.
 */
export async function getPublicProfile(
  slug: string,
  authenticated: boolean,
): Promise<PublicProfile | null> {
  const rows = await db.execute<ProfileRow & { name: string | null; email: string }>(sql`
    SELECT fp.id, fp.bio, fp.experience, fp.headline, fp.avatar_url, fp.location,
           fp.availability, fp.profile_slug, fp.rate_amount, fp.rate_currency, fp.rate_unit,
           fp.profile_template, fp.cover_image_url, fp.cover_hidden_on,
           fp.created_at, fp.updated_at, u.name, u.email
    FROM freelancer_profiles fp
    JOIN users u ON u.user_id = fp.user_id
    WHERE lower(fp.profile_slug) = lower(${slug})
  `);
  const row = rows[0];
  if (!row) return null;

  const children = await loadChildren(Number(row.id));
  const limited = !authenticated;

  let bio = row.bio;
  if (limited && bio && bio.length > ANON_BIO_CHARS) {
    bio = `${bio.slice(0, ANON_BIO_CHARS).trimEnd()}…`;
  }

  return {
    name: row.name,
    headline: row.headline,
    avatarUrl: row.avatar_url,
    location: row.location,
    availability: row.availability,
    rateAmount: limited ? null : toNumber(row.rate_amount),
    rateCurrency: limited ? null : row.rate_currency,
    rateUnit: limited ? null : row.rate_unit,
    skills: children.skills,
    languages: children.languages,
    tools: children.tools,
    bio,
    portfolioItems: limited
      ? children.portfolioItems.slice(0, ANON_PORTFOLIO_ITEMS)
      : children.portfolioItems,
    portfolioTotal: children.portfolioItems.length,
    experienceEntries: limited ? [] : children.experienceEntries,
    experienceTotal: children.experienceEntries.length,
    contactEmail: limited ? null : row.email,
    profileSlug: row.profile_slug,
    profileTemplate: row.profile_template,
    coverImageUrl: row.cover_image_url,
    coverHiddenOn: csvToList(row.cover_hidden_on),
    limited,
  };
}
