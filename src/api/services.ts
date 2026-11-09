import {
  GoogleAuthResponse,
  PlatformConnectResponse,
  ConnectedAccountDTO,
  YouTubeChannelDTO,
  YouTubeVideoDTO,
  ChannelAnalyticsSummaryDTO,
  VideoDailyMetricsDTO,
  InstagramAccountDTO,
  DailySnapshotDTO,
  SyncResult,
  DateRange,
  PlatformSyncResult,
  AutomationConnectionDTO,
  AutomationDTO,
  AutomationRequest,
  AutomationStats,
  MediaPage,
  MediaItem,
  InstagramDashboard,
  YouTubeDashboard,
} from './types';
import api, { ApiError, adoptAccessToken } from './api';

export { api, ApiError };

// ==================== Google OAuth Authentication ====================

export async function authenticateWithGoogle(idToken: string, columns?: Record<string, any>): Promise<GoogleAuthResponse> {
  return api.post<GoogleAuthResponse>('/auth/google', { idToken, columns });
}

export async function refreshToken(): Promise<{ accessToken: string; refreshToken: string }> {
  return api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh');
}

export async function logout(): Promise<void> {
  return api.post<void>('/auth/logout');
}

/**
 * Lightweight liveness probe — confirm the current access token is valid.
 * fetchApi will auto-refresh via the HttpOnly cookie if the token is expired.
 */
export async function me(): Promise<{ email: string }> {
  return api.get<{ email: string }>('/auth/me');
}

// ==================== Role setup ====================

/**
 * Save the influencer setup wizard. Persists niche/goal/etc. and flips the
 * INFLUENCER role to ACTIVE (unlocking the app). Replaces the AI onboarding.
 */
export async function completeInfluencerSetup(request: InfluencerSetupRequest): Promise<void> {
  await api.post<void>('/influencer/setup', request);
}

// ==================== YouTube OAuth ====================

export async function connectYouTube(): Promise<PlatformConnectResponse> {
  return api.get<PlatformConnectResponse>('/auth/youtube/connect');
}

export async function disconnectYouTube(): Promise<void> {
  return api.delete<void>('/auth/youtube/disconnect');
}

export async function reconnectYouTube(): Promise<PlatformConnectResponse> {
  return api.post<PlatformConnectResponse>('/auth/youtube/reconnect');
}

export async function getYouTubeStatus(): Promise<ConnectedAccountDTO | null> {
  return api.get<ConnectedAccountDTO | null>('/auth/youtube/status');
}

// ==================== Instagram (Instagram-Login connection) ====================
// Instagram now uses the single Instagram-Login connection (also powering automations).
// These keep their old names/shapes so the platform UI needs no rewrite — they adapt the
// AutomationConnectionDTO returned by /automation/instagram/*.

export async function connectInstagram(): Promise<PlatformConnectResponse> {
  // returnTo=platforms so the OAuth callback lands back on My Platforms, not Automations.
  return api.get<PlatformConnectResponse>('/automation/instagram/connect?returnTo=platforms');
}

export async function disconnectInstagram(): Promise<void> {
  return api.delete<void>('/automation/instagram/disconnect');
}

/** Instagram-Login has no distinct reconnect — re-run the connect flow. */
export async function reconnectInstagram(): Promise<PlatformConnectResponse> {
  return api.get<PlatformConnectResponse>('/automation/instagram/connect?returnTo=platforms');
}

/** Connection status, adapted to the ConnectedAccountDTO shape the platform list expects. */
export async function getInstagramStatus(): Promise<ConnectedAccountDTO | null> {
  const c = await api.get<AutomationConnectionDTO | null>('/automation/instagram/status');
  if (!c) return null;
  return {
    platform: 'INSTAGRAM',
    externalAccountId: c.igUserId,
    accountName: c.username,
    accountAvatarUrl: c.accountAvatarUrl,
    connectedAt: c.connectedAt,
    lastSyncedAt: c.lastRefreshedAt ?? c.connectedAt,
    isActive: c.active,
    scopes: c.scopes,
    connectionStatus: (c.active ? 'CONNECTED' : c.status) as any,
  } as ConnectedAccountDTO;
}

