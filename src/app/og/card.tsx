import { ImageResponse } from "next/og";

/**
 * The static Voxlae social card, shared by the default / influencer / brand routes.
 *
 * All three are **static per role** — `SeoContentService.roleCard` ignores the slug it is given and
 * returns fixed copy, because influencer and brand profiles are not public pages. Its own comment
 * says the endpoints exist so that "turning those pages public later is a data change, not a new
 * build". Ported with that intent kept: the route accepts a slug and does nothing with it, so wiring
 * real per-profile content later is a change here and nowhere else.
 *
 * Replaces the Java2D drawing in `OgImageService` — Satori lays this out from flexbox, so the
 * gradient, crop marks and text metrics code disappears rather than being ported.
 */

const BRAND = "#FF6B2C";
const NAVY_TOP = "#0F1B3D";
const NAVY_BOTTOM = "#0A1229";

export type CardRole = "GENERIC" | "INFLUENCER" | "BRAND" | "FREELANCER";

const HEADLINES: Record<CardRole, string> = {
  GENERIC: "Grow. Get hired. Find talent.",
  INFLUENCER: "Creator analytics, trends & growth plans",
  BRAND: "Find and hire the right creators",
  FREELANCER: "Hire vetted freelancers",
};

const TAGS: Record<CardRole, string[]> = {
  GENERIC: ["Creators", "Freelancers", "Brands"],
  INFLUENCER: ["Voxlae"],
  BRAND: ["Voxlae"],
  FREELANCER: ["Voxlae"],
};

export function renderRoleCard(role: CardRole): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundImage: `linear-gradient(160deg, ${NAVY_TOP} 0%, ${NAVY_BOTTOM} 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: BRAND,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            V
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#fff", letterSpacing: -0.5 }}>
            Voxlae
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.1,
              letterSpacing: -2,
              maxWidth: 940,
            }}
          >
            {HEADLINES[role]}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {TAGS[role].map((tag) => (
              <div
                key={tag}
                style={{
                  padding: "10px 20px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.22)",
                  color: "rgba(255,255,255,0.82)",
                  fontSize: 24,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.55)" }}>voxlae.com</div>
          <div style={{ width: 120, height: 5, borderRadius: 999, background: BRAND }} />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        /**
         * Static content, so it is cached hard. The Java hand-rolled a 15-minute in-process cache plus
         * ETags — pointless here: the image never changes, and an in-process cache is empty on every
         * cold start anyway. The CDN does the job properly.
         */
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
