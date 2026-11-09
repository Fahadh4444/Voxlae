"use client";

/**
 * Badge — Status/label indicator component
 * 
 * Used for: level badges, coming soon tags, locked indicators
 */

import React from 'react';
import './Badge.css';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'locked' | 'muted';
  size?: 'sm' | 'md';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}) => {
  const classes = [
    'vx-badge',
    `vx-badge--${variant}`,
    `vx-badge--${size}`,
    className,
  ].filter(Boolean).join(' ');

  return <span className={classes}>{children}</span>;
};

export default Badge;
