import { sql } from "drizzle-orm";
import { db } from "@/db";
import { activateRole, hasRole, RoleNotAssignedError } from "./roles";
import { UserNotFoundError } from "./roles";

/**
 * The influencer setup wizard. Ports `InfluencerSetupService.completeSetup`.
 *
 * A plain static save — no LLM, no session state machine; this already replaced an older AI
 * onboarding flow. Its one job beyond persisting fields is flipping the INFLUENCER role to ACTIVE,
 * which is what unlocks the app for that role.
 */

export interface InfluencerSetup {
  name: string;
  nicheDomain: string;
  nicheSubdomain?: string | null;
  primaryGoal?: string | null;
  experienceLevel?: number | null;
  postingFrequency?: number | null;
  location?: string | null;
}

/** Empty strings become NULL, so an untouched optional field does not read back as `""`. */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function completeInfluencerSetup(
  userId: number,
  setup: InfluencerSetup,
): Promise<void> {
  const exists = await db.execute<{ [key: string]: unknown; user_id: number }>(sql`
    SELECT user_id FROM users WHERE user_id = ${userId}
  `);
  if (!exists[0]) throw new UserNotFoundError();

  // Checked before writing anything: without it, a user without the role would have their profile
  // overwritten and then hit the activation failure, leaving a half-applied setup.
  if (!(await hasRole(userId, "INFLUENCER"))) {
    throw new RoleNotAssignedError("INFLUENCER");
  }

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE users SET
        name = ${setup.name.trim()},
        niche_domain = ${setup.nicheDomain.trim()},
        niche_subdomain = ${blankToNull(setup.nicheSubdomain)},
        primary_goal = ${blankToNull(setup.primaryGoal)},
        experience_level = ${setup.experienceLevel ?? null},
        posting_frequency = ${setup.postingFrequency ?? null},
        location = ${blankToNull(setup.location)},
        onboarding_completed = true
      WHERE user_id = ${userId}
    `);
    await tx.execute(sql`
      UPDATE user_roles SET status = 'ACTIVE'
      WHERE user_id = ${userId} AND role = 'INFLUENCER'
    `);
  });
}

// Re-exported so the route imports one module. `activateRole` is used by the freelancer and brand
// profile saves, which activate their own roles the same way.
export { activateRole };
