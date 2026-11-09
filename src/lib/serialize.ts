/**
 * Type fidelity helpers for endpoints migrated off Spring.
 *
 * Jackson and node-postgres disagree about two things that reach the frontend:
 *
 *  - **Timestamps.** Jackson writes an `Instant` as ISO-8601 (`2026-09-23T01:24:51.549Z`);
 *    postgres.js with Drizzle's `mode: 'string'` hands back Postgres's own rendering
 *    (`2026-09-23 01:24:51.549758+05:30`), with a space instead of `T`. `new Date()` accepts that
 *    in V8 but it is not valid ISO-8601, and Safari rejects it — so it would fail for some users
 *    and not others.
 *  - **Numerics.** Jackson writes a `BigDecimal` as a JSON number; the pg driver returns
 *    `numeric` as a *string* to avoid float precision loss. The frontend types declare
 *    `rateAmount?: number | null` and do arithmetic on it.
 *
 * Both are the kind of mismatch that type-checks fine and misbehaves at runtime, so conversion
 * happens once here rather than being remembered at each call site.
 */

/**
 * Postgres timestamp → ISO-8601, matching Jackson. Null passes through.
 *
 * Three shapes have to be handled, and the third is the one that bit:
 *
 *  1. `Date` — passed straight through.
 *  2. `2026-09-23 01:24:51.549758+05:30` — space instead of `T`.
 *  3. **`2026-03-02 02:36:18.79798+00`** — a *bare hour* offset, which is what Postgres renders on a
 *     **UTC server**, and which is not valid ISO-8601. `new Date()` returns Invalid Date for it, so
 *     the old implementation returned null for every timestamp in production while working perfectly
 *     against a database on a machine at +05:30. Nothing failed; dates simply arrived as null.
 *
 * `+HHMM` is normalised too, since Postgres emits that form for some non-whole-hour zones.
 */
export function toIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  let text = value.replace(" ", "T");
  // `+00` -> `+00:00`, and `+0530` -> `+05:30`. Anchored to the end so a time like `12:00` is safe.
  text = text
    .replace(/([+-]\d{2})$/, "$1:00")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2");

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Postgres `numeric` string → number, matching Jackson's BigDecimal output.
 *
 * Safe for the magnitudes involved here (rates, counts). Anything that genuinely needs more than
 * 15 significant digits should stay a string and say so explicitly.
 */
export function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