/** Account profile/stats, adapted from the Instagram-Login connection. */
export async function getInstagramAccountData(): Promise<InstagramAccountDTO | null> {
  const c = await api.get<AutomationConnectionDTO | null>('/automation/instagram/status');
  if (!c) return null;
  return {
    instagramBusinessId: c.igUserId,
    username: c.username,
    name: c.username,
    profilePictureUrl: c.accountAvatarUrl,
    followersCount: c.followersCount ?? 0,
    followsCount: 0,
    mediaCount: c.mediaCount ?? 0,
  } as InstagramAccountDTO;
}

// ==================== All Connected Accounts ====================

export async function getAllConnections(): Promise<ConnectedAccountDTO[]> {
  return api.get<ConnectedAccountDTO[]>('/auth/connections');
}

// ==================== YouTube Channel & Videos ====================

export async function getYouTubeChannel(): Promise<YouTubeChannelDTO | null> {
  return api.get<YouTubeChannelDTO | null>('/youtube/channel');
}

export async function syncYouTubeChannel(): Promise<YouTubeChannelDTO> {
  return api.post<YouTubeChannelDTO>('/youtube/channel/sync');
}

export async function getYouTubeVideos(limit = 50): Promise<YouTubeVideoDTO[]> {
  return api.get<YouTubeVideoDTO[]>(`/youtube/videos?limit=${limit}`);
}

export async function getYouTubeVideo(videoId: string): Promise<YouTubeVideoDTO> {
  return api.get<YouTubeVideoDTO>(`/youtube/videos/${videoId}`);
}

export async function syncYouTubeVideos(maxVideos?: number): Promise<SyncResult> {
  const params = maxVideos ? `?maxVideos=${maxVideos}` : '';
  return api.post<SyncResult>(`/youtube/videos/sync${params}`);
}

// ==================== YouTube Analytics ====================

export async function getYouTubeChannelAnalytics(dateRange: DateRange): Promise<ChannelAnalyticsSummaryDTO> {
  return api.get<ChannelAnalyticsSummaryDTO>(
    `/youtube/analytics/channel?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
  );
}

export async function getYouTubeVideoAnalytics(videoId: string, dateRange: DateRange): Promise<VideoDailyMetricsDTO[]> {
  return api.get<VideoDailyMetricsDTO[]>(
    `/youtube/analytics/video/${videoId}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
  );
}

export async function ingestYouTubeVideoAnalytics(dateRange: DateRange): Promise<SyncResult> {
  return api.post<SyncResult>(
    `/youtube/analytics/videos/ingest?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
  );
}

// ==================== Instagram Account ====================

/** Re-fetch the Instagram profile (follower/post counts) and return the updated account. */
export async function syncInstagramAccount(): Promise<InstagramAccountDTO> {
  const c = await api.post<AutomationConnectionDTO>('/automation/instagram/refresh');
  return {
    instagramBusinessId: c.igUserId,
    username: c.username,
    name: c.username,
    profilePictureUrl: c.accountAvatarUrl,
    followersCount: c.followersCount ?? 0,
    followsCount: 0,
    mediaCount: c.mediaCount ?? 0,
  } as InstagramAccountDTO;
}

// ==================== Performance Trends Metrics ====================

/** Read stored daily snapshots (both platforms) for the graph — no external API calls. */
export async function getDailyMetrics(dateRange: DateRange): Promise<DailySnapshotDTO[]> {
  return api.get<DailySnapshotDTO[]>(
    `/metrics/daily?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
  );
}

/** Capture today's snapshot for all connected platforms (idempotent; back-fills on first run). */
export async function syncMetrics(): Promise<{ daysWritten: number }> {
  return api.post<{ daysWritten: number }>('/metrics/sync');
}

// Instagram analytics now lives in the dashboard endpoint (getInstagramDashboard); the old
// per-metric/media insight endpoints were removed with the Facebook-Login analytics.

// ==================== Sync All Platforms ====================

/**
 * Sync all connected platforms using the unified endpoint.
 * Returns structured results for each platform.
 */
