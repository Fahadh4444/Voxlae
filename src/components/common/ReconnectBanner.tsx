"use client";

/**
 * ReconnectBanner — Banner for platform reconnection required
 * 
 * Shows when a platform's OAuth token has expired
 * and requires user to reconnect.
 */

import React from 'react';
import { Platform } from '../../api/types';
import Button from './Button';
import '../../styles/components/ReconnectBanner.css';

export interface ReconnectBannerProps {
  platform: Platform;
  onReconnect: () => void;
  onDismiss?: () => void;
  isLoading?: boolean;
}

const platformNames: Record<Platform, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
};

const ReconnectBanner: React.FC<ReconnectBannerProps> = ({
  platform,
  onReconnect,
  onDismiss,
  isLoading = false,
}) => {
  const platformName = platformNames[platform];
  
  return (
    <div className={`vx-reconnect-banner vx-reconnect-banner--${platform}`}>
      <div className="vx-reconnect-banner__content">
        <span className="vx-reconnect-banner__icon">⚠️</span>
        <div className="vx-reconnect-banner__text">
          <strong>{platformName} connection expired</strong>
          <span>
            {platform === 'instagram' 
              ? 'Instagram tokens cannot auto-refresh. Please reconnect to continue syncing your data.'
              : 'Please reconnect your account to continue syncing data.'}
          </span>
        </div>
      </div>
      <div className="vx-reconnect-banner__actions">
        <Button 
          variant="primary" 
          size="sm" 
          onClick={onReconnect}
          isLoading={isLoading}
        >
          Reconnect {platformName}
        </Button>
        {onDismiss && (
          <button 
            className="vx-reconnect-banner__dismiss" 
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default ReconnectBanner;
