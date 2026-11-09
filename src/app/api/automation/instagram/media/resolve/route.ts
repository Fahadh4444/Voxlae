import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { parseBody } from "@/lib/validate";
import { validIgAccessToken, IgTokenRefreshError } from "@/domains/platform/ensure-token";
import { resolveByPermalink } from "@/domains/automation/graph-client";
import { activeConnection } from "../route";

/**
 * POST /api/automation/instagram/media/resolve — takes over from
 * `AutomationMediaController.resolve`.
 *
 * Turns a pasted post/reel link into a media item. Scans the creator's **own** recent media, so a
 * link to someone else's post simply does not resolve — which is the access control, not just a
 * lookup limitation.
 */
export const maxDuration = 60;

const schema = z.object({
  url: z.string({ error: "Paste a post or reel link" }).trim().min(1, "Paste a post or reel link"),
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
    const connection = await activeConnection(userId);
    if (!connection) return fail("not_connected", "No Instagram account connected", 400);

    const token = await validIgAccessToken(connection.id);
    const item = await resolveByPermalink(connection.igUserId, data.url, token);
    if (!item) {
      return fail(
        "not_found",
        "Couldn't find that post on your account. Pick it from the list instead.",
        404,
      );
    }
    return ok(item);
  } catch (err) {
    if (err instanceof IgTokenRefreshError) {
      return fail("instagram_error", err.message, 400);
    }
    return unexpected(err);
  }
}
