import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { ok, fail } from "@/lib/api-response";
import { parseBody } from "@/lib/validate";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import {
  getBrandProfile,
  MissingBrandRoleError,
  saveBrandProfile,
} from "@/domains/brand/profile";

/**
 * GET / POST /api/brand/profile — takes over from `BrandController`.
 *
 * Guarded with `requireRole("BRAND")` rather than plain `requireAuth`: the profile belongs to a role,
 * and this is enforcement Spring cannot currently do at all. The role only needs to be *held and
 * active*, not complete — completing the profile is what makes it complete.
 *
 * Lengths mirror the Java DTO's `@Size` annotations and the columns behind them.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireRole(request, "BRAND");
    return ok(await getBrandProfile(claims.userId));
  } catch (error) {
    return authErrorResponse(error);
  }
}

const schema = z.object({
  companyName: z.string().max(255, "Company name cannot exceed 255 characters").optional().nullable(),
  industry: z.string().max(255, "Industry cannot exceed 255 characters").optional().nullable(),
  description: z.string().max(2000, "Description cannot exceed 2000 characters").optional().nullable(),
  website: z.string().max(500, "Website URL cannot exceed 500 characters").optional().nullable(),
  companySize: z.string().max(40).optional().nullable(),
  lookingFor: z.string().max(2000, "Cannot exceed 2000 characters").optional().nullable(),
});

export async function POST(request: Request) {
  let userId: number;
  try {
    userId = (await requireRole(request, "BRAND")).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    return ok(await saveBrandProfile(userId, data));
  } catch (err) {
    if (err instanceof MissingBrandRoleError) return fail("validation_error", err.message, 400);
    return unexpected(err);
  }
}
