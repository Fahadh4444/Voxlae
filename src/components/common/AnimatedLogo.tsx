"use client";

/**
 * AnimatedLogo — Animated brand logo for various UI states
 * 
 * Replaces the mascot with brand-aligned animated logo.
 * Used for: empty states, loading indicators, hero sections, tips.
 */

import React from 'react';
import logoImage from '../../assets/images/logo-nobackground.png';
import '../../styles/components/AnimatedLogo.css';

export type LogoAnimation = 
  | 'idle'       // Subtle breathing/pulse
  | 'active'     // More energetic pulse
  | 'float'      // Gentle floating motion
  | 'spin'       // Loading spinner
  | 'bounce'     // Attention-grabbing bounce
  | 'glow'       // Pulsing glow effect
  | 'none';      // No animation

export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AnimatedLogoProps {
  /** Animation style */
  animation?: LogoAnimation;
  /** Size preset */
  size?: LogoSize;
  /** Custom size in pixels (overrides size preset) */
  customSize?: number;
  /** Additional CSS classes */
  className?: string;
  /** Show glow ring behind logo */
  showGlow?: boolean;
  /** Show orbiting ring effect */
  showRing?: boolean;
}

const sizePx: Record<LogoSize, number> = {
  xs: 32,
  sm: 48,
  md: 80,
  lg: 120,
  xl: 160,
};

const AnimatedLogo: React.FC<AnimatedLogoProps> = ({
  animation = 'idle',
  size = 'md',
  customSize,
  className = '',
  showGlow = false,
  showRing = false,
}) => {
  const px = customSize || sizePx[size];
  
  const wrapperClasses = [
    'vx-animated-logo',
    `vx-animated-logo--${animation}`,
    `vx-animated-logo--${size}`,
    showGlow && 'vx-animated-logo--with-glow',
    showRing && 'vx-animated-logo--with-ring',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={wrapperClasses}
      style={{ 
        width: px, 
        height: px,
        '--logo-size': `${px}px`,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      {/* Glow effect layer */}
      {showGlow && <div className="vx-animated-logo__glow" />}
      
      {/* Ring effect layer */}
      {showRing && <div className="vx-animated-logo__ring" />}
      
      {/* Main logo */}
      <img
        src={logoImage.src}
        alt=""
        className="vx-animated-logo__image"
        draggable={false}
      />
    </div>
  );
};

export default AnimatedLogo;
