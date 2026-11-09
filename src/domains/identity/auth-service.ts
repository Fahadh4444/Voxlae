import { sql } from "drizzle-orm";
import { db } from "@/db";
import { signAccessToken, type Role } from "./jwt";
import { createRefreshToken, revokeAllUserTokens } from "./refresh-token";
import { verifyGoogleIdToken } from "./google-auth";
import { assertAccess, isAdminEmail } from "./access";
import { claimWaitlistSpot, consumeInvite } from "@/domains/waitlist";
import { hashPassword, verifyPassword } from "./password";
import {
  generateAndSendOtp,
  maskEmail,
  verifyOtp,
  OTP_TYPE_EMAIL,
  OTP_TYPE_PASSWORD_RESET,
} from "./otp";

/**
 * Google sign-in. Ports `AuthService.authenticateWithGoogle`.
 *
 * Its four branches are preserved exactly, because they decide whether a returning user is sent
 * back through onboarding:
 *   A. no user, no onboarding columns  -> create a partial user, requiresOnboarding = true
 *   B. no user, with columns           -> create a full user,    requiresOnboarding = false
 *   C. user exists                     -> requiresOnboarding = !onboardingCompleted
 *   D. user exists, columns, not yet onboarded -> apply the columns, requiresOnboarding = false
 */

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  name: string;
  email: string;
  requiresOnboarding: boolean;
  emailVerified: boolean;
  isNewUser: boolean;
  activeRole: Role | null;
  roles: { role: Role; status: string; verificationStatus: string }[];
}

export interface OnboardingColumns {
  name?: string | null;
  [key: string]: unknown;
}

export async function authenticateWithGoogle(
  idToken: string,
  columns?: OnboardingColumns | null,
): Promise<AuthResponse> {
  const google = await verifyGoogleIdToken(idToken);
  // Before any row is written: while invite-only, a Google sign-in from an unknown address must not
  // even create the account.
  await assertAccess(google.email);

  const existing = await db.execute<{
    user_id: number;
    name: string | null;
    email: string;
    onboarding_completed: boolean;
    email_verified: boolean | null;
    provider: string | null;
    active_role: string | null;
  }>(sql`
    SELECT user_id, name, email, onboarding_completed, email_verified, provider, active_role
    FROM users WHERE lower(email) = lower(${google.email})
  `);

  let userId: number;
  let requiresOnboarding: boolean;
  let name: string;

  if (!existing[0]) {
    // Cases A/B — a new user either way; `columns` decides whether onboarding is already done.
    const displayName = columns?.name || google.name || "";
    const onboardingCompleted = Boolean(columns);
    const inserted = await db.execute<{ user_id: number }>(sql`
      INSERT INTO users (name, email, provider, email_verified, onboarding_completed, last_login_at,
                         created_at)
      VALUES (${displayName}, ${google.email}, 'GOOGLE', true, ${onboardingCompleted}, now(), now())
      RETURNING user_id
    `);
    userId = Number(inserted[0].user_id);
    // Approved off the waitlist: mark them joined and give them the role they asked for.
    await claimWaitlistSpot(userId, google.email);
    requiresOnboarding = !onboardingCompleted;
    name = displayName;
  } else {
    const user = existing[0];
    userId = Number(user.user_id);
    name = user.name || google.name || "";

    if (columns && !user.onboarding_completed) {
      // Case D
      await db.execute(sql`
        UPDATE users
        SET onboarding_completed = true,
            name = ${columns.name || user.name || google.name || ""},
            last_login_at = now()
        WHERE user_id = ${userId}
      `);
      requiresOnboarding = false;
      name = columns.name || name;
    } else {
      // Case C. `provider`/`email_verified` are backfilled for users created before Google
      // sign-in existed, matching the Java's backward-compatibility branch.
      requiresOnboarding = !user.onboarding_completed;
      await db.execute(sql`
        UPDATE users
        SET last_login_at = now(),
            provider = COALESCE(provider, 'GOOGLE'),
            email_verified = CASE WHEN provider IS NULL THEN true ELSE email_verified END
        WHERE user_id = ${userId}
      `);
    }
  }

  const roleRows = await db.execute<{
    role: string;
    status: string;
    verification_status: string;
  }>(sql`
    SELECT role, status, verification_status FROM user_roles WHERE user_id = ${userId}
  `);

  // A user with no roles is "new" — the frontend routes them to role selection.
  const isNewUser = roleRows.length === 0;

  // Ensure an active role exists once the user has any, matching `ensureActiveRole`.
  let activeRole: Role | null = null;
  if (roleRows.length > 0) {
    const current = existing[0]?.active_role as Role | null | undefined;
    activeRole = current ?? (roleRows[0].role as Role);
    if (!current) {
      await db.execute(sql`
        UPDATE users SET active_role = ${activeRole} WHERE user_id = ${userId}
      `);
    }
  }

  const [freshUser] = await db.execute<{ email_verified: boolean | null }>(sql`
    SELECT email_verified FROM users WHERE user_id = ${userId}
  `);

  const accessToken = await signAccessToken({
    userId,
    email: google.email,
    roles: roleRows.map((r) => r.role as Role),
    activeRole,
  });
  const refreshToken = await createRefreshToken(userId);

  return {
    accessToken,
    refreshToken,
    name,
    email: google.email,
    requiresOnboarding,
    emailVerified: freshUser?.email_verified === true,
    isNewUser,
    activeRole,
    roles: roleRows.map((r) => ({
      role: r.role as Role,
      status: r.status,
      verificationStatus: r.verification_status,
    })),
  };
}

