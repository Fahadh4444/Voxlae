"use client";

/**
 * MyPlatformsPage — Platform management & analytics
 * 
 * Sections:
 * 1. Unified Performance Graph
 * 2. Platform Grid (connected / available / coming-soon)
 * 
 * Preserves YouTube + Instagram connection logic from old HomePage.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from '@/lib/router';
import { useUI } from '../context/UIContext';
import { useUser } from '../context/UserContext';
import { buildRoleRoute } from '../utils/roleRoutes';
import {
  getYouTubeStatus,
  getInstagramStatus,
  getInstagramAccountData,
  connectYouTube,
  connectInstagram,
  disconnectYouTube,
  disconnectInstagram,
  reconnectYouTube,
  reconnectInstagram,
  syncYouTubeChannel,
  syncInstagramAccount,
  getYouTubeChannel,
  getDailyMetrics,
  syncMetrics,
} from '../api/services';
import { onReconnectRequired } from '../api/api';
import {
  PlatformStatus,
  InstagramAccountDTO,
  YouTubeChannelDTO,
  DateRange,
  DailySnapshotDTO,
} from '../api/types';
import type { PlatformId } from '../api/types';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Section from '../components/common/Section';
import Container from '../components/common/Container';
import ReconnectBanner from '../components/common/ReconnectBanner';
import TimeSeriesChart from '../components/common/TimeSeriesChart';
import type { PlatformLineConfig, TimeSeriesDataPoint } from '../components/common/TimeSeriesChart';
import '../styles/pages/MyPlatforms.css';

/* ── Date range preset ── */
type DateRangePreset = '30d' | '90d' | '4m' | '6m' | '12m' | 'custom';

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '4m',  label: 'Last 4 months' },
  { value: '6m',  label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
];


function buildDateRange(preset: DateRangePreset, customStart: string, customEnd: string): { startDate: string; endDate: string } {
  const endDate = new Date().toISOString().split('T')[0];
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
  switch (preset) {
    case '30d':  return { startDate: daysAgo(30),  endDate };
    case '90d':  return { startDate: daysAgo(90),  endDate };
    case '4m':   return { startDate: daysAgo(120), endDate };
    case '6m':   return { startDate: daysAgo(180), endDate };
    case '12m':  return { startDate: daysAgo(365), endDate };
    case 'custom': return { startDate: customStart || daysAgo(30), endDate: customEnd || endDate };
  }
}

/* Platform configuration — NOT hardcoded as separate components */
interface PlatformDef {
  id: PlatformId;
  name: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  state: 'connected' | 'available' | 'coming-soon';
}

const platformIcons: Record<string, React.ReactNode> = {
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),
  snapchat: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.979-.26.078-.04.16-.06.237-.06.255 0 .46.183.49.412.03.3-.207.44-.39.508-.18.07-.51.18-.94.27-.093.02-.178.04-.24.06-.3.08-.48.18-.54.33-.06.15-.03.33.09.54.45.72 1.02 1.32 1.65 1.8.24.18.51.33.78.45.12.06.27.15.27.33 0 .21-.21.36-.42.42-.45.12-.87.21-1.26.27-.03.06-.06.15-.09.24-.03.09-.06.18-.12.3-.06.12-.18.21-.36.21h-.03c-.21 0-.51-.06-.87-.18-.39-.12-.81-.18-1.2-.18-.24 0-.48.03-.72.09-.75.18-1.38.78-2.16 1.44-.66.54-1.41 1.17-2.34 1.17h-.12c-.93 0-1.68-.63-2.34-1.17-.78-.66-1.41-1.26-2.16-1.44-.24-.06-.48-.09-.72-.09-.42 0-.81.06-1.2.18-.36.12-.66.18-.87.18h-.03c-.18 0-.3-.09-.36-.21-.06-.12-.09-.21-.12-.3-.03-.09-.06-.18-.09-.24-.39-.06-.81-.15-1.26-.27-.21-.06-.42-.21-.42-.42 0-.18.15-.27.27-.33.27-.12.54-.27.78-.45.63-.48 1.2-1.08 1.65-1.8.12-.21.15-.39.09-.54-.06-.15-.24-.25-.54-.33-.06-.02-.15-.04-.24-.06-.42-.09-.78-.21-.94-.27-.18-.068-.42-.21-.39-.508.03-.23.24-.412.49-.412.08 0 .16.02.24.06.33.15.69.246.98.26.19 0 .33-.045.4-.09-.01-.165-.02-.33-.03-.51l-.003-.06c-.1-1.628-.23-3.654.3-4.847C7.86 1.07 11.216.793 12.206.793z"/>
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
};

