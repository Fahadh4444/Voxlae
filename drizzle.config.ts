import { defineConfig } from "drizzle-kit";

/**
 * Drizzle is the query layer only — it does NOT own migrations.
 *
 * Flyway owns schema changes, as it always has: hand-written SQL in `db/migration/`, which is
 * also where the 43 migrations from the Java service now live. Drizzle's role is the one Hibernate
 * used to play — typed queries — and `src/db/schema.ts` is just a typed *view* of tables Flyway
 * created.
 *
 * ⚠️  Do not run `drizzle-kit generate`. It diffs `schema.ts` against the database and emits SQL
 * for anything it thinks is missing — but its DSL cannot see RLS policies, grants, triggers or
 * functions, so it treats those as drift to be removed. On the first attempt it produced
 * `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` for all 36 tables, which against Supabase (where
 * PostgREST serves tables with the anon key) is a data-exposure bug. Write the SQL yourself.
 *
 * The only supported command here is `pull`, and it is a *verification* tool: re-introspect and
 * diff against `schema.ts` to catch drift after someone adds a Flyway migration.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://localhost:5432/voxlae_schema_scratch",
  },
  casing: "snake_case",
});
