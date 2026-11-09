"use client";

/**
 * Avatar — profile image with a graceful fallback.
 *
 * Users paste arbitrary image URLs, which rot (404s, hotlink blocks, expired
 * CDN links). Rather than showing the browser's broken-image icon, we fall back
 * to a generated avatar: the person's initial on a colour derived from their
 * name. The colour is a hash of the name, not random per render — so the same
 * person always gets the same avatar, on every page and every reload.
 *
 * With no name to work from at all, we fall back to the Voxlae mark.
 */

import React, { useState, useEffect } from 'react';
import VoxlaeLogo from './VoxlaeLogo';
import '../../styles/components/Avatar.css';

/** Gender-neutral, brand-adjacent palette. Index is chosen by name hash. */
const AVATAR_COLORS = [
  '#FF6B2C', // Voxlae orange
  '#C24413',
  '#1B7F5E',
  '#2D6CDF',
  '#7C4DBE',
  '#B5720C',
  '#3A7D8C',
  '#C0392B',
];

/** Stable, order-independent-ish string hash → palette index. */
const colorFor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

interface AvatarProps {
  /** User-supplied image URL. May be missing or broken — that's expected. */
  src?: string | null;
  /** Used for the initial and to pick the fallback colour. */
  name?: string | null;
  /** Pixel size (width and height). */
  size?: number;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ src, name, size = 48, className = '' }) => {
  const [failed, setFailed] = useState(false);

  // A new URL deserves a fresh attempt (e.g. after the user edits their avatar)
  useEffect(() => {
    setFailed(false);
  }, [src]);

  // Size travels as a custom property, not inline width/height, so a page can
  // shrink the avatar in a media query — an inline style could not be overridden.
  const dimension = { '--vx-avatar-size': `${size}px` } as React.CSSProperties;
  const classes = `vx-avatar ${className}`.trim();

  if (src && !failed) {
    return (
      <img
        className={classes}
        style={dimension}
        src={src}
        alt={name ? `${name}'s avatar` : ''}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    );
  }

  const initial = name?.trim()?.charAt(0)?.toUpperCase();

  // No name either — show the brand mark rather than an empty circle
  if (!initial) {
    return (
      <span className={`${classes} vx-avatar--brand`} style={dimension} aria-hidden="true">
        <VoxlaeLogo size={Math.round(size * 0.55)} variant="icon" />
      </span>
    );
  }

  return (
    <span
      className={`${classes} vx-avatar--initials`}
      style={{ ...dimension, background: colorFor(name!) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
};

export default Avatar;