// ==================== SHARED ====================

/**
 * Everything needed to answer an authentication call for an existing user row.
 *
 * Extracted because `authenticateWithGoogle`, `loginWithEmail` and `verifyEmailOtp` all ended with
 * the same six steps in the Java, and the one that matters is `ensureActiveRole` — a user with
 * roles but no `active_role` gets a null-role token, and every role-guarded endpoint then refuses
 * them. Duplicating that per flow is how one path ends up missing it.
 */
async function buildAuthResponse(
  userId: number,
  email: string,
  name: string,
  requiresOnboarding: boolean,
  emailVerified: boolean,
  currentActiveRole: Role | null,
): Promise<AuthResponse> {
  // Every email/password path that issues tokens ends here, so this is the catch-all gate for them.
  await assertAccess(email);

  const roleRows = await db.execute<{
    role: string;
    status: string;
    verification_status: string;
  }>(sql`
    SELECT role, status, verification_status FROM user_roles WHERE user_id = ${userId}
  `);

  let activeRole: Role | null = null;
  if (roleRows.length > 0) {
    activeRole = currentActiveRole ?? (roleRows[0].role as Role);
    if (!currentActiveRole) {
      await db.execute(sql`
        UPDATE users SET active_role = ${activeRole} WHERE user_id = ${userId}
      `);
    }
  }

  const accessToken = await signAccessToken({
    userId,
    email,
    roles: roleRows.map((r) => r.role as Role),
    activeRole,
  });
  const refreshToken = await createRefreshToken(userId);

  return {
    accessToken,
    refreshToken,
    name,
    email,
    requiresOnboarding,
    emailVerified,
    // "New" means no roles yet — the frontend routes these users to role selection.
    isNewUser: roleRows.length === 0,
    activeRole,
    roles: roleRows.map((r) => ({
      role: r.role as Role,
      status: r.status,
      verificationStatus: r.verification_status,
    })),
  };
}

interface UserRow {
  // `db.execute` constrains its row type to `Record<string, unknown>`, so an interface has to
  // declare an index signature to be usable as the generic argument.
  [key: string]: unknown;
  user_id: number;
  name: string | null;
  email: string;
  password_hash: string | null;
  provider: string | null;
  email_verified: boolean | null;
  onboarding_completed: boolean | null;
  active_role: string | null;
}

/** Case-insensitive lookup, matching the `lower(email)` comparison used throughout. */
async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const rows = await db.execute<UserRow>(sql`
    SELECT user_id, name, email, password_hash, provider, email_verified,
           onboarding_completed, active_role
    FROM users WHERE lower(email) = lower(${email})
  `);
  return rows[0];
}

// ==================== ERRORS ====================

/** 401 INVALID_CREDENTIALS. */
export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid email or password") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

/** 409 USER_ALREADY_EXISTS. */
export class UserAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`User already exists with email: ${email}`);
    this.name = "UserAlreadyExistsError";
  }
}

