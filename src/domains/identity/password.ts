import bcrypt from "bcryptjs";

/**
 * Password hashing, byte-compatible with Spring's `BCryptPasswordEncoder`.
 *
 * `SecurityConfig` built `new BCryptPasswordEncoder()` — no arguments — which means BCrypt version
 * `$2a` at strength 10. Both are reproduced here, and both matter:
 *
 *  - **Strength 10** keeps newly written hashes indistinguishable from the existing ones.
 *  - **`$2a`** is the part that is easy to get wrong. `bcryptjs` v3 defaults its salts to `$2b`,
 *    so calling `hash(pw, 10)` would silently start writing `$2b` hashes. Spring can read those,
 *    but the reverse question — whether every consumer of this column tolerates a version change
 *    mid-table — is not one worth betting user logins on. Pinning `$2a` keeps the column
 *    homogeneous.
 *
 * Verified empirically in both directions against spring-security-crypto 6.5.7: a hash produced
 * by `BCryptPasswordEncoder.encode` verifies here, and a hash produced here is accepted by
 * `BCryptPasswordEncoder.matches`. Existing passwords therefore keep working unchanged — which is
 * the whole requirement, since a mismatch would lock out every email/password account at once and
 * be indistinguishable from "users forgot their passwords".
 */

const STRENGTH = 10;
const VERSION = "$2a$";

export async function hashPassword(plain: string): Promise<string> {
  const salt = (await bcrypt.genSalt(STRENGTH)).replace(/^\$2[aby]\$/, VERSION);
  return bcrypt.hash(plain, salt);
}

/**
 * Constant-time-ish comparison delegated to bcrypt. Returns false rather than throwing on a
 * malformed or absent hash: a user row with no password is a legitimate state (Google-only
 * accounts), and Spring's `matches` behaved the same way.
 */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
