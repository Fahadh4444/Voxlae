import { NextResponse } from "next/server";
import { ok } from "@/lib/api-response";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "@/lib/refresh-cookie";
import {
  InvalidRefreshTokenError,
  revokeRefreshToken,
  rotateRefreshToken,
} from "@/domains/identity/refresh-token";
import { hasAccess } from "@/domains/identity/access";
import { signAccessToken, type Role } from "@/domains/identity/jwt";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * POST /api/auth/refresh — takes over from `AuthController.refreshToken`.
 *
 * Every failure path clears the cookie. That is not tidiness: leaving a rejected token in the
 * browser makes the client retry with it forever, which looks to the user like the session breaking
 * at random rather than a sign-in prompt.
 */

/** 401 with `status: TOKEN_EXPIRED`, which is what the api client watches for to sign the user out. */
function unauthorized(message: string): NextResponse {
  const response = NextResponse.json(
    { status: "TOKEN_EXPIRED", data: null, error: "token_expired", message },
    { status: 401 },
  );
  return clearRefreshCookie(response);
}

export async function POST(request: Request) {
  const current = readRefreshCookie(request);
  if (!current) {
    return unauthorized("No refresh token provided");
  }

  try {
    const { token, userId } = await rotateRefreshToken(current);

    // The token is a row, not a JWT, so the claims have to be rebuilt from the database on every
    // refresh. That is also what makes a role change take effect at the next refresh rather than
    // only at the next full sign-in.
    const rows = await db.execute<{ email: string; active_role: string | null }>(sql`
      SELECT email, active_role FROM users WHERE user_id = ${userId}
    `);
    const user = rows[0];
    if (!user) {
      // The row is gone (account deleted) but the token outlived it.
      return unauthorized("Account no longer exists");
    }

    // While invite-only, a session that predates the waitlist (or whose approval was withdrawn) ends
    // here — at most one access-token lifetime after the switch, without touching their account.
    if (!(await hasAccess(user.email))) {
      await revokeRefreshToken(token);
      return unauthorized("Voxlae is invite-only right now. Join the waitlist and we'll let you in soon.");
    }

    const roleRows = await db.execute<{ role: string }>(sql`
      SELECT role FROM user_roles WHERE user_id = ${userId}
    `);

    const accessToken = await signAccessToken({
      userId,
      email: user.email,
      roles: roleRows.map((r) => r.role as Role),
      activeRole: user.active_role as Role | null,
    });

    return setRefreshCookie(ok({ accessToken, refreshToken: token }), token);
  } catch (error) {
    if (error instanceof InvalidRefreshTokenError) {
      return unauthorized(error.message);
    }
    throw error;
  }
}