/**
 * 401 — the token verifies but the user row it names no longer exists.
 *
 * Distinct from an invalid token on purpose: the token is genuine, the account is not. The client
 * still needs to treat it as signed out, hence 401 rather than 404.
 */
export class AccountGoneError extends Error {
  constructor() {
    super("This account no longer exists. Please sign in again.");
    this.name = "AccountGoneError";
  }
}

/** 403 EMAIL_NOT_VERIFIED — a fresh code has already been sent when this is thrown. */
export class EmailNotVerifiedError extends Error {
  constructor(public readonly email: string) {
    super("Please verify your email before logging in");
    this.name = "EmailNotVerifiedError";
  }
}

// ==================== EMAIL / PASSWORD ====================

export interface EmailSignupResponse {
  message: string;
  email: string;
  requiresEmailVerification: boolean;
  devOtp: string | null;
}

/** `Bob` from `bob@example.com`, matching `deriveNameFromEmail`. */
function deriveNameFromEmail(email: string): string {
  if (!email.includes("@")) return "";
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Email + password signup. Ports `AuthService.signupWithEmail`.
 *
 * An existing *unverified* account re-sends the code instead of erroring. That branch is load-
 * bearing: without it, a user who closed the tab before entering the code can never sign up again
 * with that address and cannot reset a password they never finished setting, so the address is
 * permanently stuck.
 */
export async function signupWithEmail(
  email: string,
  password: string,
  name?: string | null,
): Promise<EmailSignupResponse> {
  const normalized = email.toLowerCase().trim();
  await assertAccess(normalized);
  const existing = await findUserByEmail(normalized);

  if (existing) {
    if (existing.email_verified !== true) {
      const devOtp = await generateAndSendOtp(normalized, OTP_TYPE_EMAIL);
      return {
        message: "Verification code sent to your email",
        email: normalized,
        requiresEmailVerification: true,
        devOtp,
      };
    }
    throw new UserAlreadyExistsError(normalized);
  }

  const passwordHash = await hashPassword(password);
  await db.execute(sql`
    INSERT INTO users (email, name, password_hash, provider, email_verified, onboarding_completed,
                       created_at)
    VALUES (${normalized}, ${name || deriveNameFromEmail(normalized)}, ${passwordHash},
            'EMAIL', false, false, now())
  `);
  console.info(`[auth] created unverified email user ${maskEmail(normalized)}`);

  const devOtp = await generateAndSendOtp(normalized, OTP_TYPE_EMAIL);
  return {
    message: "Verification code sent to your email",
    email: normalized,
    requiresEmailVerification: true,
    devOtp,
  };
}

/**
 * Verify the signup code and issue tokens. Ports `AuthService.verifyEmailOtp`.
 *
 * Returns `requiresOnboarding: true` / `isNewUser: true` unconditionally, as the Java did — a
 * freshly verified email account has no roles and no profile yet.
 */
export async function verifyEmailOtp(
  email: string,
  otp: string,
): Promise<AuthResponse> {
  const normalized = email.toLowerCase().trim();
  await verifyOtp(normalized, otp, OTP_TYPE_EMAIL);

  const user = await findUserByEmail(normalized);
  if (!user) throw new InvalidCredentialsError();

  await db.execute(sql`
    UPDATE users SET email_verified = true, last_login_at = now()
    WHERE user_id = ${user.user_id}
  `);
  console.info(`[auth] email verified for ${maskEmail(normalized)}`);
  // An approved waitlist member who signed up with email: mark joined, add the role they picked.
  await claimWaitlistSpot(Number(user.user_id), normalized);

  return buildAuthResponse(
    Number(user.user_id),
    user.email,
    user.name ?? "",
    true,
    true,
    user.active_role as Role | null,
  );
}

/**
 * Create an account from an invite link (`/signup?invite=<token>`), and sign them straight in.
 *
 * No verification code: the link was emailed to this address, so opening it already proves they
 * own the inbox — the same thing the code proves. The email comes from the invite, never from the
 * request, so a link cannot be used to claim a different address. The invite is consumed
 * atomically first, so a double-submit or a second person with the same link cannot both succeed.
 */
export async function signupWithInvite(
  token: string,
  name: string,
  password: string,
): Promise<AuthResponse> {
  const { email } = await consumeInvite(token);
  const normalized = email.toLowerCase().trim();
  if (await findUserByEmail(normalized)) throw new UserAlreadyExistsError(normalized);

  const passwordHash = await hashPassword(password);
  const displayName = name.trim() || deriveNameFromEmail(normalized);
  const inserted = await db.execute<{ user_id: number }>(sql`
    INSERT INTO users (email, name, password_hash, provider, email_verified, onboarding_completed,
                       last_login_at, created_at)
    VALUES (${normalized}, ${displayName}, ${passwordHash}, 'EMAIL', true, false, now(), now())
    RETURNING user_id
  `);
  const userId = Number(inserted[0].user_id);
  await claimWaitlistSpot(userId, normalized);
  console.info(`[auth] created account from invite ${maskEmail(normalized)}`);

  return buildAuthResponse(userId, normalized, displayName, true, true, null);
}

/** Resend the signup code. Refuses for an already-verified address, as the Java did. */
export async function resendOtp(email: string): Promise<EmailSignupResponse> {
  const normalized = email.toLowerCase().trim();
  const user = await findUserByEmail(normalized);
  if (!user) throw new InvalidCredentialsError();
  if (user.email_verified === true) {
    throw new InvalidCredentialsError("Email already verified");
  }

  const devOtp = await generateAndSendOtp(normalized, OTP_TYPE_EMAIL);
  return {
    message: "Verification code sent to your email",
    email: normalized,
    requiresEmailVerification: true,
    devOtp,
  };
}

/**
 * Email + password login. Ports `AuthService.loginWithEmail`.
 *
 * An unverified account gets a new code and a 403 rather than a 401, because the two mean different
 * things to the UI: "wrong password" versus "go enter the code we just sent you".
 */
export async function loginWithEmail(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const normalized = email.toLowerCase().trim();
  const user = await findUserByEmail(normalized);
  if (!user) throw new InvalidCredentialsError();

  if (!(await verifyPassword(password, user.password_hash))) {
    throw new InvalidCredentialsError();
  }

  // Before the unverified-email branch below: that one emails a fresh code, and someone who is not
  // allowed in should not be sent one only to be refused after entering it.
  await assertAccess(normalized);

  if (user.email_verified !== true) {
    await generateAndSendOtp(normalized, OTP_TYPE_EMAIL);
    throw new EmailNotVerifiedError(normalized);
  }

  await db.execute(sql`
    UPDATE users SET last_login_at = now() WHERE user_id = ${user.user_id}
  `);
  console.info(`[auth] email login ${maskEmail(normalized)}`);

  return buildAuthResponse(
    Number(user.user_id),
    user.email,
    user.name ?? "",
    user.onboarding_completed !== true,
    true,
    user.active_role as Role | null,
  );
}

/**
 * Step 1 of password reset. Ports `AuthService.requestPasswordReset`.
 *
 * Returns normally whether or not the address is eligible. Revealing which emails have accounts
 * turns this endpoint into a membership oracle, so the caller sends the same generic message
 * either way. A Google-only account (no `password_hash`) is also treated as not eligible — there is
 * no password to reset, and issuing a reset code would let anyone who can read that inbox *create*
 * one.
 */
export async function requestPasswordReset(email: string): Promise<string | null> {
  const normalized = email.toLowerCase().trim();
  const user = await findUserByEmail(normalized);

  if (!user || !user.password_hash) {
    console.info(`[auth] password reset for non-eligible email ${maskEmail(normalized)}`);
    return null;
  }
  const devOtp = await generateAndSendOtp(normalized, OTP_TYPE_PASSWORD_RESET);
  console.info(`[auth] password reset code sent to ${maskEmail(normalized)}`);
  return devOtp;
}

/**
 * Step 2 of password reset. Ports `AuthService.resetPassword`.
 *
 * Revoking every refresh token is the part that must not be skipped: a password reset is what a
 * user does *because* they think someone else has access, and leaving 30-day refresh tokens alive
 * means the attacker keeps their session regardless.
 */
export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  await verifyOtp(normalized, otp, OTP_TYPE_PASSWORD_RESET);

  const user = await findUserByEmail(normalized);
  if (!user) throw new InvalidCredentialsError();

  const passwordHash = await hashPassword(newPassword);
  await db.execute(sql`
    UPDATE users SET password_hash = ${passwordHash}, email_verified = true
    WHERE user_id = ${user.user_id}
  `);
  await revokeAllUserTokens(Number(user.user_id));
  console.info(`[auth] password reset completed for ${maskEmail(normalized)}`);
}

