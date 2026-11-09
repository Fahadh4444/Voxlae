"use client";

/**
 * VoxlaeLogo — Centralized brand logo component
 * 
 * Uses the official logo from assets for consistent branding across:
 * - Navbar
 * - Footer
 * - Loading states
 * - Any other location requiring the brand mark
 */

import React from 'react';
import logoImage from '../../assets/images/logo-nobackground.png';

interface VoxlaeLogoProps {
  /** Logo height in pixels */
  size?: number;
  /** 'full' shows logo + wordmark, 'icon' shows logo only */
  variant?: 'full' | 'icon';
  /** Additional CSS classes */
  className?: string;
  /** Text color for wordmark (inherits if not specified) */
  textColor?: string;
  /** For dark backgrounds - adjusts contrast */
  darkMode?: boolean;
}

const VoxlaeLogo: React.FC<VoxlaeLogoProps> = ({
  size = 32,
  variant = 'full',
  className = '',
  textColor,
  darkMode = false,
}) => {
  const wordmarkColor = textColor || (darkMode ? '#FFFFFF' : 'inherit');
  
  return (
    <div 
      className={`vx-logo ${className}`} 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.625rem',
      }}
    >
      {/* Official Logo Image */}
      <img 
        src={logoImage.src}
        alt="VOXLAE Logo"
        style={{ 
          height: size, 
          width: 'auto',
          objectFit: 'contain',
          flexShrink: 0,
        }}
        draggable={false}
      />
      
      {variant === 'full' && (
        <span 
          className="vx-logo__wordmark"
          style={{
            fontWeight: 800,
            fontSize: size * 0.55,
            letterSpacing: '-0.025em',
            color: wordmarkColor,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          VOXLAE
        </span>
      )}
    </div>
  );
};

export default VoxlaeLogo;
