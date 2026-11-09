import type { NextConfig } from "next";

/**
 * No rewrites.
 *
 * This file used to hold the strangler seam: a `fallback` rewrite sending every `/api/*` path Next did
 * not serve on to Spring. It was removed once every endpoint the frontend calls was served here —
 * verified by extracting all 69 `api.*` calls from the UI and matching each against the route table.
 *
 * Leaving it in would have been actively harmful after cutover: a mistyped or removed path would be
 * proxied to a Spring that no longer exists, producing a slow gateway error instead of an immediate
 * 404, and hiding exactly the kind of gap that seam existed to surface.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
