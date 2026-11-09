"use client";

/**
 * PillTabs — Animated fancy pill tabs component
 * 
 * Features:
 * - Smooth animated indicator
 * - Hover effects
 * - Icons support
 * - Query param sync
 */

import React, { useRef, useEffect, useState } from 'react';
import '../../styles/components/PillTabs.css';

export interface PillTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface PillTabsProps {
  tabs: PillTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'outlined' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

const PillTabs: React.FC<PillTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  fullWidth = false,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  // Update indicator position when active tab changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeButton = container.querySelector<HTMLButtonElement>(
      `[data-tab-id="${activeTab}"]`
    );
    
    if (activeButton) {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      
      setIndicatorStyle({
        left: buttonRect.left - containerRect.left,
        width: buttonRect.width,
        opacity: 1,
      });
    }
  }, [activeTab, tabs]);

  const classes = [
    'vx-pill-tabs',
    `vx-pill-tabs--${variant}`,
    `vx-pill-tabs--${size}`,
    fullWidth && 'vx-pill-tabs--full-width',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} ref={containerRef}>
      {/* Animated indicator */}
      <div 
        className="vx-pill-tabs__indicator" 
        style={indicatorStyle}
        aria-hidden="true"
      />
      
      {/* Tab buttons */}
      {tabs.map((tab) => (
        <button
          key={tab.id}
          data-tab-id={tab.id}
          className={`vx-pill-tabs__tab ${activeTab === tab.id ? 'vx-pill-tabs__tab--active' : ''}`}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
        >
          {tab.icon && <span className="vx-pill-tabs__icon">{tab.icon}</span>}
          <span className="vx-pill-tabs__label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

export default PillTabs;