export async function syncAllPlatformsUnified(): Promise<PlatformSyncResult[]> {
  return api.post<PlatformSyncResult[]>('/platform/sync-all');
}

/**
 * Sync a specific platform using the unified endpoint.
 */
export async function syncPlatformUnified(platform: 'youtube' | 'instagram'): Promise<PlatformSyncResult> {
  return api.post<PlatformSyncResult>(`/platform/${platform}/sync`);
}

/**
 * Legacy sync all platforms function.
 * @deprecated Use syncAllPlatformsUnified for better error handling
 */
export async function syncAllPlatforms(): Promise<{
  youtube: { channel: boolean; videos: boolean; analytics: boolean };
  instagram: { account: boolean; insights: boolean; media: boolean };
}> {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const dateRange: DateRange = {
    startDate: thirtyDaysAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  };

  const results = {
    youtube: { channel: false, videos: false, analytics: false },
    instagram: { account: false, insights: false, media: false },
  };

  // Sync YouTube
  try {
    await syncYouTubeChannel();
    results.youtube.channel = true;
  } catch (e) { console.warn('YouTube channel sync failed', e); }

  try {
    await syncYouTubeVideos();
    results.youtube.videos = true;
  } catch (e) { console.warn('YouTube videos sync failed', e); }

  try {
    // Captures today's daily snapshot (views + follower totals) for ALL connected platforms.
    await syncMetrics();
    results.youtube.analytics = true;
  } catch (e) { console.warn('Metrics sync failed', e); }

  // Sync Instagram
  try {
    await syncInstagramAccount();
    results.instagram.account = true;
  } catch (e) { console.warn('Instagram account sync failed', e); }

  try {
    // Daily snapshots were captured above by syncMetrics(); confirm they are readable.
    await getDailyMetrics(dateRange);
    results.instagram.insights = true;
    results.instagram.media = true;
  } catch (e) { console.warn('Instagram insights read failed', e); }

  return results;
}

// ==================== Account Management ====================

/**
 * Permanently delete the authenticated user's account and all associated data.
 * The server responds with 204 No Content on success and clears the refreshToken cookie.
 * After calling this, the client must clear all local state and redirect to the landing page.
 */
export async function deleteAccount(): Promise<void> {
  return api.delete<void>('/account');
}

// ==================== Multi-Auth Services ====================

import type {
  AuthResponse,
  UserMeResponse,
  EmailSignupRequest,
  EmailSignupResponse,
  EmailLoginRequest,
  EmailOtpVerifyRequest,
  EmailOtpResendRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  SetPasswordRequest,
  UserRoleDto,
  SwitchRoleRequest,
  SwitchRoleResponse,
  AddRoleRequest,
  FreelancerProfileRequest,
  FreelancerProfileResponse,
  FreelancerPublicProfile,
  FreelancerAppearanceRequest,
  LinkPreview,
  BrandProfileRequest,
  InfluencerSetupRequest,
  BrandProfileResponse,
  FreelancerSearchResult,
  FreelancerSearchFilters,
  FreelancerStats,
  InfluencerSearchResult,
  WaitlistRole,
  AdminWaitlistResponse,
  InviteOutcome,
  AdminAccount,
  InviteInfo,
} from './types';

/**
 * Get current user profile with roles
 * Returns extended user info including roles, isNewUser, verification status
 */
export async function getCurrentUser(): Promise<UserMeResponse> {
  return api.get<UserMeResponse>('/auth/me');
}

/**
 * Email signup - creates new user and sends OTP for verification
 */
export async function signupWithEmail(request: EmailSignupRequest): Promise<EmailSignupResponse> {
  return api.post<EmailSignupResponse>('/auth/signup', request);
}

/**
 * Verify email OTP and complete signup - returns tokens on success
 */
export async function verifyEmailOtp(request: EmailOtpVerifyRequest): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/email/verify-otp', request);
}

/**
 * Resend email OTP
 */
export async function resendEmailOtp(request: EmailOtpResendRequest): Promise<EmailSignupResponse> {
  return api.post<EmailSignupResponse>('/auth/email/resend-otp', request);
}