/**
 * Add or change the password of the signed-in user. Ports `AuthService.setPassword`.
 *
 * `currentPassword` is required only when one is already set — that is what lets a Google-only
 * account add a password without having one to prove. When a password does exist it is required
 * even though the caller is already authenticated, because a stolen access token should not be
 * enough to take over the account permanently.
 */
export async function setPassword(
  userId: number,
  currentPassword: string | null | undefined,
  newPassword: string,
): Promise<void> {
  const rows = await db.execute<{ password_hash: string | null }>(sql`
    SELECT password_hash FROM users WHERE user_id = ${userId}
  `);
  const user = rows[0];
  if (!user) throw new InvalidCredentialsError();

  if (user.password_hash) {
    if (!currentPassword || !(await verifyPassword(currentPassword, user.password_hash))) {
      throw new InvalidCredentialsError("Current password is incorrect");
    }
  }

  const passwordHash = await hashPassword(newPassword);
  await db.execute(sql`
    UPDATE users SET password_hash = ${passwordHash} WHERE user_id = ${userId}
  `);
  console.info(`[auth] password set for user ${userId}`);
}

// ==================== SESSION ====================

/**
 * The `/auth/me` payload. Ports `UserMeResponse`.
 *
 * `hasPassword` is why `password_hash` is selected but never returned — the account page uses it to
 * decide between "Set a password" and "Change password".
 */
