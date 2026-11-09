# Handover — things only you can do

Everything in this file needs your credentials, your accounts, or your decision. Nothing here is
blocked on more code.

**Status as of 2026-09-30: the migration is code-complete.** All 89 Spring endpoints are accounted
for — 87 served by this app, 2 (`SeoController`) retired in favour of SSR. The Python AI service's
only endpoint is ported. Nothing in this app calls Spring or Python any more: the `fallback` rewrite
and `SPRING_ORIGIN` are gone, so an unknown `/api/*` path is an immediate 404.

How "complete" was checked, so it does not have to be re-derived:

- **Endpoints:** all 69 `api.*` calls in the UI extracted and matched against the route table.
- **Response shapes:** all 33 UI GET endpoints called against production data and compared with the
  TypeScript interfaces in `src/api/types.ts`. 28 clean; the other 5 were correct refusals for the
  test user (`already_connected` on the YouTube/Instagram connect endpoints; 403 on `/brand/profile`
  for an INFLUENCER-only user).
- **Pages:** every Vite route has a Next page, plus the `/freelancer/{slug}` → `/f/{slug}` legacy 308.
- **nginx:** API, OAuth callbacks and webhooks migrated; SSR replaces the crawler cloaking;
  `/privacy`, `/terms`, `/sitemap.xml`, `/robots.txt` served. The `/ai` proxy was unused by the UI.
- **Schema:** production is at V46; `./scripts/db.sh validate` passes against it.

Gaps the final audit found and fixed: the three live analytics endpoints (`metrics/daily`,
`youtube/analytics/channel`, `youtube/analytics/video/{id}`); new users getting 403 right after picking
a role (the UI kept its old token — `switchRole` now adopts the returned one); the legacy freelancer
link; the AI trends tool still fetching from Spring; sync endpoints missing the `count` / `daysWritten`
fields the UI reads; `/sitemap.xml` failing the build when the DB was unreachable; `db.sh` unable to
reach production; and an unauthenticated `/api/ai/creator-plan` that spent LLM credits, now deleted.

Ordered by consequence, not by effort.

---

## 1. Cut over — `docs/DEPLOYMENT.md`

**Steps 1–2 done 2026-10-01:** deployed to **https://voxlae.vercel.app** (Vercel project `voxlae`,
Hobby, functions in `hnd1`), 28 production env vars set from `.env.local` with `OTP_DEV_MODE=false`
and `NEXT_PUBLIC_SITE_URL=https://voxlae.com`. Smoke-tested: pages, DB, JWT, token decryption (live
IG + YouTube dashboards), webhook handshake and signature check. Redeploy with
`vercel deploy --prod` from the repo root.

**Step 5 done 2026-10-01: `voxlae.com` now points at Vercel** (Hostinger DNS: A `@` and `www` →
`76.76.21.21`, both AAAA deleted; MX and Google TXT untouched). Vercel-issued Let's Encrypt cert,
`www` → apex 308, http → https 308. Meta's webhook needed no change — it already targets
`voxlae.com/webhooks/instagram`. **Remaining:** a real comment → reply on an automated post; one
YouTube + one Instagram connect; after a clean day, stop Spring and the Python service (the VPS
still answers any resolver holding the old records until their TTL expires — harmless, both share
the executions unique key).

The sequence, required variables, pooler URL, region and domains are all there. Two things from it
that bite silently:

- **`DATABASE_URL` must be the pooler.** The direct Supabase host is IPv6-only and Vercel has no IPv6
  egress; with the direct string every route 500s.
- **`NEXT_PUBLIC_*` values are baked in at build time.** Set `NEXT_PUBLIC_FEATURE_AUTOMATIONS=true`
  and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` *before* the first deploy, or Automations and the Google button
  are simply missing.

## 2. The one unverified path: a real outbound Instagram send

Every step up to the Graph API call is verified against live data, and Meta accepts the request shapes
— but this code has not yet posted a reply or sent a DM. `fahadh.logs` has four enabled follow-gated
automations matching `ANY_COMMENT`, so proving it means messaging someone.

**Close it at cutover step 3:** point Meta's webhook at Vercel, then comment on one targeted post
from a second account you control. Check `ig_automation_executions` (status and `error`). If anything is
wrong, point the webhook back at Spring — Spring stays running until this passes.

## 3. Test email against a real inbox

Signup OTP and password reset have never been delivered by this code, because local runs kept SMTP
off to avoid sending from the production account. The mailer swallows send failures on purpose, so a
wrong `MAIL_*` value shows up only in logs — as a user who can never finish signing up.

## 4. Rotate the Postgres password

It was printed in terminal output during the migration. Rotate it in Supabase, then update
`DATABASE_URL` in `.env.local` and in Vercel.

## 5. Spring's OAuth `state` is unsigned — live until Spring stops

`YouTubeOAuthService.generateOAuthState` produces `"<userId>-<random8>"` and the callback trusts it, so
an attacker can bind a victim's YouTube account to the attacker's Voxlae account. This app signs the
state (`src/domains/platform/oauth-state.ts`). Nothing to patch if Spring stops soon — just do not
leave it running indefinitely as a "fallback".

## 6. Meta App Review

Required before Instagram automations can go live for anyone but you. Playbook is in the Meta App
Review artifact.

## 7. ~~Trends: three sources still need keys~~ — feature removed 2026-10-01

The Trends page is now a coming-soon placeholder, like Brands; the feed, `/api/trends` and the
`TRENDS_*` settings are gone. The `TRENDS_*` variables in Vercel are unused and can be deleted.

---

## 8. Nothing is committed yet

The whole app is uncommitted in `Fahadh4444/Voxlae`. Commit before deploying — Vercel deploys from
git.

---

## Decisions already made — recorded so they are not reopened

- **No job queue, no cron (2026-10-01).** Events are routed before the webhook acks, so a failure
  returns 500 and Meta redelivers; sends run in memory in `after()`, as Spring's did. Accepted cost,
  same as Spring: an instance dying inside a send's 4–25s jitter loses that send. See `docs/crons.md`.
- **Rate limits stay in Postgres** (`src/lib/ratelimit.ts`). In memory they would reset on every cold
  start and differ per instance, so they would not actually hold accounts inside Instagram's limits.
- **Vercel Pro, not Cloudflare.** Reasoning in `docs/DEPLOYMENT.md`.
- **Role switch leaves a ≤15-minute window.** The previous access token is a JWT and cannot be revoked;
  it works until `JWT_ACCESS_TOKEN_EXPIRATION_MS`. Closing it needs shorter tokens or a revocation
  list.
- **Two silent trades from removing the crons:**
  1. *Follower history has gaps.* It is captured when a creator opens the app. Follower totals are the
     one metric no platform serves retroactively, so a day nobody signs in is a permanently missing
     point. Everything else is fetched live. Daily history back = one cron entry.
  2. *A creator idle ~60 days loses their Instagram connection.* Long-lived IG tokens cannot be
     refreshed once expired. `status` flips to `TOKEN_EXPIRED` and the UI prompts re-auth. The lazy
     refresh has a 7-day buffer — more coverage than the old cron, which walked the wrong table.
- **Migrations:** Flyway via `./scripts/db.sh`, the only runner now Spring is gone. It moves pooler
  URLs to session mode (5432) automatically, because Flyway's advisory lock needs a session.
- **Local dev runs against production data** (pooler URL in `.env.local`) and carries production
  `MAIL_*` credentials — a local signup sends a real email. Destructive test scripts refuse any
  non-localhost `DATABASE_URL`.
