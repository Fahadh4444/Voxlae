import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Who may get into Voxlae, and who is an admin.
 *
 * **Admins come from the `ADMIN_EMAILS` setting, never from the database.** A comma-separated list,
 * compared case-insensitively against the email the server has already verified (password, OTP or
 * Google). Keeping it out of the database means no API, bug or SQL injection can grant admin — the
 * only way in is a deploy-time setting.
 *
 * **`ACCESS_MODE` decides whether anyone else may sign up or sign in.**
 *  - `waitlist` (the default, so a missing setting fails closed): only admins and emails an admin has
 *    approved on the waitlist. Everyone else is told to join the waitlist.
 *  - `open`: anyone, as before.
 *
 * Enforced on the server at every point that creates an account or issues tokens — signup, Google
 * sign-in, email login, OTP verification and refresh. Hiding the buttons is only the UI half; this
 * is what actually keeps people out.
 */

export class AccessRestrictedError extends Error {
  constructor() {
    super("Voxlae is invite-only right now. Join the waitlist and we'll let you in soon.");
    this.name = "AccessRestrictedError";
  }
}

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && adminEmails().has(email!.trim().toLowerCase());
}

export function isWaitlistMode(): boolean {
  return (process.env.ACCESS_MODE ?? "waitlist").trim().toLowerCase() !== "open";
}

/** Whether this email may sign up or sign in right now. */
export async function hasAccess(email: string): Promise<boolean> {
  if (!isWaitlistMode() || isAdminEmail(email)) return true;
  const rows = await db.execute<{ [key: string]: unknown; ok: boolean }>(sql`
    SELECT true AS ok FROM waitlist
    WHERE lower(email) = lower(${email.trim()}) AND status = 'APPROVED'
    LIMIT 1
  `);
  return rows.length > 0;
}

/** Throws `AccessRestrictedError` (403 `waitlist_only`) unless the email may get in. */
export async function assertAccess(email: string): Promise<void> {
  if (!(await hasAccess(email))) throw new AccessRestrictedError();
}
