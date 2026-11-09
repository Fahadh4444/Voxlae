import { NextResponse } from "next/server";
import {
  InvalidSignedRequestError,
  parseSignedRequest,
} from "@/domains/automation/signed-request";
import { disconnectByIgUserId } from "@/domains/automation/connection";

/**
 * Meta's **Deauthorize Callback** — takes over from `InstagramWebhookController.deauthorize`.
 *
 * Fires when a user removes the app from their Instagram/Facebook "Apps and Websites" settings.
 * Required for App Review.
 *
 * Soft-disconnects, the same as the "Disconnect Instagram" button. This callback means "no longer
 * authorised", **not** "delete my data" — that is the separate `/data-deletion` callback. Deleting
 * here would destroy a creator's entire automation configuration and audit trail for what may be an
 * accidental app removal, and reconnecting would not bring it back.
 */
export async function POST(request: Request) {
  // Meta posts `application/x-www-form-urlencoded`, not JSON.
  const form = await request.formData().catch(() => null);
  const signedRequest = form?.get("signed_request");

  let userId: string | null;
  try {
    userId = parseSignedRequest(
      typeof signedRequest === "string" ? signedRequest : null,
      process.env.INSTAGRAM_LOGIN_CLIENT_SECRET,
    ).userId;
  } catch (error) {
    if (error instanceof InvalidSignedRequestError) {
      console.warn(`[webhook] rejected deauthorize callback: ${error.message}`);
      return new NextResponse(null, { status: 403 });
    }
    throw error;
  }

  if (!userId) {
    console.warn("[webhook] deauthorize callback: signed_request had no user_id");
    return new NextResponse(null, { status: 403 });
  }

  const found = await disconnectByIgUserId(userId);
  if (!found) {
    // Not an error — the user may have disconnected in Voxlae first.
    console.info(`[webhook] deauthorize for ig_user_id=${userId}: no live connection`);
  }
  return new NextResponse(null, { status: 200 });
}

/**
 * Meta (and a browser) may GET this URL to confirm it is valid before accepting it in App Settings.
 * Without a handler the GET falls through to an error, which Meta reads as an invalid URL and
 * refuses to save — so this exists purely to make the URL acceptable.
 */
export async function GET() {
  return new NextResponse(
    "Voxlae Instagram deauthorize callback. This endpoint accepts POST requests from Meta " +
      "containing a signed_request.",
    { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
