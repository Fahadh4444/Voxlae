import { NextResponse } from "next/server";
import {
  exchangeCodeForConnection,
  IgOAuthError,
  resolveReturnPath,
} from "@/domains/automation/oauth";
import {
  InvalidOAuthStateError,
  verifyOAuthState,
} from "@/domains/platform/oauth-state";

/**
 * GET /oauth/automation/instagram/callback — takes over from
 * `InstagramAutomationAuthController.callback`.
 *
 * Always ends in a redirect back into the app, never a JSON error: the user's browser is here, not a
 * client. The failure reason rides in the query string for the page to show.
 *
 * ⚠️ This and `/api/automation/instagram/connect` must migrate **together** — they share the state
 * format, and this port signs it while Spring's does not. A flow already in flight across the
 * cutover fails once and succeeds on retry.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // The return path is recovered from the state *before* anything can fail, so an error still lands
  // the user back where they started rather than on a default page.
  let returnPath = "/influencer/automations";
  const state = params.get("state");
  try {
    if (state) returnPath = resolveReturnPath(verifyOAuthState(state).r);
  } catch {
    /* unverifiable state — fall back to the default path */
  }
  const success = `${site}${returnPath}?instagram=connected`;
  const failure = `${site}${returnPath}?instagram=error`;

  const error = params.get("error");
  if (error) {
    const reason = params.get("error_description") ?? error;
    return NextResponse.redirect(`${failure}&reason=${encodeURIComponent(reason)}`);
  }

  const code = params.get("code");
  if (!code || !state) {
    return NextResponse.redirect(`${failure}&reason=missing_params`);
  }

  try {
    const result = await exchangeCodeForConnection(code, state);
    console.info(
      `[ig-oauth] connected @${result.username ?? result.igUserId}` +
        `${result.webhookSubscribed ? "" : " (webhook subscribe failed)"}`,
    );
    return NextResponse.redirect(success);
  } catch (err) {
    if (err instanceof InvalidOAuthStateError || err instanceof IgOAuthError) {
      return NextResponse.redirect(`${failure}&reason=${encodeURIComponent(err.message)}`);
    }
    console.error("[ig-oauth] unexpected callback failure:", err);
    return NextResponse.redirect(`${failure}&reason=unexpected_error`);
  }
}
