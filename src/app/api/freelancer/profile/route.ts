import { z } from "zod";
import { ok, fail } from "@/lib/api-response";
import { parseBody } from "@/lib/validate";
import { requireAuth } from "@/lib/auth";
import {
  AVAILABILITY,
  getOwnProfile,
  MissingFreelancerRoleError,
  RATE_UNITS,
  saveProfile,
} from "@/domains/freelancer/profile";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";

/**
 * GET / POST /api/freelancer/profile — takes over from `FreelancerController.getProfile` /
 * `saveProfile`.
 *
 * `requireAuth`, not `requireRole("FREELANCER")`: the role is INCOMPLETE until the first complete
 * save, and this endpoint is how it becomes complete. The domain checks the role is held.
 *
 * Lengths and enums here mirror the database's own columns and CHECK constraints. Without them a
 * too-long headline or an unrecognised `availability` surfaces as a 500 from Postgres instead of a
 * message naming the field.
 */
export async function GET(request: Request) {
  try {
    const claims = await requireAuth(request);
    return ok(await getOwnProfile(claims.userId));
  } catch (error) {
    return authErrorResponse(error);
  }
}

const portfolioItem = z.object({
  title: z.string().trim().min(1, "Portfolio item needs a title").max(150),
  outcome: z.string().max(300).optional().nullable(),
  role: z.string().max(100).optional().nullable(),
  projectUrl: z.string().max(1024).optional().nullable(),
  thumbnailUrl: z.string().max(1024).optional().nullable(),
  previewTitle: z.string().max(300).optional().nullable(),
  previewDescription: z.string().max(600).optional().nullable(),
  previewSite: z.string().max(120).optional().nullable(),
});

const experienceEntry = z.object({
  title: z.string().trim().min(1, "Experience entry needs a title").max(150),
  organization: z.string().max(150).optional().nullable(),
  // DATE columns, so a plain `YYYY-MM-DD` — not a full timestamp. Postgres accepts the date form
  // directly and the UI renders dates, so no conversion happens in between.
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().nullable(),
  description: z.string().max(600).optional().nullable(),
});

const schema = z.object({
  bio: z.string().optional().nullable(),
  skills: z.array(z.string().trim().min(1).max(255)).optional().nullable(),
  languages: z.array(z.string().trim().min(1).max(60)).optional().nullable(),
  tools: z.array(z.string().trim().min(1).max(80)).optional().nullable(),
  experience: z.string().max(500).optional().nullable(),
  headline: z.string().max(120).optional().nullable(),
  avatarUrl: z.string().max(1024).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  availability: z.enum(AVAILABILITY).optional().nullable(),
  rateAmount: z.number().nonnegative().optional().nullable(),
  rateCurrency: z.string().max(8).optional().nullable(),
  rateUnit: z.enum(RATE_UNITS).optional().nullable(),
  portfolioItems: z.array(portfolioItem).optional().nullable(),
  experienceEntries: z.array(experienceEntry).optional().nullable(),
});

export async function POST(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  const { data, error } = await parseBody(request, schema);
  if (error) return error;

  try {
    return ok(await saveProfile(userId, data));
  } catch (err) {
    if (err instanceof MissingFreelancerRoleError) {
      return fail("validation_error", err.message, 400);
    }
    return unexpected(err);
  }
}
