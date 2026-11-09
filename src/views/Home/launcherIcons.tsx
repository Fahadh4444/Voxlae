"use client";

/**
 * launcherIcons — inline SVG icons shared by the Home dashboard and the
 * Creator Tools hub. Stroke-based, currentColor, 24×24 viewBox to match the
 * sidebar's icon language.
 */

import React from 'react';

const svg = (children: React.ReactNode): React.ReactElement => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const IconPlatforms = () => svg(<>
  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
  <line x1="8" y1="21" x2="16" y2="21" />
  <line x1="12" y1="17" x2="12" y2="21" />
</>);

export const IconTools = () => svg(
  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
);

export const IconFreelancers = () => svg(<>
  <circle cx="9" cy="8" r="3.2" />
  <circle cx="17" cy="10" r="2.6" />
  <path d="M2.5 20c0-3.2 2.9-5 6.5-5s6.5 1.8 6.5 5" />
</>);

export const IconBrands = () => svg(<>
  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
  <line x1="7" y1="7" x2="7.01" y2="7" />
</>);

export const IconTrends = () => svg(<>
  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
  <polyline points="17 6 23 6 23 12" />
</>);

export const IconAutomations = () => svg(<>
  <rect x="2" y="2" width="20" height="20" rx="5" />
  <circle cx="12" cy="12" r="4" />
  <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
</>);

export const IconCaption = () => svg(<>
  <path d="M4 7V4h16v3" />
  <path d="M9 20h6" />
  <path d="M12 4v16" />
</>);

export const IconLock = () => svg(<>
  <rect x="4" y="10" width="16" height="10" rx="2" />
  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
</>);

export const IconBack = () => svg(
  <path d="M15 6l-6 6 6 6" />
);
