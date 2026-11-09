import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { brandProfiles, userRoles } from "@/db/schema";
import { toIso } from "@/lib/serialize";

/**
 * Brand profile read. Ported from `BrandProfileService.getProfile`.
 *
 * Note on the `isComplete` key: the Java DTO declares `private boolean isComplete` under Lombok
 * `@Data`, whose getter is `isComplete()` — which Jackson normally serialises as `complete`,
 * not `isComplete`. The frontend's type declares `isComplete` and reads `response.isComplete`,
 * guarded by `roleStatus === ACTIVE || response.isComplete`, so if Spring really does emit
 * `complete` that field has been silently undefined all along and the roleStatus check has been
 * carrying it.
 *
 * This emits `isComplete`, matching the declared TypeScript contract and the reading code. Worth
 * confirming against a live Spring response when one is to hand; if it turns out to emit
 * `complete`, nothing breaks either way because of that guard.
 */

export type RoleStatus = "INCOMPLETE" | "ACTIVE";

export interface BrandProfileResponse {
  id: number | null;
  companyName: string;
  industry: string;
  description: string;
  website: string;
  companySize: string | null;
  lookingFor: string | null;
  isComplete: boolean;
  roleStatus: RoleStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

/** BRAND role status, defaulting to INCOMPLETE when the user holds no such role. */
async function getRoleStatus(userId: number): Promise<RoleStatus> {
  const [row] = await db
    .select({ status: userRoles.status })
    .from(userRoles)
    .where(sql`${userRoles.userId} = ${userId} AND ${userRoles.role} = 'BRAND'`)
    .limit(1);
  return row?.status === "ACTIVE" ? "ACTIVE" : "INCOMPLETE";
}

export async function getBrandProfile(
  userId: number,
): Promise<BrandProfileResponse> {
  const [profile] = await db
    .select()
    .from(brandProfiles)
    .where(eq(brandProfiles.userId, userId))
    .limit(1);

  const roleStatus = await getRoleStatus(userId);

  if (!profile) {
    // Empty-shell response, matching the Java branch — empty strings rather than nulls, because
    // the profile form binds them straight into controlled inputs.
    return {
      id: null,
      companyName: "",
      industry: "",
      description: "",
      website: "",
      companySize: null,
      lookingFor: null,
      isComplete: false,
      roleStatus,
      createdAt: null,
      updatedAt: null,
    };
  }

  // roleStatus is the source of truth; the field check is the fallback, same as the Java.
  const fieldsFilled =
    Boolean(profile.companyName?.trim()) && Boolean(profile.description?.trim());

  return {
    id: Number(profile.id),
    companyName: profile.companyName ?? "",
    industry: profile.industry ?? "",
    description: profile.description ?? "",
    website: profile.website ?? "",
    companySize: profile.companySize ?? null,
    lookingFor: profile.lookingFor ?? null,
    isComplete: roleStatus === "ACTIVE" || fieldsFilled,
    roleStatus,
    createdAt: toIso(profile.createdAt),
    updatedAt: toIso(profile.updatedAt),
  };
}

export interface BrandProfileInput {
  companyName?: string | null;
  industry?: string | null;
  description?: string | null;
  website?: string | null;
  companySize?: string | null;
  lookingFor?: string | null;
}

export class MissingBrandRoleError extends Error {
  constructor() {
    super("User does not have BRAND role");
    this.name = "MissingBrandRoleError";
  }
}

/**
 * Empty/whitespace becomes NULL, matching the Java's field-by-field coercion.
 *
 * Not cosmetic: `isComplete` is `companyName != null && description != null`, so a form submitted
 * with `""` in those fields would otherwise read as complete and activate the BRAND role on an empty
 * profile.
 */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Create or update the brand profile. Ports `BrandProfileService.saveProfile`.
 *
 * Completing the profile is what flips the BRAND role from INCOMPLETE to ACTIVE — there is no
 * separate setup endpoint for this role, unlike the influencer wizard.
 */
export async function saveBrandProfile(
  userId: number,
  input: BrandProfileInput,
): Promise<BrandProfileResponse> {
  const roleRows = await db.execute<{ [key: string]: unknown; status: string }>(sql`
    SELECT status FROM user_roles WHERE user_id = ${userId} AND role = 'BRAND'
  `);
  if (!roleRows[0]) throw new MissingBrandRoleError();

  const companyName = blankToNull(input.companyName);
  const description = blankToNull(input.description);
  const complete = Boolean(companyName) && Boolean(description);

  await db.transaction(async (tx) => {
    // `brand_profiles.user_id` is UNIQUE, so the upsert is a single statement — no read-then-write
    // race where two concurrent saves both decide to insert.
    await tx.execute(sql`
      INSERT INTO brand_profiles
        (user_id, company_name, industry, description, website, company_size, looking_for)
      VALUES (${userId}, ${companyName}, ${blankToNull(input.industry)}, ${description},
              ${blankToNull(input.website)}, ${blankToNull(input.companySize)},
              ${blankToNull(input.lookingFor)})
      ON CONFLICT (user_id) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        industry = EXCLUDED.industry,
        description = EXCLUDED.description,
        website = EXCLUDED.website,
        company_size = EXCLUDED.company_size,
        looking_for = EXCLUDED.looking_for,
        updated_at = now()
    `);
    await tx.execute(sql`
      UPDATE user_roles SET status = ${complete ? "ACTIVE" : "INCOMPLETE"}
      WHERE user_id = ${userId} AND role = 'BRAND'
    `);
  });

  return getBrandProfile(userId);
}
