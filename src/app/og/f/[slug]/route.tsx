import { ImageResponse } from "next/og";
import { getPublicProfileCard } from "@/domains/freelancer/public-profile";

/**
 * Social card for a freelancer profile.
 *
 * Replaces `OgImageService` — 671 lines of Java2D that hand-drew gradients, crop marks and text
 * layout, plus `SafeImageFetcher` (199 more) guarding against SSRF when pulling a user-supplied
 * avatar. Satori lays this out from flexbox instead, so the drawing code disappears rather than
 * being ported.
 *
 * The avatar is deliberately NOT fetched. It is a user-supplied URL, and fetching it server-side
 * is exactly the SSRF exposure `SafeImageFetcher` existed to contain. An initial monogram carries
 * the same recognition at card size without reintroducing that surface — if real avatars are
 * wanted later, proxy them through a validated allowlist rather than fetching arbitrary URLs.
 */

export const runtime = "nodejs";

const BRAND = "#FF6B2C";
const NAVY_TOP = "#0F1B3D";
const NAVY_BOTTOM = "#0A1229";

const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: "Available for work",
  OPEN_TO_OFFERS: "Open to offers",
  BOOKED: "Currently booked",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const card = await getPublicProfileCard(slug);

  const name = card?.name ?? "Voxlae";
  const headline = card?.headline ?? "Freelancer on Voxlae";
  const location = card?.location ?? null;
  const availability = card ? AVAILABILITY_LABELS[card.availability] : null;
  const skills = card?.skills.slice(0, 4) ?? [];
  const initial = name.trim().charAt(0).toUpperCase() || "V";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: `linear-gradient(160deg, ${NAVY_TOP} 0%, ${NAVY_BOTTOM} 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: 999,
              background: BRAND,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 54,
              fontWeight: 700,
              color: "#141414",
            }}
          >
            {initial}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 58, fontWeight: 700, color: "#FFFFFF" }}>
              {name}
            </div>
            {availability && (
              <div style={{ fontSize: 26, color: BRAND, fontWeight: 600 }}>
                {availability}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 40, color: "#E3E3E5", lineHeight: 1.25 }}>
            {headline}
          </div>
          {location && (
            <div style={{ fontSize: 28, color: "#9A9AA5" }}>{location}</div>
          )}
          {skills.length > 0 && (
            <div style={{ display: "flex", gap: 14 }}>
              {skills.map((skill) => (
                <div
                  key={skill}
                  style={{
                    fontSize: 24,
                    color: "#E3E3E5",
                    background: "rgba(255,255,255,0.10)",
                    padding: "10px 22px",
                    borderRadius: 999,
                  }}
                >
                  {skill}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            paddingTop: 26,
          }}
        >
          <div style={{ fontSize: 26, color: "#9A9AA5" }}>voxlae.com</div>
          <div style={{ fontSize: 26, color: BRAND, fontWeight: 600 }}>
            VOXLAE
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Long-lived: the URL carries a content-derived version token, so a change produces a
        // new URL rather than needing the old one to expire.
        "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
      },
    },
  );
}
