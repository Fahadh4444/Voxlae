"use client";

/**
 * Seo — a tiny, dependency-free document-head manager.
 *
 * Renders nothing; on mount/update it syncs <title>, the meta description, canonical
 * link, robots directive, Open Graph / Twitter tags and any JSON-LD for the current
 * route. This covers search engines (Google renders JS) and any human-facing tab title.
 *
 * NOTE: social crawlers (Facebook, LinkedIn, WhatsApp, X, Slack, …) do NOT run JS, so
 * these client-set tags are invisible to them — the server-rendered crawler HTML
 * (backend /api/seo/render, routed by nginx) is what gives them real per-URL previews.
 * This component and that endpoint are kept deliberately in sync.
 *
 * We avoid react-helmet to keep the dependency footprint at zero (matches this repo's
 * minimal-deps style).
 */

import React, { useEffect } from 'react';
import { SITE_URL, DEFAULT_OG_IMAGE, absoluteUrl } from '../../utils/seo';

export interface SeoProps {
  title: string;
  description?: string;
  /** Site-relative path or absolute URL for <link rel="canonical"> + og:url. */
  canonicalPath?: string;
  /** Absolute image URL; defaults to the site-wide branded card. */
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'profile' | 'article';
  noindex?: boolean;
  /** One or more schema.org objects, emitted as <script type="application/ld+json">. */
  jsonLd?: object | object[];
}

const MANAGED = 'data-vx-seo';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute(MANAGED, '');
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute(MANAGED, '');
  el.setAttribute('href', href);
}

const Seo: React.FC<SeoProps> = ({
  title,
  description,
  canonicalPath = '/',
  image = DEFAULT_OG_IMAGE,
  imageAlt,
  type = 'website',
  noindex = false,
  jsonLd,
}) => {
  // Callers pass a fresh jsonLd object each render; serialise it so the effect only
  // re-runs when the actual content changes (not on every parent re-render).
  const jsonLdStr = jsonLd ? JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : '';

  useEffect(() => {
    const canonical = absoluteUrl(canonicalPath);
    const img = absoluteUrl(image);
    const alt = imageAlt || title;

    document.title = title;
    upsertMeta('name', 'title', title);
    if (description) upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    upsertLink('canonical', canonical);

    // Open Graph
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:site_name', 'Voxlae');
    upsertMeta('property', 'og:title', title);
    if (description) upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:image', img);
    upsertMeta('property', 'og:image:secure_url', img);
    upsertMeta('property', 'og:image:type', 'image/png');
    upsertMeta('property', 'og:image:width', '1200');
    upsertMeta('property', 'og:image:height', '630');
    upsertMeta('property', 'og:image:alt', alt);

    // Twitter
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    if (description) upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', img);
    upsertMeta('name', 'twitter:url', canonical);

    // JSON-LD — remove any we previously added, then add the current set.
    document.head.querySelectorAll(`script[${MANAGED}]`).forEach((n) => n.remove());
    if (jsonLdStr) {
      const blocks: object[] = JSON.parse(jsonLdStr);
      for (const block of blocks) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute(MANAGED, '');
        script.text = JSON.stringify(block);
        document.head.appendChild(script);
      }
    }

    // Only the JSON-LD scripts are page-specific enough to clear on unmount; the meta
    // tags get overwritten by the next route's <Seo>, so leaving them avoids flicker.
    return () => {
      document.head.querySelectorAll(`script[${MANAGED}]`).forEach((n) => n.remove());
    };
  }, [title, description, canonicalPath, image, imageAlt, type, noindex, jsonLdStr]);

  return null;
};

/** Organization + WebSite structured data for the landing page. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', name: 'Voxlae', url: SITE_URL, logo: `${SITE_URL}/logo.png` },
      {
        '@type': 'WebSite',
        name: 'Voxlae',
        url: SITE_URL,
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

export default Seo;
