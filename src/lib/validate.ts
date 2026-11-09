import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/api-response";

/**
 * Request-body validation, replacing Spring's `@Valid` + bean-validation annotations.
 *
 * The error code stays `validation_error` so any client branching on it keeps working, but the
 * message does not: Spring returned `"Invalid request: " + bindingResult.toString()`, which dumps
 * the internal binding object into a user-facing toast. Since the frontend shows `message` verbatim,
 * a readable message is the whole difference between a usable form error and a wall of Java.
 */
export type Parsed<T> = { data: T; error: null } | { data: null; error: NextResponse };

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<Parsed<z.output<S>>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { data: null, error: fail("validation_error", "Request body must be JSON.", 400) };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first.path.join(".");
    const message = field ? `${field}: ${first.message}` : first.message;
    return { data: null, error: fail("validation_error", message, 400) };
  }
  return { data: result.data, error: null };
}

/** Shared field rules, each carrying the message the Java DTO used. */
export const emailField = z
  .string({ error: "Email is required" })
  .trim()
  .min(1, "Email is required")
  // Matches `@Email`'s practical behaviour: shape-checks the address without trying to be an RFC
  // parser. Anything stricter rejects addresses that really exist.
  .email("Invalid email format");

export const passwordField = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters");

export const otpField = z
  .string({ error: "OTP is required" })
  .trim()
  .length(6, "OTP must be 6 digits");
