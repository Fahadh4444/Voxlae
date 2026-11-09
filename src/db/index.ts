import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

/**
 * Database client.
 *
 * Connection settings here are the serverless-safe ones, and they matter more than they look:
 *
 * - **Use the pooler in *session* mode (port 5432), not transaction mode (6543).** Transaction mode
 *   was the original choice and it hangs: under concurrent requests one pooled connection would
 *   wedge mid-query — caught in `pg_stat_activity` as an `active` query in `ClientRead`, Postgres
 *   waiting for the rest of a message the client had already sent — and the request never finished
 *   (a different endpoint each time; disabling postgres.js pipelining did not help). Measured on the
 *   same app and load: transaction mode 1–6 hung requests per round of 8, session mode 0 in 48.
 *   Session mode pins one backend per client connection, so the idle timeout below matters: it
 *   hands backends back quickly. Revisit at scale (Supabase's pool size is the ceiling).
 * - **`prepare: false`** is kept so the client still works if pointed back at transaction mode,
 *   where server-side prepared statements break.
 * - **`max: 5`, not 1.** One connection per instance was right for classic serverless (one request
 *   per instance), but Vercel's Fluid compute runs many requests on one instance — with `max: 1` they
 *   all queue on a single connection.
 * - **Timeouts, because a dead connection otherwise stalls for minutes.** Supavisor drops idle
 *   clients, and laptops sleep and change networks; without `idle_timeout` the next query is written
 *   into a socket nobody is reading and waits out the OS TCP timeout — while every query queued
 *   behind it waits too. Observed in dev: requests taking 2–16 minutes. Idle connections are now
 *   closed after 20s (before anything upstream drops them), a connect attempt fails after 10s, and
 *   connections are recycled every 30 minutes.
 *
 * The client is cached on `globalThis` so dev hot-reload doesn't open a new connection on every
 * edit until the database refuses more.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. For local work point it at the scratch database " +
      "(see drizzle.config.ts); for Supabase use the pooler in session mode, port 5432.",
  );
}

const globalForDb = globalThis as unknown as {
  __voxlaeSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__voxlaeSql ??
  postgres(connectionString, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__voxlaeSql = sql;

export const db = drizzle(sql, { schema: { ...schema, ...relations } });
export { schema, relations };
