import { fail } from "@/lib/api-response";
import type { NextResponse } from "next/server";

/**
 * `startDate` / `endDate` query params, as the analytics endpoints take them (`YYYY-MM-DD`, both
 * required — Spring's `@RequestParam @DateTimeFormat(iso = DATE)`).
 *
 * Also rejects inverted and absurdly long ranges: each call fans out to a platform API or scans a
 * table, and an unbounded range is a free way to burn quota.
 */
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 400;

export function parseDateRange(
  request: Request,
): { startDate: string; endDate: string; error: null } | { error: NextResponse } {
  const q = new URL(request.url).searchParams;
  const startDate = q.get("startDate") ?? "";
  const endDate = q.get("endDate") ?? "";
  if (!ISO.test(startDate) || !ISO.test(endDate)) {
    return { error: fail("validation_error", "startDate and endDate are required, as YYYY-MM-DD", 400) };
  }
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
  if (Number.isNaN(days) || days < 0) {
    return { error: fail("validation_error", "endDate must not be before startDate", 400) };
  }
  if (days > MAX_DAYS) {
    return { error: fail("validation_error", `Range cannot exceed ${MAX_DAYS} days`, 400) };
  }
  return { startDate, endDate, error: null };
}