/**
 * Email login - authenticates existing user
 */
export async function loginWithEmail(request: EmailLoginRequest): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', request);
}

/**
 * Forgot password - sends a reset code to the email.
 * Always resolves (never reveals whether the account exists).
 */
export async function requestPasswordReset(request: ForgotPasswordRequest): Promise<EmailSignupResponse> {
  return api.post<EmailSignupResponse>('/auth/password/forgot', request);
}

/**
 * Reset password using the emailed code. Revokes existing sessions on success.
 */
export async function resetPassword(request: ResetPasswordRequest): Promise<void> {
  await api.post<void>('/auth/password/reset', request);
}

/**
 * Add or change the password for the authenticated user.
 * currentPassword is only required when the account already has a password set.
 */
export async function setPassword(request: SetPasswordRequest): Promise<void> {
  await api.patch<void>('/auth/password', request);
}

// ==================== Role Management Services ====================

/**
 * Get current user's roles
 */
export async function getUserRoles(): Promise<UserRoleDto[]> {
  return api.get<UserRoleDto[]>('/user/roles');
}

/**
 * Add a role to current user
 * Creates the role with INCOMPLETE status, or returns existing if already assigned
 */
export async function addRole(request: AddRoleRequest): Promise<UserRoleDto> {
  return api.post<UserRoleDto>('/user/roles', request);
}

/**
 * Switch active role for current user
 * Updates the user's active role and returns updated role information
 */
/**
 * Switch the active role, and **adopt the new access token it returns**.
 *
 * The adoption happens here rather than at the call sites because both existing callers
 * (`switchActiveRole` and `addNewRole` in UserContext) ignored it. That did not matter against Spring,
 * which never checked roles. The new API does: role-gated endpoints read `activeRole` from the token,
 * so keeping the old token meant a brand-new user who had just picked "Influencer" got **403 on their
 * own creator profile** until the token expired, up to 15 minutes later. Verified on a scratch
 * database: 403 with the kept token, 200 with the returned one.
 */
export async function switchRole(request: SwitchRoleRequest): Promise<SwitchRoleResponse> {
  const response = await api.post<SwitchRoleResponse>('/user/roles/switch', request);
  if (response.accessToken) adoptAccessToken(response.accessToken);
  return response;
}

/**
 * Get the current user's active role status (INCOMPLETE/ACTIVE)
 * Quick check for feature access control
 */
export async function getActiveRoleStatus(): Promise<UserRoleDto | null> {
  return api.get<UserRoleDto | null>('/user/role-status');
}

/**
 * Get current user's full profile including active role
 * Use this for role-aware navigation
 */
export async function getUserProfile(): Promise<UserMeResponse> {
  return api.get<UserMeResponse>('/user/me');
}

/**
 * Update the current user's editable profile fields (currently the display name).
 * Persists to the backend so the change survives refresh and shows on the navbar,
 * account page, and the freelancer's public profile.
 */
export async function updateMyProfile(name: string): Promise<UserMeResponse> {
  return api.patch<UserMeResponse>('/user/me', { name });
}

// ==================== Freelancer Profile ====================

/**
 * Get the current user's freelancer profile
 */
export async function getFreelancerProfile(): Promise<FreelancerProfileResponse> {
  return api.get<FreelancerProfileResponse>('/freelancer/profile');
}

/**
 * Create or update the current user's freelancer profile
 * Also validates and updates role status (INCOMPLETE/ACTIVE)
 */
export async function saveFreelancerProfile(request: FreelancerProfileRequest): Promise<FreelancerProfileResponse> {
  return api.post<FreelancerProfileResponse>('/freelancer/profile', request);
}

/**
 * Persist the freelancer's chosen template + cover so the look is shareable across
 * devices/visitors. Partial: omit fields you don't want to change (the templates
 * page sends only the template; the edit dialog sends only the cover).
 */
export async function saveAppearance(request: FreelancerAppearanceRequest): Promise<FreelancerProfileResponse> {
  return api.patch<FreelancerProfileResponse>('/freelancer/profile/appearance', request);
}

