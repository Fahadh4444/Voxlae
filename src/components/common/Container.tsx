"use client";

/**
 * Container — Constrained-width page content wrapper
 */

import React from 'react';
import './Container.css';

export interface ContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

const Container: React.FC<ContainerProps> = ({
  children,
  size = 'lg',
  className = '',
}) => {
  const classes = [
    'vx-container',
    `vx-container--${size}`,
    className,
  ].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
};

export default Container;
