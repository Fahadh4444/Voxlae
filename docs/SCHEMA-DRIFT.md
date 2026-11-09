# The live schema is not what the migrations produce

Found on 2026-09-29, the first time the app ran against production. Worth reading before writing any
INSERT or relying on any cascade.

## What happened

Sign-in failed with:

```
Failed query: INSERT INTO jwt_refresh_tokens (token, user_id, expires_at, revoked) VALUES (...)
null value in column "created_at" violates not-null constraint
```

`db/migration/` declares `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Production has the column
`NOT NULL` with **no default**. Both statements are true, and that is the whole problem.

## Why

Spring ran Hibernate with schema generation enabled alongside Flyway. Hibernate creates what the JPA
entities describe, and JPA sets timestamps, UUIDs and flags **in Java** — so it has no reason to emit
a DDL default or a cascade rule. Where Hibernate got there first, the live column is what Hibernate
made, and the Flyway file is a description of a table that was never actually created from it.

`V1__baseline.sql` is `CREATE TABLE IF NOT EXISTS`. Against a database Hibernate had already
populated, that is a no-op. The migration is recorded as applied, and the schema it describes is not
the schema you have.

**The local scratch database is built purely from Flyway, so it cannot show any of this.** Every one
of the bugs below passed locally and failed in production.

## The differences that matter

### Columns that are NOT NULL with no default in production

| column | migrations say | production |
|---|---|---|
| `users.created_at` | `DEFAULT now()` | no default |
| `jwt_refresh_tokens.created_at` | `DEFAULT now()` | no default |
| `connected_accounts.connected_at` | `DEFAULT now()` | no default |
| `connected_accounts.id` | `DEFAULT gen_random_uuid()` | no default, not an identity column |
| `connected_accounts.revoked` | `DEFAULT false` | no default |
| `users.onboarding_completed` | `DEFAULT false` | no default |
| `platforms.is_active` | `DEFAULT true` | no default |

**Rule: never omit a NOT NULL column on the assumption a default will fill it.** Supply the value.

### Foreign keys that do not cascade in production

| relationship | migrations say | production |
|---|---|---|
| `jwt_refresh_tokens -> users` | `ON DELETE CASCADE` | NO ACTION |
| `connected_accounts -> users` | `ON DELETE CASCADE` | NO ACTION |
| `connected_accounts -> platforms` | `ON DELETE CASCADE` | NO ACTION |
| `user_platform -> users` | `ON DELETE CASCADE` | NO ACTION |
| `user_platform -> platforms` | `ON DELETE CASCADE` | NO ACTION |

This one does not fail quietly — it aborts the parent delete with a foreign-key violation, so account
deletion stops working entirely. `account-deletion.ts` now deletes these children explicitly.

Two FK relationships (`user_metrics_snapshot_records -> users` / `-> platforms`) exist only in the
scratch database. Nothing depends on them.

### Enum-ish values

`connected_accounts.connection_status` holds `CONNECTED`, `TOKEN_EXPIRED`, `DISCONNECTED`. Never
`ACTIVE`, which the column's *default* in the migrations might lead you to expect. A query written
against `'ACTIVE'` matches nothing and returns a plausible, wrong answer — `hasConnectedPlatform`
would have told every creator they had no platform connected.

## What was changed

- `refresh-token.ts` — both inserts write `created_at`
- `auth-service.ts` — both `users` inserts write `created_at`
- `oauth/youtube/callback` — supplies `id` and `connected_at`
- `creator/plan.ts` — `connection_status = 'CONNECTED'`
- `account-deletion.ts` — deletes `jwt_refresh_tokens` and `connected_accounts` explicitly

Each was verified against the live schema inside a rolled-back transaction: the old form reproduces
the reported error, the new form succeeds.

## Still open

**Reconnecting a different YouTube channel will fail.** `uq_connected_account_user_platform_active`
is `UNIQUE (user_id, platform_id) WHERE revoked = false` — it exists in both schemas, so this is a
porting gap rather than drift. The upsert in the YouTube callback targets
`(platform_id, external_account_id)`, so connecting a *second* channel for a user who already has one
violates the other constraint and is not caught by the `ON CONFLICT`. Revoke or update the existing
row first.

## The decision to make

Two options, and neither is urgent now that the code works against both:

1. **Leave it.** The code supplies every value and deletes every child explicitly, which is portable
   and works against either schema. Cost: the migrations stay a partly fictional description of
   production, and the next person to trust them gets caught the same way.
2. **Write V47 to align production with the migrations** — add the missing defaults, add the missing
   cascades. Additive and safe while Spring still runs, since Spring sets these values itself and
   does its own child deletes. This is the real fix, and it makes the scratch database trustworthy
   again.

I would take 2, once Spring is off. Doing it while both apps run means changing the schema under a
service whose behaviour was never tested against those defaults.
