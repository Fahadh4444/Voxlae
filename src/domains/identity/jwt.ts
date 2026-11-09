import { SignJWT, jwtVerify, errors } from "jose";

/**
 * Access-token signing and verification, byte-compatible with the Spring `JwtUtil`.
 *
 * Compatibility is not optional during the strangler phase: a token minted by Next has to be
 * accepted by Spring and vice versa, because both serve /api/* at the same time. Every detail
 * below mirrors the Java side — claim names, the `sub`, and especially the algorithm.
 */

export const ROLES = ["INFLUENCER", "FREELANCER", "BRAND", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export interface AccessTokenClaims {
  /** Subject is the user's email, matching `.subject(user.getEmail())`. */
  sub: string;
  userId: number;
  email: string;
  /**
   * Spring emits `["USER"]` when a user holds no roles — and "USER" is not a member of its own
   * Role enum. Typed loosely here so that quirk round-trips instead of throwing.
   */
  roles: (Role | "USER")[];
  activeRole?: Role;
  iat: number;
  exp: number;
}

const ACCESS_TOKEN_TTL_MS = Number(
  process.env.JWT_ACCESS_TOKEN_EXPIRATION_MS ?? 900_000,
);

function secretBytes(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

/**
 * Mirrors jjwt's `Keys.hmacShaKeyFor`, which picks the HMAC variant from the key *length*:
 * >=64 bytes HS512, >=48 HS384, >=32 HS256. `signWith(key)` then uses that.
 *
 * This is derived rather than hardcoded on purpose. The current secret is 62 bytes, so the live
 * system is signing **HS384** — not the HS256 anyone would assume. Hardcoding HS256 would produce
 * tokens Spring rejects; hardcoding HS384 would break silently the day the secret is rotated to a
 * different length. Deriving it keeps the two sides in agreement either way.
 */
function algorithm(): "HS256" | "HS384" | "HS512" {
  const length = secretBytes().length;
  if (length >= 64) return "HS512";
  if (length >= 48) return "HS384";
  if (length >= 32) return "HS256";
  throw new Error(
    `JWT_SECRET is ${length} bytes; HMAC-SHA requires at least 32. ` +
      `Spring would fail the same way, so this is a misconfiguration, not a porting gap.`,
  );
}

export interface SignableUser {
  userId: number;
  email: string;
  roles: Role[];
  activeRole?: Role | null;
}

export async function signAccessToken(user: SignableUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const builder = new SignJWT({
    userId: user.userId,
    email: user.email,
    roles: user.roles.length > 0 ? user.roles : ["USER"],
    ...(user.activeRole ? { activeRole: user.activeRole } : {}),
  })
    .setProtectedHeader({ alg: algorithm() })
    .setSubject(user.email)
    .setIssuedAt(now)
    .setExpirationTime(now + Math.floor(ACCESS_TOKEN_TTL_MS / 1000));

  return builder.sign(secretBytes());
}

/** Thrown when a token is well-formed and correctly signed but past its `exp`. */
export class TokenExpiredError extends Error {
  constructor() {
    super("Access token expired. Please refresh your token.");
    this.name = "TokenExpiredError";
  }
}

/** Thrown for a malformed token, a bad signature, or a wrong algorithm. */
export class InvalidTokenError extends Error {
  constructor(message = "Invalid access token.") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

/**
 * Verify and decode. Expiry is distinguished from invalidity because the two mean different
 * things to a client: expired means "refresh and retry", invalid means "sign in again". Spring
 * makes the same distinction via its `tokenExpired` response.
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secretBytes(), {
      algorithms: [algorithm()],
    });
    return payload as unknown as AccessTokenClaims;
  } catch (error) {
    if (error instanceof errors.JWTExpired) throw new TokenExpiredError();
    throw new InvalidTokenError();
  }
}
