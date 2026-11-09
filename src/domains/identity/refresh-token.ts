import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Refresh-token lifecycle. Ports `JwtRefreshTokenService`.
 *
 * **`created_at` is written explicitly, and must stay that way.** The Flyway migrations give it
 * `DEFAULT now()`, but the live database does not have that default — its schema was shaped by
 * Hibernate's `ddl-auto`, which sets timestamps in Java rather than in the DDL. An INSERT that omits
 * the column therefore succeeds against a database built from the migrations and fails with a
 * not-null violation against production. See `docs/SCHEMA-DRIFT.md`.
 *
 * Refresh tokens are **database rows, not self-contained JWTs** — which is the right design, and
 * the reason Security #2 could not be fixed without porting this first: revoking a stateless JWT
 * is impossible, so rotation needs the row.
 */

const REFRESH_TTL_MS = Number(
  process.env.JWT_REFRESH_TOKEN_EXPIRATION_MS ?? 2_592_000_000,
);

export class InvalidRefreshTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRefreshTokenError";
  }
}

export async function createRefreshToken(userId: number): Promise<string> {
  // The Java used a bare UUIDv4. `randomUUID` is the same primitive from the same kind of CSPRNG,
  // so the token space and guessability are unchanged.
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();

  await db.execute(sql`
    INSERT INTO jwt_refresh_tokens (token, user_id, expires_at, revoked, created_at)
    VALUES (${token}, ${userId}, ${expiresAt}, false, now())
  `);
  return token;
}

export interface VerifiedRefreshToken {
  id: number;
  userId: number;
  token: string;
}

/** Throws `InvalidRefreshTokenError` when missing, revoked, or expired — as the Java does. */
export async function verifyRefreshToken(
  token: string,
): Promise<VerifiedRefreshToken> {
  const rows = await db.execute<{
    id: number;
    user_id: number;
    revoked: boolean;
    expires_at: string;
  }>(sql`
    SELECT id, user_id, revoked, expires_at FROM jwt_refresh_tokens WHERE token = ${token}
  `);
  const row = rows[0];
  if (!row) throw new InvalidRefreshTokenError("Refresh token not found");
  if (row.revoked) throw new InvalidRefreshTokenError("Refresh token has been revoked");
  if (new Date(row.expires_at.replace(" ", "T")) <= new Date()) {
    throw new InvalidRefreshTokenError("Refresh token has expired");
  }
  return { id: Number(row.id), userId: Number(row.user_id), token };
}

/**
 * Revoke the old token and issue a new one, atomically.
 *
 * The transaction matters: revoke-then-create as two statements can leave a user with **no valid
 * refresh token at all** if the process dies between them — silently signing them out on their
 * next refresh with nothing to diagnose.
 */
export async function rotateRefreshToken(oldToken: string): Promise<{
  token: string;
  userId: number;
}> {
  const verified = await verifyRefreshToken(oldToken);

  return db.transaction(async (tx) => {
    // Conditional on `revoked = false`: if a concurrent request already rotated this token, this
    // updates nothing and we refuse rather than minting a second live token from one old one.
    const revoked = await tx.execute<{ id: number }>(sql`
      UPDATE jwt_refresh_tokens SET revoked = true
      WHERE id = ${verified.id} AND revoked = false
      RETURNING id
    `);
    if (!revoked[0]) {
      throw new InvalidRefreshTokenError("Refresh token has already been used");
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
    await tx.execute(sql`
      INSERT INTO jwt_refresh_tokens (token, user_id, expires_at, revoked, created_at)
      VALUES (${token}, ${verified.userId}, ${expiresAt}, false, now())
    `);
    return { token, userId: verified.userId };
  });
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db.execute(sql`
    UPDATE jwt_refresh_tokens SET revoked = true WHERE token = ${token}
  `);
}

/** Used on password change / account-wide sign-out. */
export async function revokeAllUserTokens(userId: number): Promise<number> {
  const rows = await db.execute(sql`
    UPDATE jwt_refresh_tokens SET revoked = true
    WHERE user_id = ${userId} AND revoked = false
    RETURNING id
  `);
  return rows.length;
}
