import { NextResponse } from "next/server";

/**
 * Next's own liveness probe — served by this app, never proxied.
 *
 * Its twin is Spring's `GET /api/health/isrunning`, which still goes over the rewrite. The status
 * page probes both, so a red light tells you *which* half is down.
 */
export async function GET() {
  return NextResponse.json({
    status: "UP",
    servedBy: "next",
    runtime: process.version,
    timestamp: new Date().toISOString(),
  });
}
