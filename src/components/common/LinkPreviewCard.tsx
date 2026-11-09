"use client";

/**
 * LinkPreviewCard — small metadata card for a URL (image, title, site).
 *
 * Renders already-resolved metadata; it does not fetch. Fetching is the caller's
 * job (see `useLinkPreview`), because the editor wants loading/error states while
 * the public profile just renders what we cached at save time.
 *
 * Reusable for any link surface — portfolio projects today, and anywhere else a
 * pasted URL should look like something rather than raw text.
 */

import React from 'react';
import '../../styles/components/LinkPreviewCard.css';

export interface LinkPreviewData {
  url?: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
}

interface LinkPreviewCardProps {
  data: LinkPreviewData;
  /** Show a loading skeleton instead of content. */
  loading?: boolean;
  /** Compact single-row layout (used inside the editor). */
  compact?: boolean;
  onRemove?: () => void;
}

const hostOf = (url?: string): string => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ data, loading, compact, onRemove }) => {
  if (loading) {
    return (
      <div className={`vx-link-preview ${compact ? 'vx-link-preview--compact' : ''} vx-link-preview--loading`}>
        <div className="vx-link-preview__thumb vx-link-preview__skeleton" />
        <div className="vx-link-preview__body">
          <div className="vx-link-preview__skeleton vx-link-preview__skeleton--line" />
          <div className="vx-link-preview__skeleton vx-link-preview__skeleton--line short" />
        </div>
      </div>
    );
  }

  const site = data.siteName || hostOf(data.url);
  const title = data.title || data.url;

  return (
    <div className={`vx-link-preview ${compact ? 'vx-link-preview--compact' : ''}`}>
      {data.image ? (
        <img className="vx-link-preview__thumb" src={data.image} alt="" loading="lazy" />
      ) : (
        <div className="vx-link-preview__thumb vx-link-preview__thumb--empty" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="20" height="20">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
      )}

      <div className="vx-link-preview__body">
        {site && <span className="vx-link-preview__site">{site}</span>}
        {title && <span className="vx-link-preview__title">{title}</span>}
        {!compact && data.description && (
          <span className="vx-link-preview__desc">{data.description}</span>
        )}
      </div>

      {onRemove && (
        <button
          type="button"
          className="vx-link-preview__remove"
          onClick={onRemove}
          aria-label="Remove preview"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default LinkPreviewCard;
