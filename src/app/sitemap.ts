import type { MetadataRoute } from "next";
import { listPublicSlugs } from "@/domains/freelancer/public-profile";
import { SITE_URL } from "@/lib/env";

/**
 * Replaces Spring's `/api/seo/sitemap.xml`, which nginx mapped `/sitemap.xml` onto. Next serves
 * `/sitemap.xml` from this file directly, so that nginx rule can go with the rest of the hack.
 *
 * Priorities and change frequencies are carried over unchanged from `SeoController.sitemap`.
 */
export const revalidate = 21600; // 6h, matching the Cache-Control the Java endpoint set

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /**
   * Degrade to the static entries if the database is unreachable, rather than throwing.
   *
   * This page is prerendered **at build time**, so a throw here fails the entire deploy — and it
   * did, on a transient DNS failure for the Supabase host (`getaddrinfo ENOTFOUND`) while every other
   * route compiled fine. A sitemap missing profile URLs for up to six hours is harmless; a deploy that
   * cannot ship because a crawler hint could not be generated is not. `revalidate` refills it from the
   * database on the next regeneration.
   */
  let slugs: Awaited<ReturnType<typeof listPublicSlugs>> = [];
  try {
    slugs = await listPublicSlugs();
  } catch (error) {
    console.warn(
      `[sitemap] profile slugs unavailable, serving static entries only: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...slugs.map(({ slug, updatedAt }) => ({
      url: `${SITE_URL}/f/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      // The Java version had no lastmod; we have the column, and it helps crawlers skip
      // profiles that have not changed.
      ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
    })),
  ];
}
