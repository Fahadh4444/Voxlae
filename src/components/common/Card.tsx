"use client";

/**
 * Card — Reusable card container
 */

import React from 'react';
import '../../styles/components/Card.css';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'dark';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'lg',
  className = '',
  onClick,
  hoverable = false,
}) => {
  const classes = [
    'vx-card',
    `vx-card--${variant}`,
    `vx-card--pad-${padding}`,
    hoverable && 'vx-card--hoverable',
    onClick && 'vx-card--clickable',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {children}
    </div>
  );
};

export default Card;
