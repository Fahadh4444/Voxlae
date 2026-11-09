"use client";

/**
 * Button — Reusable VOXLAE button component
 *
 * Variants: primary | secondary | danger | ghost
 * Sizes:    sm | md | lg
 */

import React from 'react';
import '../../styles/components/Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...rest
}) => {
  const classes = [
    'vx-btn',
    `vx-btn--${variant}`,
    `vx-btn--${size}`,
    fullWidth && 'vx-btn--full',
    isLoading && 'vx-btn--loading',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading && <span className="vx-btn__spinner" />}
      {!isLoading && leftIcon && <span className="vx-btn__icon">{leftIcon}</span>}
      <span className="vx-btn__label">{children}</span>
      {!isLoading && rightIcon && <span className="vx-btn__icon">{rightIcon}</span>}
    </button>
  );
};

export default Button;
