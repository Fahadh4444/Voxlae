import crypto from "node:crypto";
import { NextResponse } from "next/server";
import {
  InvalidSignedRequestError,
  parseSignedRequest,
} from "@/domains/automation/signed-request";
import { deleteConnectionAndData } from "@/domains/automation/connection";

/**
 * Meta's **Data Deletion Request Callback** — takes over from
 * `InstagramWebhookController.dataDeletion`.
 *
 * Fires when a user explicitly requests deletion. Required for App Review.
 *
 * Hard-deletes the Instagram connection and everything cascading from it, then returns the status
 * URL and confirmation code Meta requires and shows to the user. Both response fields are mandatory:
 * Meta treats a response without them as a failed deletion.
 */
export async function POST(request: Request) {
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
      console.warn(`[webhook] rejected data-deletion callback: ${error.message}`);
      return new NextResponse(null, { status: 403 });
    }
    throw error;
  }

  if (!userId) {
    console.warn("[webhook] data-deletion callback: signed_request had no user_id");
    return new NextResponse(null, { status: 403 });
  }

  await deleteConnectionAndData(userId);

  const confirmationCode = crypto.randomUUID();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return NextResponse.json({
    url: `${site}/webhooks/instagram/data-deletion-status?id=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}

/**
 * Human-readable deletion instructions.
 *
 * Serves two purposes: Meta may GET the callback URL to validate it before accepting it in App
 * Settings (without a handler the GET errors and Meta reads the URL as invalid), and this page also
 * satisfies the separate "Data Deletion Instructions URL" option if that is used instead of the
 * automated callback.
 */
export async function GET() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>Data Deletion — Voxlae</title></head><body>` +
      `<h1>Delete your Voxlae data</h1>` +
      `<p>To delete the data associated with your Instagram connection on Voxlae, you can:</p>` +
      `<ul>` +
      `<li>Disconnect Instagram or delete your account from your Voxlae account settings, or</li>` +
      `<li>Email <a href="mailto:support@voxlae.com">support@voxlae.com</a> with the subject ` +
      `&quot;Data Deletion Request&quot; from your registered email address.</li>` +
      `</ul>` +
      `<p>We complete verified deletion requests within 30 days. See our ` +
      `<a href="${site}/privacy">Privacy Policy</a> for details.</p>` +
      `</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
