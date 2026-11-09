import { after, NextResponse } from "next/server";
import {
  isValidMetaSignature,
  verifyHandshake,
} from "@/domains/automation/webhook-signature";
import { routeWebhookPayload } from "@/domains/automation/webhook-router";
import { runScheduledSends } from "@/domains/automation/send-worker";

/**
 * Meta-facing webhook for Instagram comment/message events.
 *
 * Public by necessity — Meta calls it directly, so there is no JWT. Authenticity comes from the verify
 * token (GET) and the `X-Hub-Signature-256` HMAC (POST).
 *
 * **Decide before acking, send after — and let Meta be the retry.** Nothing is stored in a queue.
 *
 *  1. Routing (match the automation, dedup, reserve budget, write the execution row) runs *before*
 *     the response. It is database work, typically well under a second. If any event fails, the
 *     response is 500 and **Meta redelivers the payload** — its own retry, at no cost to us.
 *     Redelivery is safe: events that already succeeded stop at their dedup checks.
 *  2. The replies and DMs themselves run in `after()`, once Meta has its answer, each after its 4–25s
 *     jitter — the same shape as Spring's `@Async` + in-memory scheduler. `after()` keeps the
 *     invocation alive until they finish.
 *
 * What this does not cover, same as Spring: an instance that dies during a send's jitter loses that
 * send. Spring acked before routing, so it also lost the routing on a crash; this does not.
 */

/**
 * Covers routing plus the longest jitter (25s) plus a send's worst-case rate-limit backoff. `after()`
 * work counts against this.
 */
export const maxDuration = 90;

export async function GET(request: Request) {
  const challenge = verifyHandshake(new URL(request.url).searchParams);
  if (challenge === null) {
    return new NextResponse(null, { status: 403 });
  }
  // Meta expects the raw challenge as text/plain, not JSON.
  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(request: Request) {
  // Raw text, deliberately: the HMAC covers these exact bytes.
  const rawBody = await request.text();
  if (!rawBody.trim()) return new NextResponse(null, { status: 200 });

  if (!isValidMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse(null, { status: 403 });
  }

  // A throw here (database unreachable) becomes a 500, which is what we want: Meta retries.
  const result = await routeWebhookPayload(rawBody);
  console.info(
    `[ig-webhook] ${result.entries} entries, ${result.comments} comments, ` +
      `${result.messaging} messaging, ${result.errors} errors, ${result.sendJobs.length} send(s)`,
  );

  // Sends that were decided still go out even when another event in the payload failed — the
  // redelivery will skip them as duplicates, so this is the only time they run.
  if (result.sendJobs.length > 0) {
    after(() => runScheduledSends(result.sendJobs));
  }

  return new NextResponse(null, { status: result.retryable > 0 ? 500 : 200 });
}