/**
 * Public freelancer profile by slug. Works without auth (returns a gated
 * teaser with limited=true); signed-in viewers get the full profile.
 */
export async function getPublicFreelancerProfile(slug: string): Promise<FreelancerPublicProfile> {
  return api.get<FreelancerPublicProfile>(`/freelancers/${encodeURIComponent(slug)}`);
}

/**
 * Open Graph metadata for a URL (link previews). Authenticated — the server
 * fetches the URL on our behalf, so it is not an open SSRF probe.
 */
export async function getLinkPreview(url: string): Promise<LinkPreview> {
  return api.get<LinkPreview>(`/link-preview?url=${encodeURIComponent(url)}`);
}

// ==================== Brand Profile ====================

/**
 * Get the current user's brand profile
 */
export async function getBrandProfile(): Promise<BrandProfileResponse> {
  return api.get<BrandProfileResponse>('/brand/profile');
}

/**
 * Create or update the current user's brand profile
 * Also validates and updates role status (INCOMPLETE/ACTIVE)
 */
export async function saveBrandProfile(request: BrandProfileRequest): Promise<BrandProfileResponse> {
  return api.post<BrandProfileResponse>('/brand/profile', request);
}

// ==================== Search / Discovery ====================

/**
 * The freelancer directory. Passing no filters returns suggestions
 * (strongest profiles first) rather than an empty list.
 */
export async function searchFreelancers(
  filters: FreelancerSearchFilters = {}
): Promise<FreelancerSearchResult[]> {
  const params = new URLSearchParams();

  if (filters.keyword?.trim()) params.append('keyword', filters.keyword.trim());
  if (filters.location?.trim()) params.append('location', filters.location.trim());
  if (filters.availability) params.append('availability', filters.availability);
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.maxRate != null && filters.rateCurrency) {
    params.append('maxRate', String(filters.maxRate));
    params.append('rateCurrency', filters.rateCurrency);
  }
  // Repeated params (?skills=a&skills=b) — Spring binds these to List<String>
  filters.skills?.forEach(s => params.append('skills', s));
  filters.tools?.forEach(t => params.append('tools', t));
  filters.languages?.forEach(l => params.append('languages', l));

  const qs = params.toString();
  return api.get<FreelancerSearchResult[]>(`/freelancer/search${qs ? `?${qs}` : ''}`);
}

/**
 * How many freelancers are listed vs. exist in total. Cheap (two COUNTs).
 */
export async function getFreelancerStats(): Promise<FreelancerStats> {
  return api.get<FreelancerStats>('/freelancer/stats');
}

/**
 * Search active influencers by keyword and/or niche
 */
export async function searchInfluencers(keyword?: string, niche?: string): Promise<InfluencerSearchResult[]> {
  const params = new URLSearchParams();
  if (keyword) params.append('keyword', keyword);
  if (niche) params.append('niche', niche);
  const qs = params.toString();
  return api.get<InfluencerSearchResult[]>(`/influencer/search${qs ? `?${qs}` : ''}`);
}

// ==================== Instagram Automations (Creator Tools) ====================

/** Status of the Instagram-Login connection used for automations (null if none). */
export async function getAutomationConnection(): Promise<AutomationConnectionDTO | null> {
  return api.get<AutomationConnectionDTO | null>('/automation/instagram/status');
}

/** Begin the Instagram-Login connect flow (returns the URL to redirect to). */
export async function connectAutomationInstagram(): Promise<PlatformConnectResponse> {
  return api.get<PlatformConnectResponse>('/automation/instagram/connect');
}

export async function disconnectAutomationInstagram(): Promise<void> {
  return api.delete<void>('/automation/instagram/disconnect');
}

export async function listAutomations(): Promise<AutomationDTO[]> {
  return api.get<AutomationDTO[]>('/automation/instagram/automations');
}

export async function getAutomation(id: string): Promise<AutomationDTO> {
  return api.get<AutomationDTO>(`/automation/instagram/automations/${id}`);
}

export async function createAutomation(req: AutomationRequest): Promise<AutomationDTO> {
  return api.post<AutomationDTO>('/automation/instagram/automations', req);
}

