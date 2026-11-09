/**
 * Runtime configuration.
 *
 * Mirrors the old Vite `VITE_*` vars one-for-one so the UI port is a rename, not a redesign:
 *   VITE_API_BASE_URL      -> NEXT_PUBLIC_API_BASE_URL
 *   VITE_SITE_URL          -> NEXT_PUBLIC_SITE_URL
 *   VITE_GOOGLE_CLIENT_ID  -> NEXT_PUBLIC_GOOGLE_CLIENT_ID
 *   VITE_FEATURE_AUTOMATIONS -> NEXT_PUBLIC_FEATURE_AUTOMATIONS
 *
 * NEXT_PUBLIC_* is inlined into the browser bundle at build time, so it must never hold a secret.
 * Server-only values (DB URL, JWT secret, provider keys) are read directly from `process.env`
 * inside server code and deliberately kept out of this object.
 */

/**
 * Base for API calls. **Must include the `/api` prefix.**
 *
 * `src/api/api.ts` builds request URLs as `${API_BASE_URL}${endpoint}` where endpoint is already
 * path-like ("/auth/google"), so the prefix has to come from the base — the old Vite app set this
 * to `https://voxlae.com/api` for exactly that reason. Setting it to "" looks like a sensible
 * "same origin" default and silently 404s every call.
 *
 * `/api` keeps it same-origin, so the `next.config.ts` rewrite still proxies anything not yet
 * migrated to Spring.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

/**
 * Build-time feature flags.
 *
 * A flag is ON only when its var is exactly the string "true"; unset means OFF. Carried over
 * verbatim from the Vite config because it makes production safe-by-default — a feature stays
 * hidden until explicitly enabled.
 */
export const FEATURES = {
  /**
   * Instagram DM Automations (Creator Tools). Gated OFF until the Meta app passes App Review
   * and is set Live — real comment/DM webhooks are not delivered in Development mode.
   */
  automations: process.env.NEXT_PUBLIC_FEATURE_AUTOMATIONS === "true",
} as const;
