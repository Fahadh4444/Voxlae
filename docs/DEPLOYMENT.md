# Where to deploy

**Decision: Vercel — Hobby while pre-launch, Pro before real users. For the long run too.**

There is no cron and no job queue, so nothing here depends on a paid plan's scheduling features.

Cloudflare was considered seriously, twice. This records the current reasoning, including two earlier
claims that turned out to be overstated, so the question does not have to be reopened from scratch.

---

## Why Vercel holds up at scale

The workload that matters is Instagram comment webhooks turning into replies and DMs, across many
creators. Three things decide whether a host can carry it, and all three are now handled:

1. **Latency.** The webhook routes the event before acking and sends in `after()`, so replies land
   4–25s after the comment — the same as Spring (`src/app/webhooks/instagram/route.ts`,
   `docs/crons.md`).
2. **Throughput.** Every webhook invocation handles its own events; there is no central poller, so
   throughput grows with concurrent invocations.
3. **Cost of waiting.** Vercel's Fluid compute bills active CPU and runs many invocations per instance,
   so a function waiting out jitter or an Instagram API call is cheap. *Check current pricing — this is
   the assumption the cost comparison rests on.*

## Two earlier claims that were wrong

Both pushed toward Cloudflare, which is why they are recorded.

- **"Vercel bills wall-clock, Cloudflare bills CPU."** Out of date for Fluid compute. The cost gap for
  I/O-heavy work is much smaller than that framing suggested.
- **"Every send contends on the same Postgres rate-limit rows."** Only within one Instagram account,
  and each account is capped at 60 public replies and 150 DMs an hour. Across accounts there is no
  contention. A viral post on one account causes a short burst of single-row upserts, most of which are
  throttled anyway.

## What actually limits scale, on any host

None of these change by moving to Cloudflare.

- **Meta's per-account API limits** (~200 calls/hour). The send guards stay well inside them. This is
  the real ceiling on how fast any one creator's automations can run.
- **Database connections under a burst.** The app uses the Supabase pooler in **session mode** (5432),
  `max: 5` per instance with a 20s idle timeout. Session mode pins one backend per client connection,
  so Supabase's pool size is the ceiling — the first thing to revisit with real traffic. Transaction
  mode (6543) would pool tighter but wedged connections under load (see `src/db/index.ts`).
- **Gmail SMTP.** Roughly 500–2,000 messages a day, and no bounce handling. With many users this
  breaks OTP and password reset regardless of host. Move to a transactional email API (Resend,
  Postmark) before growth forces it.

## When Cloudflare would be worth it

A cost decision, not an architectural one. Revisit if the Vercel bill grows past roughly $50/month.

What Cloudflare offers: native Queues (push delivery, built-in retries and dead-lettering) if a
durable send queue is ever wanted again, Durable Objects for per-account counters, and very low
per-request pricing.

What moving would cost:

- **Replacing SMTP** — Workers cannot do STARTTLS on port 587. (Needed at scale anyway; see above.)
- **Hyperdrive** in front of Postgres.
- **`@opennextjs/cloudflare`** maturity on Next 16 — the least proven part.
- **Workers Paid** ($5/mo) is required: Free caps CPU at 10ms per request, and BCrypt at strength 10
  (every existing password) costs far more than that.

---

## Required settings — automations silently stop without these

| Variable | If missing |
|---|---|
| `INSTAGRAM_LOGIN_WEBHOOK_VERIFY_TOKEN` | Meta cannot re-verify the webhook URL |
| `INSTAGRAM_LOGIN_CLIENT_SECRET` | every webhook is rejected with 403 |
| `TOKEN_ENCRYPTION_KEY` | no stored token decrypts; every send fails |
| `DATABASE_URL` | **every route 500s.** Must be the pooler — see below |
| `OTP_DEV_MODE` | must be `false` or unset — `true` returns OTP codes in API responses |
| `ADMIN_EMAILS` | nobody is admin — `/admin` and its APIs refuse everyone. Comma-separated; the only source of admin |
| `ACCESS_MODE` | unset = `waitlist` (fails closed): only admins and approved waitlist emails can sign up or sign in. `open` lets anyone in |
| `NEXT_PUBLIC_ACCESS_MODE` | unset = waitlist UI (sign-in buttons open the waitlist form). Set `open` together with `ACCESS_MODE=open`. Build-time |
| `NEXT_PUBLIC_FEATURE_AUTOMATIONS=true` | the Automations nav and pages are hidden (production had the `VITE_` equivalent on). Build-time: set it **before** deploying, a redeploy is needed to change it |

**Vercel Pro is required once real users arrive** — Hobby forbids commercial use. Until then Hobby
works as-is: there is no cron and no queue, so nothing differs between the two plans. Check Hobby's
current function duration cap covers the webhook's `maxDuration = 90` — if not, the first deploy says so.

### Database URL: the pooler is not optional

The direct host `db.txyoqdpcdeejtwtvoclz.supabase.co` resolves **only to IPv6**, and Vercel functions
have no IPv6 egress, so the direct string fails with `ENOTFOUND` on every request. (It also broke local
dev the day the network lost IPv6.) Use the Supavisor pooler in **session mode, port 5432**:

```
postgresql://postgres.txyoqdpcdeejtwtvoclz:<password>@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
```

Note the username carries the project ref (`postgres.<ref>`), unlike the direct string. **Not port
6543** (transaction mode): under concurrent requests it left connections stuck mid-query and requests
hung until they timed out — measured 1–6 hung per 8 concurrent requests, against 0 in 48 on 5432.

### Region

The database is in Tokyo (`ap-northeast-1`), so functions are pinned to `hnd1` in `vercel.json`. Every
route does at least one query, several do many; a US default region would add ~150ms per round trip.

### Domains

Add both `voxlae.com` and `www.voxlae.com` to the project, with `www` redirecting to the apex — nginx
served both, and old links use either.

---

## Cutover

1. Deploy to Vercel. Leave `voxlae.com` on the VPS.
2. Set every variable above in the Vercel project.
3. **Point Meta's webhook at the Vercel URL** while Spring stays up. Real comments now exercise the new
   send path. Meta delivers to one URL per app, so Spring stops receiving events — "fallback" means
   pointing the URL back at Spring if a reply goes wrong, which takes a minute. Watch
   `ig_automation_executions` — a `FAILED` row has its reason in `error`; a row stuck in `MATCHED`
   means an instance died during the send's jitter.
4. Exercise sign-in, signup + OTP, password reset, and one OAuth connect against production. Mind
   `YOUTUBE_OAUTH_REDIRECT_URI` and `INSTAGRAM_LOGIN_REDIRECT_URI`: while `voxlae.com` still points at
   the VPS, a callback on that domain lands on **Spring**, not here. Either test connects after step 5,
   or temporarily add the Vercel URL to the allowed redirect URIs in Google Cloud and Meta and point
   the two variables at it.
5. Move `voxlae.com` to Vercel. Keep the VPS idle, not off.
6. After a clean day, stop Spring and the Python AI service.

Step 3 matters most: **an actual outbound send has not yet been executed by this code.** Every step up
to the Instagram API call is verified, and the request shapes for the DM and follow-gate prompt are
confirmed accepted by Meta — but the first real reply should happen while Spring can still take over.
