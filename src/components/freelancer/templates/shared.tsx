"use client";

/** Small helpers + icons shared by every profile template. */

import React from 'react';

export const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: 'Available now',
  OPEN_TO_OFFERS: 'Open to offers',
  BOOKED: 'Fully booked',
};

/** "www.dribbble.com/x" → "dribbble.com". Empty string for unparseable input. */
export const hostOf = (url?: string): string => {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Format a mailto subject line for a work enquiry. */
export const enquirySubject = (name: string): string =>
  encodeURIComponent('Voxlae — work enquiry for ' + name);

/** "2022-03 → present" — a compact experience date range (YYYY-MM). */
export const experienceRange = (startDate?: string, endDate?: string): string | null => {
  if (!startDate && !endDate) return null;
  return `${startDate?.slice(0, 7) || '—'} → ${endDate ? endDate.slice(0, 7) : 'present'}`;
};

export const ShareIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width={size} height={size}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
