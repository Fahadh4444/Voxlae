#!/usr/bin/env bash
# Flyway wrapper that reads connection settings from .env.local.
#
# Usage:  ./scripts/db.sh migrate|info|validate|baseline
#
# Flyway owns schema changes. To add one, write db/migration/V<n>__name.sql by hand, then
# `./scripts/db.sh migrate`. Never use `drizzle-kit generate` (see drizzle.config.ts).
#
# Since Spring was retired this is the *only* thing that applies migrations, production included, so
# it has to understand the production URL, not just the local scratch one:
#
#  - JDBC does not accept `user:password@` inside the URL, so credentials are split out into
#    -user / -password. The user falls back to $(whoami) only when the URL carries none (local dev).
#  - The Supabase pooler on 6543 is transaction mode. Flyway holds a session-level advisory lock for
#    the whole run, which transaction mode cannot give it, so pooler URLs are moved to 5432 — the same
#    host in session mode. (The app itself now uses 5432 too; this only matters for a 6543 URL.)
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.local ] && set -a && . ./.env.local && set +a

URL="${DATABASE_URL:-postgresql://localhost:5432/voxlae_schema_scratch}"

# node rather than shell string surgery: it percent-decodes the password correctly.
eval "$(URL="$URL" node -e '
  const u = new URL(process.env.URL);
  if (u.hostname.endsWith(".pooler.supabase.com") && u.port === "6543") u.port = "5432";
  const q = (s) => "\x27" + s.replace(/\x27/g, "\x27\\\x27\x27") + "\x27";
  console.log(`JDBC=${q(`jdbc:postgresql://${u.host}${u.pathname}`)}`);
  console.log(`URL_USER=${q(decodeURIComponent(u.username))}`);
  console.log(`URL_PASSWORD=${q(decodeURIComponent(u.password))}`);
')"

USER_NAME="${FLYWAY_USER:-${URL_USER:-$(whoami)}}"
ARGS=(-url="$JDBC" -user="$USER_NAME" -locations="filesystem:./db/migration")
[ -n "$URL_PASSWORD" ] && ARGS+=(-password="$URL_PASSWORD")

echo "flyway $1 → ${JDBC} as ${USER_NAME}" >&2
exec flyway "${ARGS[@]}" "$@"
