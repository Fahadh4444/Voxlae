import { NextResponse } from "next/server";
import { isAdminEmail } from "@/domains/identity/access";
import {
  InvalidTokenError,
  TokenExpiredError,
  verifyAccessToken,
  type AccessTokenClaims,
  type Role,
} from "@/domains/identity/jwt";

/**
 * Route-handler authentication and authorization.
 *
 * This is the fix for the standing "roles are decoration, not security" problem. In Spring,
 * `JwtAuthenticationFilter` hands every authenticated caller a single flat `ROLE_USER` authority
 * and ignores the `roles` claim the token already carries, so no endpoint can authorize on role
 * even though the data is right there. Endpoints migrated to Next authorize for real, from day
 * one — retrofitting later would mean doing the work twice.
 */

/** Mirrors Spring's `ApiResponse` envelope so existing frontend error handling still matches. */
interface ApiErrorBody {
  status: "ERROR" | "TOKEN_EXPIRED";
  data: null;
  message: string;
  error: string;
}

function errorBody(
  status: ApiErrorBody["status"],
  error: string,
  message: string,
): ApiErrorBody {
  return { status, data: null, message, error };
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

/** Claims if the request carries a valid token, else null. Never throws — for optional auth. */
export async function getAuth(
  request: Request,
): Promise<AccessTokenClaims | null> {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

/** Claims, or throws. Pair with `toAuthErrorResponse` in the route handler. */
export async function requireAuth(
  request: Request,
): Promise<AccessTokenClaims> {
  const token = bearerToken(request);
  if (!token) throw new InvalidTokenError("Missing bearer token.");
  return verifyAccessToken(token);
}

/**
 * Require the caller to be *acting as* one of `allowed`.
 *
 * Checks two things, deliberately:
 *
 *  1. `activeRole` is in `allowed` — the role the user is currently acting as, which is what the
 *     UI's own guards key off, so the API agrees with the UI.
 *  2. `activeRole` is also present in `roles` — the roles they actually hold.
 *
 * The second check is what makes a stale token safe. `switchRole` updates `active_role` in the
 * database but issues no new token, so a user can hold a token whose `activeRole` no longer
 * reflects reality. Requiring the active role to also be one they genuinely possess means the
 * worst a stale token can do is act as a role the user already has — not escalate into one they
 * don't. Rotating the token on switch (the real fix) is tracked separately.
 */
export async function requireRole(
  request: Request,
  allowed: Role | Role[],
): Promise<AccessTokenClaims> {
  const claims = await requireAuth(request);
  const permitted = Array.isArray(allowed) ? allowed : [allowed];

  const active = claims.activeRole;
  if (!active || !permitted.includes(active)) {
    throw new ForbiddenError(
      `This endpoint requires one of: ${permitted.join(", ")}.`,
    );
  }
  if (!claims.roles.includes(active)) {
    throw new ForbiddenError("Active role is not one you hold.");
  }
  return claims;
}

/**
 * Require an admin (see `access.ts`). Decided on every call from the token's verified email against
 * `ADMIN_EMAILS` — the `isAdmin` the UI receives only decides what to show, never what is allowed.
 */
export async function requireAdmin(request: Request): Promise<AccessTokenClaims> {
  const claims = await requireAuth(request);
  if (!isAdminEmail(claims.email)) throw new ForbiddenError("Admins only.");
  return claims;
}

/**
 * Convert a thrown auth error into the response Spring would have sent. Returns null for
 * anything else, so real bugs keep bubbling up as 500s instead of being masked as 401s.
 */
export function toAuthErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof TokenExpiredError) {
    return NextResponse.json(
      errorBody("TOKEN_EXPIRED", "token_expired", error.message),
      { status: 401 },
    );
  }
  if (error instanceof InvalidTokenError) {
    return NextResponse.json(
      errorBody("ERROR", "unauthorized", error.message),
      { status: 401 },
    );
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json(errorBody("ERROR", "forbidden", error.message), {
      status: 403,
    });
  }
  return null;
}
