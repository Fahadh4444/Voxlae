import { sql } from "drizzle-orm";
import { db } from "@/db";
import { signAccessToken, type Role } from "./jwt";
import { rotateRefreshToken } from "./refresh-token";

/**
 * Role switching. Ports `RoleService.switchActiveRole` **and fixes Security #2**.
 *
 * The Java updates `active_role` in the database and returns `{success, message, activeRole,
 * previousRole}` — **no new token**. The caller's JWT still carries the old `activeRole` claim.
 *
 * That was harmless while nothing authorized on the claim. It is not harmless now: `requireRole`
 * checks `activeRole`, so after switching away from a role a user keeps that role's access for the
 * remaining lifetime of their access token (up to 15 minutes). Switching *to* a role they hold is
 * the benign direction; switching *away* — the case where someone drops a privileged role — is the
 * one that matters.
 *
 * So the switch now issues a fresh access token carrying the new `activeRole`, and rotates the
 * refresh token with it, so the old pair cannot be replayed to recover the previous role.
 *
 * **What this does not do, precisely.** The previously-issued access token is a signed JWT and
 * cannot be revoked — it keeps working until it expires. Verified: after switching away from
 * INFLUENCER the new token gets 403 on an INFLUENCER endpoint while the old one still gets 200.
 * What the fix guarantees is that the caller immediately *holds* a correct token and that the old
 * refresh token is dead, so the stale role cannot be extended beyond the access-token TTL
 * (`JWT_ACCESS_TOKEN_EXPIRATION_MS`, currently 15 minutes).
 *
 * Closing that window entirely needs either much shorter access tokens or a server-side
 * revocation list — a real tradeoff, not an oversight, and worth deciding deliberately rather than
 * assuming this fix covers it.
 */

export interface SwitchRoleResult {
  success: true;
  message: string;
  activeRole: Role;
  previousRole: Role | null;
  /** New tokens — the frontend must replace both. */
  accessToken: string;
  refreshToken: string;
}

export class RoleNotAssignedError extends Error {
  constructor(role: string) {
    super(`You do not have the ${role} role`);
    this.name = "RoleNotAssignedError";
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super("User not found");
    this.name = "UserNotFoundError";
  }
}

export async function switchActiveRole(
  userId: number,
  role: Role,
  currentRefreshToken: string,
): Promise<SwitchRoleResult> {
  const users = await db.execute<{ email: string; active_role: string | null }>(sql`
    SELECT email, active_role FROM users WHERE user_id = ${userId}
  `);
  const user = users[0];
  if (!user) throw new UserNotFoundError();

  // The user must actually hold the role. Checked against user_roles, not the request.
  const held = await db.execute<{ role: string }>(sql`
    SELECT role FROM user_roles WHERE user_id = ${userId}
  `);
  const heldRoles = held.map((r) => r.role as Role);
  if (!heldRoles.includes(role)) throw new RoleNotAssignedError(role);

  const previousRole = (user.active_role as Role | null) ?? null;

  /**
   * Rotate the refresh token **before** flipping the role.
   *
   * If rotation fails (already used, revoked, expired) the switch must not happen at all —
   * otherwise the database says one role while the caller still holds a token for the other, which
   * is precisely the split-brain this fix exists to remove.
   */
  const rotated = await rotateRefreshToken(currentRefreshToken);
  if (rotated.userId !== userId) {
    // The refresh token belongs to someone else. Refuse rather than mint a token for this user.
    throw new UserNotFoundError();
  }

  await db.execute(sql`
    UPDATE users SET active_role = ${role} WHERE user_id = ${userId}
  `);

  const accessToken = await signAccessToken({
    userId,
    email: user.email,
    roles: heldRoles,
    activeRole: role,
  });

  return {
    success: true,
    message: `Switched to ${role}`,
    activeRole: role,
    previousRole,
    accessToken,
    refreshToken: rotated.token,
  };
}

// ==================== ROLE ASSIGNMENT ====================

export interface UserRoleDto {
  role: Role;
  status: string;
  verificationStatus: string;
}

export class InvalidRoleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRoleError";
  }
}

/** Every role the user holds, with its setup and verification state. */
export async function getUserRoles(userId: number): Promise<UserRoleDto[]> {
  const rows = await db.execute<{
    [key: string]: unknown;
    role: string;
    status: string;
    verification_status: string;
  }>(sql`
    SELECT role, status, verification_status
    FROM user_roles WHERE user_id = ${userId}
    ORDER BY created_at
  `);
  return rows.map((r) => ({
    role: r.role as Role,
    status: r.status,
    verificationStatus: r.verification_status,
  }));
}

/** The user's active role, or null if they hold none. */
export async function getActiveRole(userId: number): Promise<Role | null> {
  const rows = await db.execute<{ [key: string]: unknown; active_role: string | null }>(sql`
    SELECT active_role FROM users WHERE user_id = ${userId}
  `);
  return (rows[0]?.active_role as Role | null) ?? null;
}

