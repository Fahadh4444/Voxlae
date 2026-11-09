"use client";

/**
 * VoxlaeLoader — the single, brand-wide loading indicator.
 *
 * One motion language, three tiers, so a button spinner and a boot screen feel
 * like the same family:
 *   • variant="page"    → Shimmer Sweep signature (a glint scans across the fox).
 *                         For app boot & full-page loads. `fullscreen` makes it a
 *                         fixed overlay on the brand backdrop.
 *   • variant="section" → Orbit ring around the fox. For panels, cards, tables, modals.
 *   • variant="inline"  → compact Orbit for small in-flow spots (optional label beside).
 *
 * Replaces the old per-page spinners, <LoadingSpinner>, and scattered "Loading…" text.
 * Accessible (role="status" + label) and fully honours prefers-reduced-motion.
 */

import React from 'react';
import FoxMark from './FoxMark';
import '../../styles/components/VoxlaeLoader.css';

export type LoaderVariant = 'page' | 'section' | 'inline';

interface VoxlaeLoaderProps {
  variant?: LoaderVariant;
  /** Visible + screen-reader label, e.g. "Loading analytics…". */
  label?: string;
  /** page only: render as a fixed, full-viewport overlay (app boot / route transitions). */
  fullscreen?: boolean;
  className?: string;
}

const VoxlaeLoader: React.FC<VoxlaeLoaderProps> = ({
  variant = 'section',
  label,
  fullscreen = false,
  className = '',
}) => {
  const classes = [
    'vx-loader',
    `vx-loader--${variant}`,
    fullscreen && 'vx-loader--fullscreen',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} role="status" aria-live="polite" aria-label={label || 'Loading'}>
      {variant === 'page' ? (
        <div className="vx-loader__shimmer">
          <div className="vx-loader__fox vx-loader__fox--dim">
            <FoxMark />
          </div>
          <div className="vx-loader__shine" aria-hidden="true" />
        </div>
      ) : (
        <div className="vx-loader__orbit" aria-hidden="true">
          <div className="vx-loader__ring" />
          <div className="vx-loader__dot" />
          <div className="vx-loader__fox">
            <FoxMark />
          </div>
        </div>
      )}

      {label && <span className="vx-loader__label">{label}</span>}
    </div>
  );
};

export default VoxlaeLoader;
