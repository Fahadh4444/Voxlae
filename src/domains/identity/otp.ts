import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { sendMail } from "@/lib/mailer";
import { reserve } from "@/lib/ratelimit";

/**
 * Email OTP issue + verify. Ports `EmailOtpService`, backed by the same `otp_codes` table (V17,
 * widened for `PASSWORD_RESET` by V30) so codes issued by Spring stay verifiable here and vice
 * versa during the switchover.
 *
 * Column names differ from the field names: the entity maps `email -> identifier`,
 * `otp -> code`, `verified -> used`. Those are the physical names and are used directly below.
 */

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;

export const OTP_TYPE_EMAIL = "EMAIL";
export const OTP_TYPE_PASSWORD_RESET = "PASSWORD_RESET";
export type OtpType = typeof OTP_TYPE_EMAIL | typeof OTP_TYPE_PASSWORD_RESET;

/**
 * Whether the code is echoed back in the API response. Mirrors `app.otp.dev-mode`, which is
 * `false` in production — returning an OTP to an unauthenticated caller would make the whole
 * verification step decorative.
 */
function devMode(): boolean {
  return process.env.OTP_DEV_MODE === "true";
}

export class InvalidOtpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOtpError";
  }
}

/**
 * Six digits, 100000–999999.
 *
 * `randomInt` is used rather than `Math.random` because this code is the only thing standing
 * between an attacker and a verified email / a password reset. The Java used `SecureRandom`; this
 * is the same guarantee from the same kind of source.
 */
function generateOtp(): string {
  return String(crypto.randomInt(100_000, 1_000_000)).padStart(OTP_LENGTH, "0");
}

async function insertOtp(email: string, type: OtpType): Promise<string> {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();
  await db.execute(sql`
    INSERT INTO otp_codes (identifier, otp_type, code, expires_at, used, created_at)
    VALUES (${email.toLowerCase()}, ${type}, ${code}, ${expiresAt}, false, now())
  `);
  return code;
}

const SUBJECTS: Record<OtpType, string> = {
  [OTP_TYPE_EMAIL]: "Voxlae - Email Verification Code",
  [OTP_TYPE_PASSWORD_RESET]: "Voxlae - Password Reset Code",
};

function body(type: OtpType, code: string): string {
  if (type === OTP_TYPE_PASSWORD_RESET) {
    return (
      `Your password reset code is: ${code}\n\n` +
      `This code expires in ${OTP_TTL_MINUTES} minutes.\n\n` +
      `If you didn't request a password reset, you can safely ignore this email — ` +
      `your password will not change.`
    );
  }
  return (
    `Your verification code is: ${code}\n\n` +
    `This code expires in ${OTP_TTL_MINUTES} minutes.\n\n` +
    `If you didn't request this code, please ignore this email.`
  );
}

/**
 * Issue a code and mail it. Returns the code only in dev mode, `null` otherwise — the shape the
 * `devOtp` response field expects.
 *
 * Rate-limited per email address, which the Java was not. Without a cap, `/password/forgot` is an
 * open relay for mailing an arbitrary address on demand, and repeated `/signup` calls are a way to
 * get the sending domain flagged as a spam source. Six per hour is well above any honest retry
 * pattern.
 */
export async function generateAndSendOtp(
  email: string,
  type: OtpType = OTP_TYPE_EMAIL,
): Promise<string | null> {
  const normalized = email.toLowerCase().trim();
  const quota = await reserve(`otp-send:${type}`, normalized, 6, 60 * 60 * 1000);
  if (!quota.allowed) {
    // Deliberately silent: telling the caller they are rate-limited on a specific address also
    // tells them the address exists. The caller sees the same generic success either way.
    console.warn(`[otp] send quota exhausted for ${maskEmail(normalized)} (${type})`);
    return null;
  }

  // Housekeeping rides on issuance: the only moment rows are added is the natural moment to drop the
  // expired ones, and it keeps the table small without a scheduled job.
  await purgeExpiredOtps().catch((error) => console.warn("[otp] purge failed:", error));

  const code = await insertOtp(normalized, type);
  await sendMail({ to: normalized, subject: SUBJECTS[type], text: body(type, code) });
  return devMode() ? code : null;
}

/**
 * Verify the newest unused, unexpired code of this type, then consume every code of this type for
 * the address.
 *
 * "Newest only" is the Java's behaviour and is preserved: requesting a second code invalidates the
 * first in practice, because only the latest row is ever looked at.
 *
 * Attempts are rate-limited, which the Java did not do. A 6-digit code inside a 5-minute window is
 * only ~10^6 guesses; with unlimited attempts that is minutes of scripted requests away from a
 * free password reset on any account. Ten tries per address per hour makes the code do the job it
 * looks like it is doing.
 */
export async function verifyOtp(
  email: string,
  code: string,
  type: OtpType = OTP_TYPE_EMAIL,
): Promise<void> {
  const normalized = email.toLowerCase().trim();

  const attempts = await reserve(`otp-verify:${type}`, normalized, 10, 60 * 60 * 1000);
  if (!attempts.allowed) {
    throw new InvalidOtpError(
      "Too many incorrect attempts. Request a new code and try again later.",
    );
  }

  const rows = await db.execute<{ id: number; code: string }>(sql`
    SELECT id, code FROM otp_codes
    WHERE identifier = ${normalized}
      AND otp_type = ${type}
      AND used = false
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) {
    throw new InvalidOtpError(
      type === OTP_TYPE_PASSWORD_RESET
        ? "No valid password reset code found for this email"
        : "No valid OTP found for this email",
    );
  }

  // Fixed-time compare. The codes are the same length so a plain `!==` leaks little, but this is
  // the one comparison where a timing oracle would be directly exploitable.
  const given = Buffer.from(String(code));
  const expected = Buffer.from(row.code);
  const matches =
    given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!matches) {
    throw new InvalidOtpError(
      type === OTP_TYPE_PASSWORD_RESET ? "Invalid password reset code" : "Invalid OTP",
    );
  }

  await db.execute(sql`
    DELETE FROM otp_codes WHERE identifier = ${normalized} AND otp_type = ${type}
  `);
}

/**
 * Housekeeping for `otp_codes`; the table has no FK cascade because it is keyed by email. Run on every
 * issuance — see `generateAndSendOtp`.
 */
export async function purgeExpiredOtps(): Promise<number> {
  const rows = await db.execute(sql`
    DELETE FROM otp_codes WHERE expires_at < now() RETURNING id
  `);
  return rows.length;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "***";
  const [local, domain] = email.split("@");
  return `${local.slice(0, Math.min(3, local.length))}***@${domain}`;
}
