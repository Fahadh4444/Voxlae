import { NextResponse } from "next/server";
import { fail } from "@/lib/api-response";
import { toAuthErrorResponse } from "@/lib/auth";
import {
  AccountGoneError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  UserAlreadyExistsError,
} from "@/domains/identity/auth-service";
import { InvalidOtpError } from "@/domains/identity/otp";
import { InvalidGoogleTokenError } from "@/domains/identity/google-auth";
import { AccessRestrictedError } from "@/domains/identity/access";
import { InviteError } from "@/domains/waitlist";

/**
 * Maps the auth domain's errors onto the exact status + error code Spring's
 * `GlobalExceptionHandler` produced. The codes are part of the API contract — the frontend surfaces
 * `message` to the user and branches on the status — so drifting here changes behaviour the UI
 * depends on without any type error to catch it.
 *
 * Returns null for anything unrecognised, so a genuine bug still surfaces as a 500 instead of being
 * flattened into a plausible-looking 400.
 */
export function toAuthDomainError(error: unknown): NextResponse | null {
  if (error instanceof AccountGoneError) {
    return fail("unauthorized", error.message, 401);
  }
  if (error instanceof InvalidCredentialsError) {
    return fail("INVALID_CREDENTIALS", error.message, 401);
  }
  if (error instanceof UserAlreadyExistsError) {
    return fail("USER_ALREADY_EXISTS", "An account with this email already exists", 409);
  }
  if (error instanceof EmailNotVerifiedError) {
    return fail("EMAIL_NOT_VERIFIED", "Please verify your email before logging in", 403);
  }
  if (error instanceof InvalidOtpError) {
    return fail("INVALID_OTP", error.message, 400);
  }
  if (error instanceof InvalidGoogleTokenError) {
    return fail("invalid_google_token", error.message, 401);
  }
  if (error instanceof AccessRestrictedError) {
    return fail("waitlist_only", error.message, 403);
  }
  if (error instanceof InviteError) {
    // `invite_<reason>` lets the page show the right next step (log in vs. ask for a new link).
    return fail(`invite_${error.reason}`, error.message, error.reason === "invalid" ? 404 : 410);
  }
  return null;
}

/** Last resort: a 500 that still carries the envelope the frontend can parse. */
export function unexpected(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[auth] unhandled error:", error);
  return fail("auth_failed", message, 500);
}

/**
 * The one error handler a route handler should use.
 *
 * Chains the token errors (`@/lib/auth`) and the domain errors above, then falls back to a 500. Two
 * separate mappers existed and routes picked one, which is how a legitimately-mapped error still
 * came out as a 500 — `AccountGoneError` did exactly that on `/api/user/me`. Having a single entry
 * point removes the choice.
 */
export function authErrorResponse(error: unknown): NextResponse {
  return toAuthErrorResponse(error) ?? toAuthDomainError(error) ?? unexpected(error);
}
