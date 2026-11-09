import { fail, ok } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { authErrorResponse, unexpected } from "@/lib/auth-errors";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { validIgAccessToken, IgTokenRefreshError } from "@/domains/platform/ensure-token";
import { fetchMedia } from "@/domains/automation/graph-client";

/**
 * GET /api/automation/instagram/media?after=cursor — takes over from
 * `AutomationMediaController.media`.
 *
 * One page of recent posts for the automation target picker. 25 at a time, cursor-paged — the page
 * size is fixed rather than caller-supplied because each page is a Graph call against the creator's
 * own hourly API budget.
 */
export const PAGE_SIZE = 25;

export async function activeConnection(
  userId: number,
): Promise<{ id: string; igUserId: string } | null> {
  const rows = await db.execute<{ [key: string]: unknown; id: string; ig_user_id: string }>(sql`
    SELECT id, ig_user_id FROM ig_automation_connections
    WHERE user_id = ${userId} AND status = 'CONNECTED' AND access_token IS NOT NULL
    ORDER BY connected_at DESC LIMIT 1
  `);
  const row = rows[0];
  return row ? { id: String(row.id), igUserId: String(row.ig_user_id) } : null;
}

export async function GET(request: Request) {
  let userId: number;
  try {
    userId = (await requireAuth(request)).userId;
  } catch (error) {
    return authErrorResponse(error);
  }

  try {
    const connection = await activeConnection(userId);
    if (!connection) return fail("not_connected", "No Instagram account connected", 400);

    const token = await validIgAccessToken(connection.id);
    const after = new URL(request.url).searchParams.get("after");
    const page = await fetchMedia(connection.igUserId, after, PAGE_SIZE, token);
    return ok({ items: page.items, nextCursor: page.nextCursor });
  } catch (error) {
    if (error instanceof IgTokenRefreshError) {
      return fail("instagram_error", error.message, 400);
    }
    return unexpected(error);
  }
}