export async function updateAutomation(id: string, req: AutomationRequest): Promise<AutomationDTO> {
  return api.put<AutomationDTO>(`/automation/instagram/automations/${id}`, req);
}

export async function setAutomationEnabled(id: string, enabled: boolean): Promise<AutomationDTO> {
  return api.patch<AutomationDTO>(`/automation/instagram/automations/${id}/enabled`, { enabled });
}

export async function deleteAutomation(id: string): Promise<void> {
  return api.delete<void>(`/automation/instagram/automations/${id}`);
}

export async function getAutomationStats(id: string): Promise<AutomationStats> {
  return api.get<AutomationStats>(`/automation/instagram/automations/${id}/stats`);
}

/** One page of the account's media for the target picker. */
export async function fetchAutomationMedia(after?: string): Promise<MediaPage> {
  const qs = after ? `?after=${encodeURIComponent(after)}` : '';
  return api.get<MediaPage>(`/automation/instagram/media${qs}`);
}

/** Resolve a pasted post/reel link to a media item. */
export async function resolveMediaLink(url: string): Promise<MediaItem> {
  return api.post<MediaItem>('/automation/instagram/media/resolve', { url });
}

// ==================== Instagram Analytics Dashboard (Instagram-Login insights) ====================

/** Full Instagram analytics dashboard for the platform detail page (range = 7 | 30 | 90 days). */
export async function getInstagramDashboard(range: 7 | 30 | 90 = 30): Promise<InstagramDashboard> {
  return api.get<InstagramDashboard>(`/instagram/dashboard?range=${range}`);
}

// ==================== YouTube Analytics Dashboard (composed) ====================

/** Full YouTube analytics dashboard for the platform detail page (range = 7 | 30 | 90 days). */
export async function getYouTubeDashboard(range: 7 | 30 | 90 = 30): Promise<YouTubeDashboard> {
  return api.get<YouTubeDashboard>(`/youtube/dashboard?range=${range}`);
}

// ==================== Waitlist / Admin ====================

/** Public: join the waitlist from the landing page. */
export async function joinWaitlist(request: {
  email: string;
  role: WaitlistRole;
  source?: string;
}): Promise<{ joined: boolean }> {
  return api.post<{ joined: boolean }>('/waitlist', request);
}

/** Public: who an invite link is for, or an ApiError with `invite_invalid|expired|used`. */
export async function lookupInvite(token: string): Promise<InviteInfo> {
  return api.get<InviteInfo>(`/invites/${encodeURIComponent(token)}`);
}

/** Public: create an account from an invite link — signs them straight in. */
export async function signupWithInvite(request: {
  token: string;
  name: string;
  password: string;
}): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/signup/invite', request);
}

/** Admin: every waitlist entry with counts. */
export async function getAdminWaitlist(): Promise<AdminWaitlistResponse> {
  return api.get<AdminWaitlistResponse>('/admin/waitlist');
}

/** Admin: approve (emails an invite / "you're back in") or move back to pending. */
export async function approveWaitlistEntry(id: number): Promise<InviteOutcome> {
  return api.patch<InviteOutcome>(`/admin/waitlist/${id}`, { status: 'APPROVED' });
}

export async function revokeWaitlistEntry(id: number): Promise<void> {
  await api.patch(`/admin/waitlist/${id}`, { status: 'PENDING' });
}

/** Admin: a fresh invite link — emailed (`send`) or only returned to copy. Replaces the old link. */
export async function reissueInvite(id: number, send: boolean): Promise<InviteOutcome> {
  return api.post<InviteOutcome>(`/admin/waitlist/${id}/invite`, { send });
}

/** Admin: existing accounts and whether each may get in. */
export async function getAdminAccounts(): Promise<AdminAccount[]> {
  return api.get<AdminAccount[]>('/admin/accounts');
}

/** Admin: let an existing account in (emails "you're back in") or block it. */
export async function setAccountAccess(userId: number, allow: boolean): Promise<InviteOutcome | { kind: 'blocked' }> {
  return api.patch<InviteOutcome | { kind: 'blocked' }>(`/admin/accounts/${userId}`, { allow });
}
