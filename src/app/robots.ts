import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env";

/**
 * Replaces the static `public/robots.txt`.
 *
 * Same rules, with two changes now that the crawler hack is gone: `/api/seo/` no longer needs
 * allowing (that surface is being deleted), and the OG cards moved from `/api/og/` to `/og/`
 * since they are now a Next route rather than a Spring endpoint.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/og/"],
      disallow: [
        // Signed-in / app-only routes — nothing useful for search.
        "/account",
        "/select-role",
        "/email-verification",
        "/influencer/",
        "/brand/",
        "/freelancer/profile",
        "/freelancer/templates",
        "/api/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
