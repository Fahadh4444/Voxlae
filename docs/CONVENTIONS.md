# Conventions that are not obvious from the code

Short list, each item earned by something breaking.

## Database

**The pool is `max: 1`, and that is deliberate.** Supabase's pooler does the pooling; a per-instance
pool multiplied by instance count is how you exhaust the connection limit. The consequence:

> **Any helper called from inside `db.transaction` must take the transaction handle as an argument.**

Querying the outer `db` from inside a transaction waits for the connection that transaction is itself
holding. It does not throw — the request hangs until the socket times out, with nothing in the logs.
This has already happened once (`allocateSlug` in `src/domains/freelancer/profile.ts`) and was only
caught because an integration test stopped producing output.

Other Drizzle-specific traps already hit:

- **`= ANY(${array})` does not work** — Drizzle will not bind a JS array as a Postgres array. Build an
  `IN` list with `sql.join`.
- **Drizzle drops `undefined` from `sql` templates**, silently shifting every later placeholder.
  Coerce to `null` (`src/domains/automation/dispatch.ts` has an `nz()` helper for this).
- **`numeric` comes back as a string** from `postgres.js`. `toNumber()` in `src/lib/serialize.ts`.
- **Postgres timestamps are not ISO-8601** (`2026-09-29 12:00:00+00`, space not `T`). Safari's
  `Date` rejects them. `toIso()` in `src/lib/serialize.ts`.
- **`db.execute<T>` constrains `T` to `Record<string, unknown>`**, so a row `interface` needs an index
  signature to be usable as the generic argument.

## Routing

- **`src/pages/` is the Pages Router convention.** Page components live in `src/views/`; putting them
  back under `src/pages/` makes Next try to route them.
- **A `_folder` under `app/` is private** and excluded from routing.
- **The strangler rewrite in `next.config.ts` must be `fallback`, not `afterFiles`.** Match order is
  static → `afterFiles` → **dynamic** → `fallback`, so an `afterFiles` proxy beats every dynamic API
  route — silently, with a plausible-looking response from Spring.

## Error handling in route handlers

Use **`authErrorResponse(error)`** from `src/lib/auth-errors.ts`, not the individual mappers. Two
separate mappers existed and each route picked one, which is how a properly-mapped error still came
out as a 500 (`AccountGoneError` on `/api/user/me`). One entry point removes the choice.

## Runtime

Every route that touches the database, sends mail, or hashes a password needs the **Node runtime**.
Do not add `export const runtime = "edge"` to those — `postgres.js`, `nodemailer`, `bcryptjs` and
`node:crypto` all require it, and the failure is at runtime, not build time.

## Passwords

`bcryptjs` v3 defaults its salts to `$2b$`; Spring's `BCryptPasswordEncoder` writes `$2a$`. The
helper in `src/domains/identity/password.ts` pins `$2a$` at strength 10 so the column stays
homogeneous. Verified in both directions against `spring-security-crypto` 6.5.7.