export interface UserMeResponse {
  userId: number;
  email: string;
  name: string | null;
  roles: { role: Role; status: string; verificationStatus: string }[];
  activeRole: Role | null;
  isNewUser: boolean;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  freelancerSlug: string | null;
  hasPassword: boolean;
  /** From `ADMIN_EMAILS` — see `access.ts`. Drives admin-only UI; the server re-checks on every admin call. */
  isAdmin: boolean;
}

/**
 * Ports `AuthController.getMe`, including its `ensureActiveRole` side effect.
 *
 * **Throws when the user row is gone**, which the Java did not — it mapped a missing user to a 200
 * full of nulls. That is wrong for the endpoint's main job: this is the frontend's session-liveness
 * probe, so a 200 tells a client whose account was just deleted that its session is still good, and
 * it carries on making calls that all fail differently. A deleted account is exactly the case the
 * probe exists to detect.
 */
export async function getMe(
  userId: number,
  emailFromToken: string,
): Promise<UserMeResponse> {
  const userRows = await db.execute<UserRow>(sql`
    SELECT user_id, name, email, password_hash, provider, email_verified,
           onboarding_completed, active_role
    FROM users WHERE user_id = ${userId}
  `);
  const user = userRows[0];
  if (!user) throw new AccountGoneError();

  const roleRows = await db.execute<{
    role: string;
    status: string;
    verification_status: string;
  }>(sql`
    SELECT role, status, verification_status FROM user_roles WHERE user_id = ${userId}
  `);

  let activeRole = (user.active_role as Role | null) ?? null;
  if (!activeRole && roleRows.length > 0) {
    activeRole = roleRows[0].role as Role;
    await db.execute(sql`
      UPDATE users SET active_role = ${activeRole} WHERE user_id = ${userId}
    `);
  }

  const slugRows = await db.execute<{ profile_slug: string | null }>(sql`
    SELECT profile_slug FROM freelancer_profiles WHERE user_id = ${userId}
  `);

  return {
    userId,
    email: emailFromToken,
    name: user.name ?? null,
    roles: roleRows.map((r) => ({
      role: r.role as Role,
      status: r.status,
      verificationStatus: r.verification_status,
    })),
    activeRole,
    isNewUser: roleRows.length === 0,
    emailVerified: user.email_verified === true,
    onboardingCompleted: user.onboarding_completed === true,
    freelancerSlug: slugRows[0]?.profile_slug ?? null,
    hasPassword: Boolean(user.password_hash),
    isAdmin: isAdminEmail(user.email),
  };
}
