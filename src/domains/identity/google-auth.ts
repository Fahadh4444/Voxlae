import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Google ID token verification. Ports `GoogleAuthService.verifyGoogleToken`.
 *
 * The Java used `GoogleIdTokenVerifier`, which does three things: check the RS256 signature
 * against Google's published keys, check the audience is our client id, and check the issuer.
 * All three matter — verifying only the signature would accept a token minted for *any other*
 * Google application, letting someone sign in here with a token issued for an unrelated site.
 *
 * `createRemoteJWKSet` caches and rotates Google's keys, so this is one network fetch per key
 * rotation rather than per request.
 */

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

// Google issues with either form; both are valid.
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export class InvalidGoogleTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGoogleTokenError";
  }
}

export interface GoogleUserInfo {
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  if (!idToken?.trim()) {
    throw new InvalidGoogleTokenError("Google token is required");
  }

  // Same client id the browser used to mint the token.
  const audience =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!audience) {
    throw new InvalidGoogleTokenError(
      "Google client id is not configured; cannot verify the audience of an ID token.",
    );
  }

  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (error) {
    throw new InvalidGoogleTokenError(
      `Invalid or expired Google token (${error instanceof Error ? error.message : String(error)})`,
    );
  }

  const email = typeof payload.email === "string" ? payload.email : null;
  if (!email) {
    throw new InvalidGoogleTokenError("ID token does not contain email");
  }

  return {
    email,
    name: typeof payload.name === "string" ? payload.name : null,
    // Java logged a warning but still accepted an unverified email; kept, so behaviour is
    // unchanged rather than silently becoming stricter mid-migration.
    emailVerified: payload.email_verified === true,
  };
}
