"use client";

/**
 * useLinkPreview — resolve Open Graph metadata for a URL, debounced.
 *
 * Debounced because it fires as the user types/pastes a URL: without it we'd
 * hit the backend (which then hits a third-party site) on every keystroke.
 * Stale responses are discarded, so quickly editing a URL can't leave the card
 * showing metadata for a link the user already replaced.
 */

import { useEffect, useState } from 'react';
import { getLinkPreview } from '../api/services';
import { LinkPreviewData } from '../components/common/LinkPreviewCard';

const DEBOUNCE_MS = 600;

const looksLikeUrl = (value: string): boolean => /^https?:\/\/\S+\.\S+/i.test(value.trim());

interface UseLinkPreviewResult {
  preview: LinkPreviewData | null;
  loading: boolean;
}

export function useLinkPreview(url: string | undefined, enabled = true): UseLinkPreviewResult {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = (url || '').trim();

    if (!enabled || !looksLikeUrl(trimmed)) {
      setPreview(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      getLinkPreview(trimmed)
        .then(data => { if (!cancelled) setPreview(data); })
        // A link with no OG tags (or an unreachable one) isn't an error worth
        // shouting about — the project just saves without a preview.
        .catch(() => { if (!cancelled) setPreview(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, enabled]);

  return { preview, loading };
}