const MyPlatformsPage: React.FC = () => {
  const { showToast } = useUI();
  const { activeRole } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Real platform statuses
  const [youtubeStatus, setYoutubeStatus] = useState<PlatformStatus>({
    platform: 'youtube', isConnected: false, tokenHealth: 'unknown',
  });
  const [instagramStatus, setInstagramStatus] = useState<PlatformStatus>({
    platform: 'instagram', isConnected: false, tokenHealth: 'unknown',
  });
  const [youtubeChannel, setYoutubeChannel] = useState<YouTubeChannelDTO | null>(null);
  const [instagramAccount, setInstagramAccount] = useState<InstagramAccountDTO | null>(null);

  // Per-platform daily metrics (real)
  const [dailyMetrics, setDailyMetrics] = useState<TimeSeriesDataPoint[]>([]);
  // The range actually applied to the last fetch — fed to the chart so its x-axis honestly
  // reflects the selected preset even when real data doesn't cover the whole span.
  const [appliedRange, setAppliedRange] = useState<DateRange>(() => buildDateRange('30d', '', ''));

  // Date range selector
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Loading
  const [isLoadingYouTube, setIsLoadingYouTube] = useState(false);
  const [isLoadingInstagram, setIsLoadingInstagram] = useState(false);
  const [isSyncingYouTube, setIsSyncingYouTube] = useState(false);
  const [isSyncingInstagram, setIsSyncingInstagram] = useState(false);

  // Reconnect
  const [showYTReconnect, setShowYTReconnect] = useState(false);
  const [showIGReconnect, setShowIGReconnect] = useState(false);

  // OAuth callback
  useEffect(() => {
    const yt = searchParams.get('youtube');
    const ig = searchParams.get('instagram');
    const reason = searchParams.get('reason');
    if (yt === 'connected') showToast('YouTube connected successfully!', 'success');
    else if (yt === 'error') showToast(`YouTube connection failed: ${reason || 'Unknown error'}`, 'error');
    if (ig === 'connected') showToast('Instagram connected successfully!', 'success');
    else if (ig === 'error') showToast(`Instagram connection failed: ${reason || 'Unknown error'}`, 'error');
  }, [searchParams, showToast]);

  useEffect(() => {
    const unsub = onReconnectRequired((p) => {
      if (p === 'youtube') { setShowYTReconnect(true); setYoutubeStatus(s => ({ ...s, tokenHealth: 'expired', reconnectRequired: true })); }
      if (p === 'instagram') { setShowIGReconnect(true); setInstagramStatus(s => ({ ...s, tokenHealth: 'expired', reconnectRequired: true })); }
    });
    return unsub;
  }, []);

  const fetchStatuses = useCallback(async () => {
    // Fetch YouTube status
    try {
      const ytStatus = await getYouTubeStatus();
      if (ytStatus) {
        // Determine token health and reconnect required status from backend connectionStatus
        const connectionStatus = ytStatus.connectionStatus;
        const needsReconnect = connectionStatus === 'TOKEN_EXPIRED' || connectionStatus === 'ERROR' || ytStatus.actionRequired === 'RECONNECT';
        const tokenHealth = connectionStatus === 'CONNECTED' ? 'healthy' : 
                           connectionStatus === 'TOKEN_EXPIRED' ? 'expired' : 
                           connectionStatus === 'ERROR' ? 'expired' : 'unknown';
        
        setYoutubeStatus({ 
          platform: 'youtube', 
          isConnected: ytStatus.isActive && connectionStatus === 'CONNECTED', 
          accountName: ytStatus.accountName, 
          avatarUrl: ytStatus.accountAvatarUrl, 
          lastSynced: ytStatus.lastSyncedAt, 
          tokenHealth, 
          reconnectRequired: needsReconnect,
          connectionStatus 
        });
        
        if (needsReconnect) {
          setShowYTReconnect(true);
        } else if (ytStatus.isActive && connectionStatus === 'CONNECTED') {
          try { setYoutubeChannel(await getYouTubeChannel()); } catch {}
        }
      } else { 
        setYoutubeStatus({ platform: 'youtube', isConnected: false, tokenHealth: 'unknown' }); 
      }
    } catch { 
      setYoutubeStatus({ platform: 'youtube', isConnected: false, tokenHealth: 'unknown' }); 
    }

    // Fetch Instagram status (now returns ConnectedAccountDTO like YouTube)
    try {
      const igStatus = await getInstagramStatus();
      if (igStatus) { 
        // Determine token health and reconnect required status from backend connectionStatus
        const connectionStatus = igStatus.connectionStatus;
        const needsReconnect = connectionStatus === 'TOKEN_EXPIRED' || connectionStatus === 'ERROR' || igStatus.actionRequired === 'RECONNECT';
        const tokenHealth = connectionStatus === 'CONNECTED' ? 'healthy' : 
                           connectionStatus === 'TOKEN_EXPIRED' ? 'expired' : 
                           connectionStatus === 'ERROR' ? 'expired' : 'unknown';
        
        setInstagramStatus({ 
          platform: 'instagram', 
          isConnected: igStatus.isActive && connectionStatus === 'CONNECTED', 
          accountName: igStatus.accountName, 
          avatarUrl: igStatus.accountAvatarUrl, 
          lastSynced: igStatus.lastSyncedAt,
          tokenHealth,
          reconnectRequired: needsReconnect,
          connectionStatus
        }); 
        
        if (needsReconnect) {
          setShowIGReconnect(true);
        } else if (igStatus.isActive && connectionStatus === 'CONNECTED') {
          // Fetch full Instagram account data for stats
          try { 
            const accountData = await getInstagramAccountData();
            if (accountData) {
              setInstagramAccount(accountData);
            }
          } catch {}
        }
      }
      else { 
        setInstagramStatus({ platform: 'instagram', isConnected: false, tokenHealth: 'unknown' }); 
      }
    } catch { 
      setInstagramStatus({ platform: 'instagram', isConnected: false, tokenHealth: 'unknown' }); 
    }
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  // Fetch real daily metrics — callable from both useEffect and sync handlers
  const fetchDailyMetrics = useCallback(async (preset?: DateRangePreset, cStart?: string, cEnd?: string) => {
    const activePreset = preset ?? datePreset;
    const dateRange: DateRange = buildDateRange(activePreset, cStart ?? customStart, cEnd ?? customEnd);
    setAppliedRange(dateRange);
    try {
      // One call returns both platforms' stored daily snapshots — no per-platform logic here.
      const rows: DailySnapshotDTO[] = await getDailyMetrics(dateRange);
      setDailyMetrics(rows.map(r => ({
        date: r.date,
        platform: r.platform === 'YOUTUBE' ? 'youtube' : 'instagram',
        views: r.views ?? 0,
        followers: r.followersTotal ?? 0,
      })));
    } catch {
      setDailyMetrics([]);
    }
  }, [datePreset, customStart, customEnd]);

  // Paint whatever is already stored as soon as both platform statuses are resolved.
  useEffect(() => {
    const ytDone = youtubeStatus.tokenHealth !== 'unknown';
    const igDone = instagramStatus.tokenHealth !== 'unknown';
    if (!ytDone || !igDone) return;
    fetchDailyMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeStatus.tokenHealth, instagramStatus.tokenHealth]);

  // Switching the date range just re-reads the stored snapshots. The graph shows whatever
  // history has been captured; the chart's own "data available from …" note explains sparse
  // ranges. (First-run capture already back-fills YouTube ~90d and Instagram ~30d.)
  const applyDateRange = useCallback(async (preset: DateRangePreset, cStart?: string, cEnd?: string) => {
    await fetchDailyMetrics(preset, cStart, cEnd);
  }, [fetchDailyMetrics]);

  const isSyncingMetricsRef = useRef(false);
  // Capture today's snapshot server-side (guarded so concurrent callers don't double-sync),
  // then re-read the chart from the DB.
  const refreshChart = useCallback(async () => {
    if (isSyncingMetricsRef.current) { await fetchDailyMetrics(); return; }
    isSyncingMetricsRef.current = true;
    try { await syncMetrics(); } catch { /* keep whatever is stored */ }
    finally { isSyncingMetricsRef.current = false; }
    await fetchDailyMetrics();
  }, [fetchDailyMetrics]);

  // Connect/disconnect/sync handlers (preserved from old HomePage)
  const handleConnectYouTube = async () => {
    setIsLoadingYouTube(true);
    try { const r = await connectYouTube(); window.location.href = r.authorizationUrl; }
    catch (e: any) { showToast(e?.data?.errorCode === 'already_connected' ? 'YouTube is already connected.' : 'Failed to connect YouTube', 'error'); setIsLoadingYouTube(false); fetchStatuses(); }
  };

  const handleConnectInstagram = async () => {
    setIsLoadingInstagram(true);
    try { const r = await connectInstagram(); window.location.href = r.authorizationUrl; }
    catch (e: any) { showToast(e?.data?.errorCode === 'already_connected' ? 'Instagram is already connected.' : 'Failed to connect Instagram', 'error'); setIsLoadingInstagram(false); fetchStatuses(); }
  };

  const handleDisconnectYouTube = async () => {
    try { await disconnectYouTube(); setYoutubeStatus({ platform: 'youtube', isConnected: false, tokenHealth: 'unknown' }); setYoutubeChannel(null); showToast('YouTube disconnected', 'success'); }
    catch (e: any) { showToast(e?.data?.message || 'Failed to disconnect YouTube', 'error'); }
  };

  const handleDisconnectInstagram = async () => {
    try { await disconnectInstagram(); setInstagramStatus({ platform: 'instagram', isConnected: false, tokenHealth: 'unknown' }); setInstagramAccount(null); showToast('Instagram disconnected', 'success'); }
    catch (e: any) { showToast(e?.data?.message || 'Failed to disconnect Instagram', 'error'); }
  };

  // Reconnect handlers for expired tokens
  const handleReconnectYouTube = async () => {
    setIsLoadingYouTube(true);
    try {
      const r = await reconnectYouTube();
      window.location.href = r.authorizationUrl;
    } catch (e: any) {
      showToast(e?.data?.message || 'Failed to initiate YouTube reconnection', 'error');
      setIsLoadingYouTube(false);
    }
  };

  const handleReconnectInstagram = async () => {
    setIsLoadingInstagram(true);
    try {
      const r = await reconnectInstagram();
      window.location.href = r.authorizationUrl;
    } catch (e: any) {
      showToast(e?.data?.message || 'Failed to initiate Instagram reconnection', 'error');
      setIsLoadingInstagram(false);
    }
  };

  const handleSyncYouTube = async () => {
    setIsSyncingYouTube(true);
    try { 
      const ch = await syncYouTubeChannel();
      setYoutubeChannel(ch);
      await refreshChart();
      showToast('YouTube synced', 'success');
    }
    catch (e: any) { 
      // Check if it's a reconnect required error
      if (e?.isReconnectRequired || e?.data?.status === 'RECONNECT_REQUIRED') {
        setShowYTReconnect(true);
        setYoutubeStatus(s => ({ ...s, tokenHealth: 'expired', reconnectRequired: true, connectionStatus: 'TOKEN_EXPIRED' }));
        showToast('YouTube token expired. Please reconnect.', 'warning');
      } else {
        showToast('Failed to sync YouTube', 'error'); 
      }
    }
    finally { setIsSyncingYouTube(false); }
  };

  const handleSyncInstagram = async () => {
    setIsSyncingInstagram(true);
    try { 
      const acc = await syncInstagramAccount();
      setInstagramAccount(acc);
      await refreshChart();
      showToast('Instagram synced', 'success');
    }
    catch (e: any) { 
      // Check if it's a reconnect required error
      if (e?.isReconnectRequired || e?.data?.status === 'RECONNECT_REQUIRED') {
        setShowIGReconnect(true);
        setInstagramStatus(s => ({ ...s, tokenHealth: 'expired', reconnectRequired: true, connectionStatus: 'TOKEN_EXPIRED' }));
        showToast('Instagram token expired. Please reconnect.', 'warning');
      } else {
        showToast('Failed to sync Instagram', 'error'); 
      }
    }
    finally { setIsSyncingInstagram(false); }
  };

  // Auto-sync connected platforms on page load (track per platform)
  const [hasYouTubeSynced, setHasYouTubeSynced] = useState(false);
  const [hasInstagramSynced, setHasInstagramSynced] = useState(false);
  
  // Auto-sync YouTube when status is ready and connected
  useEffect(() => {
    if (hasYouTubeSynced) return;
    
    if (youtubeStatus.isConnected && 
        youtubeStatus.connectionStatus === 'CONNECTED' && 
        !youtubeStatus.reconnectRequired) {
      handleSyncYouTube();
      setHasYouTubeSynced(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeStatus.connectionStatus, youtubeStatus.isConnected, hasYouTubeSynced]);

  // Auto-sync Instagram when status is ready and connected
  useEffect(() => {
    if (hasInstagramSynced) return;
    
    if (instagramStatus.isConnected && 
        instagramStatus.connectionStatus === 'CONNECTED' &&
        !instagramStatus.reconnectRequired) {
      handleSyncInstagram();
      setHasInstagramSynced(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instagramStatus.connectionStatus, instagramStatus.isConnected, hasInstagramSynced]);

  // Build platform list
  const platforms: PlatformDef[] = [
    { id: 'youtube', name: 'YouTube', color: '#FF0000', bgColor: 'rgba(255,0,0,0.08)', icon: platformIcons.youtube, state: youtubeStatus.isConnected ? 'connected' : 'available' },
    { id: 'instagram', name: 'Instagram', color: '#E4405F', bgColor: 'rgba(228,64,95,0.08)', icon: platformIcons.instagram, state: instagramStatus.isConnected ? 'connected' : 'available' },
    { id: 'snapchat', name: 'Snapchat', color: '#FFFC00', bgColor: 'rgba(255,252,0,0.08)', icon: platformIcons.snapchat, state: 'coming-soon' },
    { id: 'x', name: 'X', color: '#000000', bgColor: 'rgba(0,0,0,0.06)', icon: platformIcons.x, state: 'coming-soon' },
    { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', bgColor: 'rgba(10,102,194,0.08)', icon: platformIcons.linkedin, state: 'coming-soon' },
  ];

  const formatLastSynced = (d?: string) => {
    if (!d) return 'Never';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getQuickStats = (id: PlatformId) => {
    if (id === 'youtube' && youtubeChannel) {
      return [
        { label: 'Subscribers', value: youtubeChannel.subscriberCount ?? 0 },
        { label: 'Videos', value: youtubeChannel.videoCount ?? 0 },
        { label: 'Views', value: youtubeChannel.viewCount ?? 0 },
      ];
    }
    if (id === 'instagram' && instagramAccount) {
      return [
        { label: 'Followers', value: instagramAccount.followersCount ?? 0 },
        { label: 'Posts', value: instagramAccount.mediaCount ?? 0 },
      ];
    }
    return [];
  };

  // Chart platform line configs — only show connected platforms
  const chartPlatforms: PlatformLineConfig[] = [];
  if (youtubeStatus.isConnected) chartPlatforms.push({ id: 'youtube', label: 'YouTube', color: '#FF0000' });
  if (instagramStatus.isConnected) chartPlatforms.push({ id: 'instagram', label: 'Instagram', color: 'var(--vx-text)' });
  // Fallback: if nothing connected yet, still show both for demo
  const chartLines = chartPlatforms.length > 0 ? chartPlatforms : [
    { id: 'youtube', label: 'YouTube', color: '#FF0000' },
    { id: 'instagram', label: 'Instagram', color: 'var(--vx-text)' },
  ];

  return (
    <Container className="platforms-page">
      {/* Reconnect Banners */}
      {showYTReconnect && <ReconnectBanner platform="youtube" onReconnect={handleReconnectYouTube} onDismiss={() => setShowYTReconnect(false)} isLoading={isLoadingYouTube} />}
      {showIGReconnect && <ReconnectBanner platform="instagram" onReconnect={handleReconnectInstagram} onDismiss={() => setShowIGReconnect(false)} isLoading={isLoadingInstagram} />}

      <header className="platforms-page__header">
        <h1 className="platforms-page__title">My Platforms</h1>
        <p className="platforms-page__subtitle">Connect and manage your social media platforms</p>
      </header>

      {/* ── SECTION 1: Multi-line Time Series Graph ──
          Gated on having a connected platform, NOT on dailyMetrics.length — otherwise a date
          range that legitimately returns zero rows (e.g. a custom range before any real data)
          would hide the whole section, pills included, making the selector look broken with no
          way back except a reload. The chart itself shows a "no data" message when empty. */}
      {(youtubeStatus.isConnected || instagramStatus.isConnected) && (
        <Section title="Performance Trends" subtitle="Daily metrics across connected platforms">
          <Card variant="default" padding="lg">
            {/* Date range selector */}
            <div className="date-range-selector">
              {/* Desktop: pill buttons */}
              <div className="date-range-selector__pills">
                {DATE_RANGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`date-range-pill${datePreset === opt.value ? ' date-range-pill--active' : ''}`}
                    onClick={() => {
                      setDatePreset(opt.value);
                      if (opt.value === 'custom') {
                        setShowCustomPicker(true);
                      } else {
                        setShowCustomPicker(false);
                        applyDateRange(opt.value);
                      }
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Mobile: custom dropdown (avoids native select positioning bugs) */}
              <div className="date-range-selector__dropdown-wrap">
                {showDropdown && (
                  <div
                    className="date-range-dropdown-overlay"
                    onClick={() => setShowDropdown(false)}
                  />
                )}
                <button
                  className="date-range-selector__dropdown-trigger"
                  onClick={() => setShowDropdown(v => !v)}
                >
                  <span>{DATE_RANGE_OPTIONS.find(o => o.value === datePreset)?.label}</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    style={{ transition: 'transform 0.2s', transform: showDropdown ? 'rotate(180deg)' : 'none' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showDropdown && (
                  <div className="date-range-selector__dropdown-menu">
                    {DATE_RANGE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={`date-range-dropdown-item${datePreset === opt.value ? ' date-range-dropdown-item--active' : ''}`}
                        onClick={() => {
                          setDatePreset(opt.value);
                          setShowDropdown(false);
                          if (opt.value === 'custom') {
                            setShowCustomPicker(true);
                          } else {
                            setShowCustomPicker(false);
                            applyDateRange(opt.value);
                          }
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Custom date picker — shared between desktop & mobile */}
              {showCustomPicker && (
                <div className="date-range-custom">
                  <label className="date-range-custom__label">From</label>
                  <input
                    type="date"
                    className="date-range-custom__input"
                    value={customStart}
                    max={customEnd || new Date().toISOString().split('T')[0]}
                    onChange={e => setCustomStart(e.target.value)}
                  />
                  <label className="date-range-custom__label">To</label>
                  <input
                    type="date"
                    className="date-range-custom__input"
                    value={customEnd}
                    min={customStart}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setCustomEnd(e.target.value)}
                  />
                  <button
                    className="date-range-custom__apply"
                    disabled={!customStart || !customEnd}
                    onClick={() => applyDateRange('custom', customStart, customEnd)}
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
            <TimeSeriesChart
              data={dailyMetrics}
              platforms={chartLines}
              startDate={appliedRange.startDate}
              endDate={appliedRange.endDate}
            />
          </Card>
        </Section>
      )}

      {/* ── SECTION 2: Platform Grid ── */}
      <Section title="Platforms">
        <div className="platforms-grid">
          {platforms.map(p => {
            const isConnected = p.state === 'connected';
            const isComingSoon = p.state === 'coming-soon';
            const stats = getQuickStats(p.id);
            const status = p.id === 'youtube' ? youtubeStatus : p.id === 'instagram' ? instagramStatus : null;
            
            // Determine if reconnection is required (TOKEN_EXPIRED or similar)
            const needsReconnect = status?.reconnectRequired || 
                                   status?.connectionStatus === 'TOKEN_EXPIRED' ||
                                   status?.connectionStatus === 'ERROR';

            return (
              <Card
                key={p.id}
                variant="outlined"
                padding="lg"
                className={`platform-card platform-card--${needsReconnect ? 'reconnect' : p.state}`}
              >
                <div className="platform-card__header">
                  <div className="platform-card__icon" style={{ background: p.bgColor, color: p.color }}>
                    {p.icon}
                  </div>
                  <div className="platform-card__name-row">
                    <h3 className="platform-card__name">{p.name}</h3>
                    {isConnected && !needsReconnect && <Badge variant="success" size="sm">Connected</Badge>}
                    {needsReconnect && <Badge variant="warning" size="sm">Reconnect Required</Badge>}
                    {isComingSoon && <Badge variant="muted" size="sm">Coming Soon</Badge>}
                    {!isConnected && !isComingSoon && !needsReconnect && <Badge variant="default" size="sm">Available</Badge>}
                  </div>
                </div>

                {/* Connected info */}
                {(isConnected || needsReconnect) && status && (
                  <>
                    {needsReconnect && (
                      <div className="platform-card__warning">
                        Your token has expired. Please reconnect to continue syncing.
                      </div>
                    )}
                    {!needsReconnect && (
                      <div className="platform-card__sync-info">
                        Last synced: {formatLastSynced(status.lastSynced)}
                      </div>
                    )}
                    {stats.length > 0 && !needsReconnect && (
                      <div className="platform-card__stats">
                        {stats.map(s => (
                          <div key={s.label} className="platform-card__stat">
                            <span className="platform-card__stat-val">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</span>
                            <span className="platform-card__stat-label">{s.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                <div className="platform-card__actions">
                  {/* TOKEN_EXPIRED or ERROR state - show Reconnect as primary action */}
                  {needsReconnect && p.id === 'youtube' && (
                    <>
                      <Button variant="primary" size="sm" onClick={handleReconnectYouTube} isLoading={isLoadingYouTube} fullWidth>
                        Reconnect YouTube
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleDisconnectYouTube} className="platform-card__disconnect">
                        Disconnect
                      </Button>
                    </>
                  )}
                  {needsReconnect && p.id === 'instagram' && (
                    <>
                      <Button variant="primary" size="sm" onClick={handleReconnectInstagram} isLoading={isLoadingInstagram} fullWidth>
                        Reconnect Instagram
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleDisconnectInstagram} className="platform-card__disconnect">
                        Disconnect
                      </Button>
                    </>
                  )}
                  
                  {/* CONNECTED state - show Sync, Details, Disconnect */}
                  {isConnected && !needsReconnect && p.id === 'youtube' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={handleSyncYouTube} isLoading={isSyncingYouTube}>Sync</Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(buildRoleRoute(activeRole, 'platforms/youtube'))}>Details</Button>
                      <Button variant="ghost" size="sm" onClick={handleDisconnectYouTube} className="platform-card__disconnect">Disconnect</Button>
                    </>
                  )}
                  {isConnected && !needsReconnect && p.id === 'instagram' && (
                    <>
                      <Button variant="secondary" size="sm" onClick={handleSyncInstagram} isLoading={isSyncingInstagram}>Sync</Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(buildRoleRoute(activeRole, 'platforms/instagram'))}>Details</Button>
                      <Button variant="ghost" size="sm" onClick={handleDisconnectInstagram} className="platform-card__disconnect">Disconnect</Button>
                    </>
                  )}
                  
                  {/* DISCONNECTED state - show Connect */}
                  {!isConnected && !isComingSoon && !needsReconnect && p.id === 'youtube' && (
                    <Button variant="primary" size="sm" onClick={handleConnectYouTube} isLoading={isLoadingYouTube} fullWidth>Connect YouTube</Button>
                  )}
                  {!isConnected && !isComingSoon && !needsReconnect && p.id === 'instagram' && (
                    <Button variant="primary" size="sm" onClick={handleConnectInstagram} isLoading={isLoadingInstagram} fullWidth>Connect Instagram</Button>
                  )}
                  
                  {/* Coming soon platforms */}
                  {isComingSoon && (
                    <Button variant="secondary" size="sm" disabled fullWidth>Coming Soon</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
    </Container>
  );
};

export default MyPlatformsPage;
