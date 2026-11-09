# Scheduled jobs

**There are none.** Every Java `@Scheduled` job is now done live, at the moment something actually
needs it. That was a deliberate change of direction (2026-09-29 for the data jobs, 2026-10-01 for the
automation queue), not a simplification of convenience — the original plan mapped all seven Java
`@Scheduled` methods onto seven Vercel crons. Runs on Vercel Hobby as a result.

## Why almost none of them were needed

Each Java job looped over every user inside one invocation. That shape cannot survive a serverless
execution cap: the run dies partway with no record of progress, and one slow user's API call starves
everyone behind them. The first fix was to split each job into *enumerate* and *drain*. The better fix
was to ask which of them needed a schedule at all.

| Java job | What replaced it |
|---|---|
| `YouTubeScheduledJobs` ×3 (daily 06:00, weekly ×2) | **Live fetch.** YouTube Analytics serves 90 days of daily history on request, so nothing is lost by not recording it as it happens. |
| `TokenHealthScheduler.periodicTokenHealthCheck` (4-hourly) | **Lazy refresh** — `src/domains/platform/ensure-token.ts`, on session boot and before any platform call. |
| `TokenHealthScheduler.dailyTokenHealthAudit` (daily 04:00) | **Deleted.** It was a COUNT query whose result went to a log line. |
| `DailySnapshotScheduler` (daily 04:00) | **Opportunistic capture** — `src/domains/platform/daily-snapshot.ts`, on session boot, from counts the live-fetch paths already cache. |
| `TrendScheduler` (hourly) | **Removed with the Trends feature (2026-10-01).** The Trends page is a coming-soon placeholder. |
| `InstagramWebhookRouter.routeAsync` | **Routed inside the webhook, before the 200.** A failure returns 500 and Meta redelivers — Meta's retry is the safety net. |
| `DelayedSendScheduler` | **In memory, in `after()`**, exactly Spring's shape. `src/domains/automation/send-schedule.ts`. |
| (sweeping `rate_limit_windows`, `otp_codes`) | **Lazily:** OTP rows on every issuance, rate-limit windows on ~1% of `reserve()` calls. |

## Why the automation queue went too (2026-10-01)

For one release the webhook wrote every event and send to a `job_queue` table, drained by a
per-minute cron. It was removed because it cost a database row per comment and a cron — which Vercel
Hobby cannot run — to buy recovery for failures that are rare. The replacement covers the same ground
differently:

| Failure | Queue version | Now |
|---|---|---|
| Database error while routing | retried by the cron | **500 → Meta redelivers** (retries for hours) |
| Duplicate delivery | queue dedupe + executions unique key | executions unique key (`SKIPPED_DUP`) |
| Instagram rate limit on a send | in-process backoff | in-process backoff (unchanged, `reply-service.ts`) |
| Instance dies *during* a send's 4–25s jitter | picked up by the next tick | **lost**; execution stays MATCHED — same as Spring |

The last row is the accepted cost. It needs a crash inside a 25-second window, and was equally true of
Spring on every restart. Sends were never retried by the queue anyway (`maxAttempts: 1`: a half-sent
reply retried would post the public comment twice).

The `job_queue` table still exists, unused, until a migration can drop it — see BACKLOG.

## Two trades this accepted, stated plainly

Both fail *silently* and *months later*, which is the worst way to find out, so they are recorded
rather than left to be rediscovered.

1. **Follower history now has gaps** on days a creator does not open the app. Follower totals are the
   one metric no platform serves retroactively — neither the Graph API nor YouTube will say how many
   followers an account had last Tuesday — so a day not recorded is gone permanently. The cron filled
   every day; opportunistic capture fills the days someone shows up.
2. **A creator idle ~60 days loses their Instagram connection.** IG long-lived tokens cannot be
   refreshed once expired: there is no separate refresh token to present, so the only recovery is full
   re-authorisation. `status` flips to `TOKEN_EXPIRED`, so the UI prompts them to reconnect when they
   return.

Worth knowing about that second one: the `token-health` cron **never actually protected Instagram
automations**. It walked `connected_accounts`, but V40 moved Instagram onto
`ig_automation_connections` and its own migration note says the leftover rows are inert. What kept
those tokens alive was `getValidAccessToken` refreshing on use, with a 1-day buffer.
`ensure-token.ts` targets the real table and widens that to 7 days — so this is more coverage than
either the cron or the Java had, not less.
