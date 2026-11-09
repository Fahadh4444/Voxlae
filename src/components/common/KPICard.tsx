"use client";

/**
 * KPICard — Analytics KPI display card
 * 
 * Features:
 * - Value with change indicator
 * - Icon with color
 * - Loading state
 * - Locked state for monetization
 */

import React from 'react';
import '../../styles/components/KPICard.css';

export interface KPICardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  iconColor?: string;
  iconBgColor?: string;
  isLoading?: boolean;
  isLocked?: boolean;
  onUpgrade?: () => void;
  className?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  change,
  changeLabel,
  icon,
  iconColor = 'var(--vx-primary)',
  iconBgColor,
  isLoading = false,
  isLocked = false,
  onUpgrade,
  className = '',
}) => {
  const bgColor = iconBgColor || `${iconColor}15`;
  
  const formatValue = (val: string | number): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      return val.toLocaleString();
    }
    return val;
  };

  const renderChange = () => {
    if (change === undefined || change === null) return null;
    
    const isPositive = change >= 0;
    const changeClass = isPositive ? 'vx-kpi-card__change--positive' : 'vx-kpi-card__change--negative';
    const arrow = isPositive ? '↑' : '↓';
    
    return (
      <span className={`vx-kpi-card__change ${changeClass}`}>
        {arrow} {Math.abs(change).toFixed(1)}%
        {changeLabel && <span className="vx-kpi-card__change-label">{changeLabel}</span>}
      </span>
    );
  };

  const classes = [
    'vx-kpi-card',
    isLoading && 'vx-kpi-card--loading',
    isLocked && 'vx-kpi-card--locked',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {/* Locked overlay */}
      {isLocked && (
        <div className="vx-kpi-card__locked-overlay">
          <span className="vx-kpi-card__lock-icon">🔒</span>
          <span className="vx-kpi-card__lock-text">Pro Feature</span>
          {onUpgrade && (
            <button className="vx-kpi-card__upgrade-btn" onClick={onUpgrade}>
              Upgrade
            </button>
          )}
        </div>
      )}
      
      <div className="vx-kpi-card__content">
        <div 
          className="vx-kpi-card__icon"
          style={{ 
            background: bgColor, 
            color: iconColor,
          }}
        >
          {isLoading ? <div className="vx-kpi-card__icon-skeleton" /> : icon}
        </div>
        
        <div className="vx-kpi-card__data">
          {isLoading ? (
            <>
              <div className="vx-kpi-card__value-skeleton" />
              <div className="vx-kpi-card__label-skeleton" />
            </>
          ) : (
            <>
              <div className="vx-kpi-card__value-row">
                <span className="vx-kpi-card__value">
                  {isLocked ? '••••' : formatValue(value)}
                </span>
                {!isLocked && renderChange()}
              </div>
              <span className="vx-kpi-card__label">{label}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KPICard;
