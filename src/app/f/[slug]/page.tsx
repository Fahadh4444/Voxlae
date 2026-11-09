import type { Metadata } from "next";
import FreelancerPublicProfilePage from "@/views/FreelancerPublicProfilePage";
import {
  cardVersion,
  getPublicProfileCard,
} from "@/domains/freelancer/public-profile";
import { SITE_URL } from "@/lib/env";

/**
 * Public freelancer profile — a Server Component, unlike every other route in the port.
 *
 * This is the page the nginx crawler hack existed for. Social and search crawlers were sniffed by
 * User-Agent and proxied to Spring's `/api/seo/render`, which built HTML by hand, while humans got
 * an empty SPA shell. Serving different HTML to crawlers than to people is cloaking, and Google
 * can penalise it.
 *
 * Here the metadata is rendered server-side for *everyone*, so there is nothing to sniff and no
 * second rendering path to keep in sync. The interactive profile below is still a client
 * component; only the `<head>` moved to the server, which is all crawlers read.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

const AVAILABILITY_LABELS: Record<string, string> = {
  AVAILABLE: "Available for work",
  OPEN_TO_OFFERS: "Open to offers",
  BOOKED: "Currently booked",
};

function describe(card: {
  headline: string | null;
  location: string | null;
  availability: string;
  skills: string[];
}): string {
  const parts = [
    card.headline,
    card.location,
    AVAILABILITY_LABELS[card.availability],
    card.skills.slice(0, 4).join(", ") || null,
  ].filter(Boolean);
  return parts.join(" · ") || "Freelancer profile on Voxlae.";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = await getPublicProfileCard(slug);

  if (!card) {
    // Unknown slug: no profile to describe, and nothing worth indexing.
    return {
      title: "Profile not found",
      robots: { index: false, follow: false },
    };
  }

  const title = card.headline ? `${card.name} — ${card.headline}` : card.name;
  const description = describe(card);
  const image = `/og/f/${card.slug}?v=${cardVersion(card)}`;

  return {
    title,
    description,
    alternates: { canonical: `/f/${card.slug}` },
    openGraph: {
      type: "profile",
      url: `/f/${card.slug}`,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const card = await getPublicProfileCard(slug);

  /**
   * Person JSON-LD, carried over from Spring's `freelancerJsonLd`. Emitted with
   * `JSON.stringify` rather than hand-built strings — the Java version had a bespoke escaper
   * specifically to stop a `</script>` in user content breaking out of the tag, which is a
   * problem worth not re-implementing.
   */
  const jsonLd = card
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: card.name,
        url: `${SITE_URL}/f/${card.slug}`,
        ...(card.headline ? { jobTitle: card.headline } : {}),
        ...(card.avatarUrl ? { image: card.avatarUrl } : {}),
        description: describe(card),
        ...(card.skills.length ? { knowsAbout: card.skills } : {}),
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <FreelancerPublicProfilePage />
    </>
  );
}