/** The active role together with its status — what the UI's feature gates read. */
export async function getActiveRoleStatus(userId: number): Promise<UserRoleDto | null> {
  const rows = await db.execute<{
    [key: string]: unknown;
    role: string;
    status: string;
    verification_status: string;
  }>(sql`
    SELECT ur.role, ur.status, ur.verification_status
    FROM user_roles ur
    JOIN users u ON u.active_role = ur.role AND u.user_id = ur.user_id
    WHERE ur.user_id = ${userId}
  `);
  const row = rows[0];
  if (!row) return null;
  return {
    role: row.role as Role,
    status: row.status,
    verificationStatus: row.verification_status,
  };
}

/**
 * Assign a role. Ports `RoleService.addRole`.
 *
 * Idempotent: an already-held role is returned unchanged rather than erroring, because the
 * role-selection screen can be submitted twice and the second submit should be a no-op, not a
 * failure.
 *
 * **ADMIN is refused.** It is the one role that is not self-service, and the check is here rather
 * than only in the route so it cannot be bypassed by a second caller reaching the domain directly.
 */
export async function addRole(userId: number, role: Role): Promise<UserRoleDto> {
  if (role === "ADMIN") {
    throw new InvalidRoleError("ADMIN role cannot be self-assigned");
  }

  const existing = await db.execute<{
    [key: string]: unknown;
    role: string;
    status: string;
    verification_status: string;
  }>(sql`
    SELECT role, status, verification_status
    FROM user_roles WHERE user_id = ${userId} AND role = ${role}
  `);
  if (existing[0]) {
    return {
      role: existing[0].role as Role,
      status: existing[0].status,
      verificationStatus: existing[0].verification_status,
    };
  }

  const userExists = await db.execute<{ [key: string]: unknown; user_id: number }>(sql`
    SELECT user_id FROM users WHERE user_id = ${userId}
  `);
  if (!userExists[0]) throw new UserNotFoundError();

  /**
   * Every new role starts INCOMPLETE: the role-setup wizard is what flips it to ACTIVE (influencer
   * via the setup endpoint, freelancer/brand via their first profile save). Starting ACTIVE would
   * let a user past the gate with an empty profile.
   *
   * `VERIFIED` for the three self-service roles matches `determineInitialVerificationStatus` —
   * verification is not currently a manual review step for them.
   */
  const inserted = await db.execute<{
    [key: string]: unknown;
    role: string;
    status: string;
    verification_status: string;
  }>(sql`
    INSERT INTO user_roles (user_id, role, status, verification_status)
    VALUES (${userId}, ${role}, 'INCOMPLETE', 'VERIFIED')
    -- Concurrent double-submit: the unique (user_id, role) turns the second insert into a no-op
    -- rather than a 500, and RETURNING still needs a row, hence the UPDATE form.
    ON CONFLICT (user_id, role) DO UPDATE SET role = user_roles.role
    RETURNING role, status, verification_status
  `);

  // First role becomes the active one, so the user is never left holding roles with none active —
  // which would make every role-guarded endpoint refuse them.
  await db.execute(sql`
    UPDATE users SET active_role = ${role}
    WHERE user_id = ${userId} AND active_role IS NULL
  `);

  return {
    role: inserted[0].role as Role,
    status: inserted[0].status,
    verificationStatus: inserted[0].verification_status,
  };
}

/** Update the editable profile fields. Currently just the display name. */
export async function updateDisplayName(
  userId: number,
  name: string,
): Promise<boolean> {
  const rows = await db.execute<{ [key: string]: unknown; user_id: number }>(sql`
    UPDATE users SET name = ${name.trim()} WHERE user_id = ${userId}
    RETURNING user_id
  `);
  return rows.length > 0;
}

/**
 * Flip a role from INCOMPLETE to ACTIVE. Ports `RoleService.activateRole`.
 *
 * This is the gate the frontend setup wizard opens. Conditioning the update on the row existing
 * (rather than upserting) is what keeps it from activating a role the user was never assigned.
 */
export async function activateRole(userId: number, role: Role): Promise<void> {
  const rows = await db.execute<{ [key: string]: unknown; id: number }>(sql`
    UPDATE user_roles SET status = 'ACTIVE'
    WHERE user_id = ${userId} AND role = ${role}
    RETURNING id
  `);
  if (rows.length === 0) throw new RoleNotAssignedError(role);
}

/** Whether the user holds a role at all, regardless of its status. */
export async function hasRole(userId: number, role: Role): Promise<boolean> {
  const rows = await db.execute<{ [key: string]: unknown; id: number }>(sql`
    SELECT id FROM user_roles WHERE user_id = ${userId} AND role = ${role}
  `);
  return rows.length > 0;
}
