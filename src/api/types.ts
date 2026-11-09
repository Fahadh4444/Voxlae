export enum ResponseStatus {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  RECONNECT_REQUIRED = 'RECONNECT_REQUIRED'
}

export interface ApiResponse<T = any> {
  status: ResponseStatus;
  data?: T;
  message?: string;
  error?: string;
}

export interface GoogleAuthResponse {
  accessToken: string;
  refreshToken: string;
  requiresOnboarding: boolean;
  name: string;
  email: string;
  isNewUser?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  requiresEmailVerification?: boolean;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// ==================== Platform Connection Types ====================

export type Platform = 'youtube' | 'instagram';

/**
 * Explicit connection status for platform accounts.
 * Matches backend PlatformConnectionStatus enum.
 */
export type PlatformConnectionStatus = 
  | 'CONNECTED' 
  | 'TOKEN_EXPIRED' 
  | 'DISCONNECTED' 
  | 'ERROR';

export interface ConnectedAccountDTO {
  platform: string;
  externalAccountId: string;
  accountName: string;
  accountAvatarUrl?: string;
  connectedAt: string;
  lastSyncedAt?: string;
  isActive: boolean;
  scopes: string[];
  /** Explicit connection status from backend */
  connectionStatus?: PlatformConnectionStatus;
  /** Action required from user (e.g., 'RECONNECT') */
  actionRequired?: string;
}

export interface PlatformConnectResponse {
  authorizationUrl: string;
  message: string;
}

// ==================== YouTube Types ====================

export interface YouTubeChannelDTO {
  channelId: string;
  title: string;
  description?: string;
  customUrl?: string;
  country?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  subscriberCount?: number;
  videoCount?: number;
  viewCount?: number;
  connectedAt?: string;
  lastSyncedAt?: string;
  isConnected?: boolean;
}

export interface YouTubeVideoDTO {
  videoId: string;
  channelId: string;
  title: string;
  description?: string;
  duration?: string;
  durationSeconds?: number;
  publishedAt?: string;
  thumbnailUrl?: string;
  privacyStatus?: string;
  categoryId?: string;
}

/** One day of one platform's data for the Performance Trends graph (GET /api/metrics/daily). */
export interface DailySnapshotDTO {
  date: string;                    // YYYY-MM-DD
  platform: string;                // 'YOUTUBE' | 'INSTAGRAM'
  followersTotal: number | null;   // total followers/subscribers that day; null = no data
  views: number | null;            // views that day
}

export interface ChannelAnalyticsSummaryDTO {
  channelId: string;
  channelTitle: string;
  totalViews: number;
  totalWatchTimeMinutes: number;
  netSubscribers: number;
  totalComments: number;
  viewsChangePercent?: number;
  subscribersChangePercent?: number;
}

export interface VideoDailyMetricsDTO {
  videoId: string;
  date: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration?: number;
  averageViewPercentage?: number;
  comments?: number;
  shares?: number;
  engagementRate?: number;
}

// ==================== Instagram Types ====================

export interface InstagramAccountDTO {
  instagramBusinessId: string;
  username: string;
  name?: string;
  biography?: string;
  profilePictureUrl?: string;
  website?: string;
  category?: string;
  followersCount?: number;
  followsCount?: number;
  mediaCount?: number;
  facebookPageId?: string;
  facebookPageName?: string;
}

export interface InstagramAccountTotalMetricsDTO {
  recordedAt: string;
  profileViews?: number;
  accountsEngaged?: number;
  totalInteractions?: number;
  contentViews?: number;
}

export interface InstagramAnalyticsSummaryDTO {
  instagramBusinessId: string;
  username: string;
  startDate: string;
  endDate: string;
  totalImpressions: number;
  totalReach: number;
  profileViews?: number;
  accountsEngaged?: number;
  totalInteractions?: number;
  contentViews?: number;
  followersDelta?: number;
  mediaCount?: number;
}

export interface InstagramMediaDTO {
  mediaId: string;
  mediaType: string;
  caption?: string;
  permalink?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  timestamp?: string;
  shortcode?: string;
  commentsCount?: number;
}

export interface InstagramMediaMetricsDTO {
  mediaId: string;
  recordedAt: string;
  impressions?: number;
  reach?: number;
  engagement?: number;
  saved?: number;
  plays?: number;
}

// ==================== Sync Result ====================

export interface SyncResult {
  count: number;
  message: string;
}

// ==================== Dashboard Combined Types ====================

export interface PlatformStatus {
  platform: Platform;
  isConnected: boolean;
  accountName?: string;
  avatarUrl?: string;
  lastSynced?: string;
  tokenHealth: 'healthy' | 'expiring' | 'expired' | 'unknown';
  reconnectRequired?: boolean;
  /** Explicit connection status from backend */
  connectionStatus?: PlatformConnectionStatus;
}

/**
 * Response from platform sync operations.
 * Provides structured error information.
 */
export interface PlatformSyncResult {
  success: boolean;
  platform: string;
  connectionStatus?: PlatformConnectionStatus;
  error?: string;
  message?: string;
  actionRequired?: string;
  syncedCount?: number;
}

export interface DashboardKPI {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: string;
  color: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

// ==================== User Plan Types ====================

export type PlanType = 'free' | 'pro' | 'enterprise';

export interface UserPlan {
  type: PlanType;
  apiUsage: number;
  apiLimit: number;
  features: string[];
}

// ==================== Setup Checklist Types ====================

/** Identifier for a platform card (used by My Platforms). */
export type PlatformId = 'youtube' | 'instagram' | 'snapchat' | 'x' | 'linkedin';

// ==================== Multi-Auth Types ====================

/**
 * Role enum matching backend
 */
export enum Role {
  INFLUENCER = 'INFLUENCER',
  FREELANCER = 'FREELANCER',
  BRAND = 'BRAND',
  ADMIN = 'ADMIN',
}

/**
 * Verification status for roles
 */
export enum VerificationStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

/**
 * Role status - tracks whether role setup is complete
 */
export enum RoleStatus {
  INCOMPLETE = 'INCOMPLETE',
  ACTIVE = 'ACTIVE',
}

/**
 * User role with status and verification status
 */
export interface UserRoleDto {
  role: Role;
  status: RoleStatus;
  verificationStatus: VerificationStatus;
}

/**
 * Extended auth response from all auth endpoints
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  requiresOnboarding: boolean;
  name: string;
  email: string;
  isNewUser?: boolean;
  emailVerified?: boolean;
  activeRole?: Role;
  roles?: UserRoleDto[];
}

/**
 * Extended /auth/me response with roles
 */
export interface UserMeResponse {
  userId?: number;
  email: string;
  name?: string;
  roles: UserRoleDto[];
  activeRole: Role | null;
  isNewUser: boolean;
  emailVerified: boolean;
  onboardingCompleted: boolean;
  /** Public profile id for freelancers — their page is /freelancer/{slug}. */
  freelancerSlug?: string | null;
  /** Whether the account has a password set (false for Google-only accounts). */
  hasPassword?: boolean;
  /** Admin (server-decided from ADMIN_EMAILS). Only decides what the UI shows; admin APIs re-check. */
  isAdmin?: boolean;
}

/**
 * Email signup request
 */
export interface EmailSignupRequest {
  email: string;
  password: string;
  name: string;
}

/**
 * Email login request
 */
export interface EmailLoginRequest {
  email: string;
  password: string;
}

/** Request body for POST /auth/password/forgot */
export interface ForgotPasswordRequest {
  email: string;
}

/** Request body for POST /auth/password/reset */
export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

/**
 * Request body for PATCH /auth/password.
 * currentPassword is only required when the account already has a password set.
 */
export interface SetPasswordRequest {
  currentPassword?: string;
  newPassword: string;
}

/**
 * Email signup response (before OTP verification)
 */
export interface EmailSignupResponse {
  message: string;
  email: string;
  requiresEmailVerification: boolean;
  devOtp?: string; // Only in dev mode
}

/**
 * Email OTP verification request
 */
export interface EmailOtpVerifyRequest {
  email: string;
  otp: string;
}

/**
 * Email OTP resend request
 */
export interface EmailOtpResendRequest {
  email: string;
}

/**\n * Switch role request\n */
export interface SwitchRoleRequest {
  role: Role;
}

/**
 * Switch role response
 */
export interface SwitchRoleResponse {
  success: boolean;
  message: string;
  activeRole: Role;
  previousRole?: Role;
  /**
   * A fresh access token carrying the new `activeRole`. Must be adopted — see `switchRole()`. The
   * rotated refresh token also comes back, but the HttpOnly cookie is what the client actually uses.
   */
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Add role request (multi-role support)
 */
export interface AddRoleRequest {
  role: Role;
}

// ==================== Freelancer Profile Types ====================

/**
 * Request for creating/updating freelancer profile
 */
/** Open Graph metadata for a URL (GET /link-preview). */
export interface LinkPreview {
  url?: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
}

/** A structured portfolio project on a freelancer profile. */
export interface PortfolioItem {
  title: string;
  outcome?: string;
  role?: string;
  projectUrl?: string;
  thumbnailUrl?: string;
  /** Cached link metadata, resolved when the URL was pasted. */
  previewTitle?: string | null;
  previewDescription?: string | null;
  previewSite?: string | null;
}

/** A role/position entry on a freelancer profile. */
export interface ExperienceEntry {
  title: string;
  organization?: string;
  startDate?: string; // ISO date (yyyy-MM-dd)
  endDate?: string;   // null/undefined = current position
  description?: string;
}

export type FreelancerAvailability = 'AVAILABLE' | 'OPEN_TO_OFFERS' | 'BOOKED';
export type RateUnit = 'HOUR' | 'DAY' | 'PROJECT';

/**
 * The artistic layout a freelancer picks for their public profile.
 * CLASSIC is the professional default; the rest are expressive, portfolio-first looks.
 */
export type ProfileTemplateId =
  | 'CLASSIC'
  | 'GALLERY'
  | 'EDITORIAL'
  | 'SPOTLIGHT'
  | 'STUDIO'
  | 'INDEX'
  | 'TERMINAL'
  | 'BRUTALIST'
  | 'BENTO';

export interface FreelancerProfileRequest {
  bio: string;
  skills: string[];
  languages?: string[];
  tools?: string[];
  portfolioItems: PortfolioItem[];
  experienceEntries: ExperienceEntry[];
  experience: string;
  headline?: string;
  avatarUrl?: string;
  location?: string;
  availability?: FreelancerAvailability;
  rateAmount?: number | null;
  rateCurrency?: string | null;
  rateUnit?: RateUnit | null;
  /** Chosen artistic layout (defaults to CLASSIC when absent). */
  profileTemplate?: ProfileTemplateId;
  /** Optional hero/cover background image URL used by the templates. */
  coverImageUrl?: string;
}

/**
 * Response from freelancer profile endpoints
 */
export interface FreelancerProfileResponse {
  id?: number;
  bio: string;
  skills: string[];
  languages: string[];
  tools: string[];
  portfolioItems: PortfolioItem[];
  experienceEntries: ExperienceEntry[];
  experience: string;
  headline?: string;
  avatarUrl?: string;
  location?: string;
  availability?: FreelancerAvailability;
  rateAmount?: number | null;
  rateCurrency?: string | null;
  rateUnit?: RateUnit | null;
  profileSlug?: string;
  profileTemplate?: ProfileTemplateId;
  coverImageUrl?: string;
  coverHiddenOn?: ProfileTemplateId[];
  isComplete: boolean;
  roleStatus: RoleStatus;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Public freelancer profile (GET /freelancers/{slug}).
 * limited=true → anonymous teaser: truncated bio, first portfolio items only,
 * no rate/experience/contact email.
 */
export interface FreelancerPublicProfile {
  name: string;
  headline?: string;
  avatarUrl?: string;
  location?: string;
  availability?: FreelancerAvailability;
  /** Null for anonymous visitors. */
  rateAmount?: number | null;
  rateCurrency?: string | null;
  rateUnit?: RateUnit | null;
  skills: string[];
  languages: string[];
  tools: string[];
  bio?: string;
  portfolioItems: PortfolioItem[];
  portfolioTotal: number;
  experienceEntries: ExperienceEntry[];
  experienceTotal: number;
  contactEmail?: string | null;
  profileSlug: string;
  profileTemplate?: ProfileTemplateId;
  coverImageUrl?: string;
  coverHiddenOn?: ProfileTemplateId[];
  limited: boolean;
}

/** Partial appearance update — null/omitted fields are left unchanged server-side. */
export interface FreelancerAppearanceRequest {
  profileTemplate?: ProfileTemplateId;
  coverImageUrl?: string;
  coverHiddenOn?: ProfileTemplateId[];
}

/**
 * Request for creating/updating brand profile
 */
export interface BrandProfileRequest {
  companyName: string;
  industry: string;
  description: string;
  website: string;
  companySize?: string;
  lookingFor?: string;
}

/**
 * Response from brand profile endpoints
 */
export interface BrandProfileResponse {
  id?: number;
  companyName: string;
  industry: string;
  description: string;
  website: string;
  companySize?: string;
  lookingFor?: string;
  isComplete: boolean;
  roleStatus: RoleStatus;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload for the influencer setup wizard (POST /influencer/setup). */
export interface InfluencerSetupRequest {
  name: string;
  nicheDomain: string;
  nicheSubdomain?: string;
  primaryGoal?: string;
  experienceLevel?: number;
  postingFrequency?: number;
  location?: string;
}

// ==================== Search Types ====================

/**
 * Freelancer search result returned by /api/freelancer/search
 */
export interface FreelancerSearchResult {
  userId: number;
  name: string;
  bio: string;
  skills: string[];
  tools: string[];
  languages: string[];
  /** Public profile link target: /freelancer/{profileSlug}. */
  profileSlug?: string;
  headline?: string;
  avatarUrl?: string;
  location?: string;
  availability?: FreelancerAvailability;
  rateAmount?: number | null;
  rateCurrency?: string | null;
  rateUnit?: RateUnit | null;
  projectCount: number;
}

/** Every filter the freelancer directory supports; all optional. */
export interface FreelancerSearchFilters {
  keyword?: string;
  /** Max results to return (backend caps at 60). */
  limit?: number;
  skills?: string[];
  tools?: string[];
  languages?: string[];
  location?: string;
  availability?: FreelancerAvailability | '';
  maxRate?: number | null;
  rateCurrency?: string;
}

/** Directory counts (cheap COUNT queries — no entity loading). */
export interface FreelancerStats {
  /** Freelancers complete enough to appear in the directory. */
  listed: number;
  /** Everyone who has taken the freelancer role, complete or not. */
  total: number;
}

/**
 * Influencer search result returned by /api/influencer/search
 */
export interface InfluencerSearchResult {
  userId: number;
  name: string;
  niche: string;
  location: string;
}

// ==================== Instagram Automations (Creator Tools) ====================

export type AutomationType = 'KEYWORD_REPLY' | 'KEYWORD_REPLY_FOLLOW_GATED';
export type TargetMode = 'ANY' | 'SPECIFIC';
export type KeywordMatchMode = 'EXACT_WORD' | 'CONTAINS' | 'ANY_COMMENT';

/** The Instagram-Login connection used for automations (separate from analytics). */
export interface AutomationConnectionDTO {
  igUserId: string;
  username: string;
  accountAvatarUrl?: string;
  active: boolean;
  status: string;
  webhookSubscribed: boolean;
  connectedAt?: string;
  lastRefreshedAt?: string;
  scopes: string[];
  followersCount?: number | null;
  mediaCount?: number | null;
}

export interface AutomationTarget {
  mediaId: string;
  permalink?: string;
  thumbnailUrl?: string;
  caption?: string;
}

export interface DmReply {
  text?: string;
  linkUrl?: string;
  followPromptText?: string;
  unlockText?: string;
}

export interface AutomationDTO {
  id: string;
  name: string;
  type: AutomationType;
  enabled: boolean;
  targetMode: TargetMode;
  includeFuturePosts: boolean;
  keywordMatchMode: KeywordMatchMode;
  keywords: string[];
  targets: AutomationTarget[];
  publicReplies: string[];
  dmReplies: DmReply[];
  triggeredCount?: number;
  dmSentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AutomationRequest {
  name: string;
  type: AutomationType;
  enabled?: boolean;
  targetMode: TargetMode;
  includeFuturePosts?: boolean;
  keywordMatchMode: KeywordMatchMode;
  keywords: string[];
  targets: AutomationTarget[];
  publicReplies: string[];
  dmReplies: DmReply[];
}

export interface MediaItem {
  id: string;
  caption?: string;
  mediaType?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  permalink?: string;
  timestamp?: string;
}

export interface MediaPage {
  items: MediaItem[];
  nextCursor?: string | null;
}

export interface AutomationExecutionRow {
  commenterUsername?: string;
  commentText?: string;
  status?: string;
  followVerified?: boolean;
  createdAt?: string;
}

export interface AutomationStats {
  triggered: number;
  publicReplies: number;
  dmSent: number;
  awaitingFollow: number;
  unlocked: number;
  failed: number;
  recent: AutomationExecutionRow[];
}

// ==================== Instagram Analytics Dashboard (Instagram-Login insights) ====================

export interface IgDashProfile {
  username: string; name?: string; avatarUrl?: string;
  followers: number; following: number; mediaCount: number; accountType?: string;
}
export interface IgKpi { key: string; label: string; value: number; previous?: number | null; }
export interface IgPoint { date: string; value: number; }
export interface IgSeries { metric: string; points: IgPoint[]; total: number; previousTotal?: number | null; }
export interface IgBucket { key: string; value: number; }
export interface IgHourPoint { hour: number; value: number; }
export interface IgFormatStat { format: string; count: number; avgEngagementRate: number; avgReach: number; }
export interface IgPostRow {
  mediaId: string; type: string; caption?: string; permalink?: string; thumbnailUrl?: string; timestamp?: string;
  reach: number; likes: number; comments: number; saves: number; shares: number; engagementRate?: number | null;
}
export interface InstagramDashboard {
  profile: IgDashProfile;
  rangeDays: number;
  kpis: IgKpi[];
  growth: IgSeries; reach: IgSeries; views: IgSeries;
  age: IgBucket[]; gender: IgBucket[]; topCountries: IgBucket[]; topCities: IgBucket[];
  onlineFollowers: IgHourPoint[];
  formats: IgFormatStat[];
  posts: IgPostRow[];
}

// ==================== YouTube Analytics Dashboard (composed /api/youtube/dashboard) ====================

export interface YtDashProfile {
  channelId: string; title: string; customUrl?: string; thumbnailUrl?: string;
  subscribers: number; totalViews: number; videoCount: number;
}
/** Same shape as IgKpi — value = current period, previous = prior equal-length period. */
export type YtKpi = IgKpi;
export interface YtPoint { date: string; value: number; }
export interface YtSeries { metric: string; points: YtPoint[]; total: number; previousTotal?: number | null; }
export interface YtBucket { key: string; value: number; }
export interface YtTrafficSource { source: string; percent: number; }
export interface YtFormatStat { format: string; count: number; avgEngagementRate: number; avgViews: number; avgWatchMinutes: number; }
export interface YtVideoRow {
  videoId: string; title: string; thumbnailUrl?: string; publishedAt?: string; permalink?: string;
  views: number; watchMinutes: number; avgViewDurationSecs: number; avgViewPercentage?: number | null;
  comments: number; shares: number; engagementRate?: number | null; type: string;
}
export interface YouTubeDashboard {
  profile: YtDashProfile;
  rangeDays: number;
  kpis: YtKpi[];
  views: YtSeries; watchTime: YtSeries; subscribers: YtSeries;
  age: YtBucket[]; gender: YtBucket[]; topCountries: YtBucket[];
  trafficSources: YtTrafficSource[];
  formats: YtFormatStat[];
  videos: YtVideoRow[];
}

// ==================== Waitlist / Admin ====================

export type WaitlistRole = 'CREATOR' | 'BRAND' | 'FREELANCER';
export type WaitlistStatus = 'PENDING' | 'APPROVED';

export interface WaitlistEntry {
  id: number;
  email: string;
  role: WaitlistRole;
  status: WaitlistStatus;
  source: string | null;
  createdAt: string;
  approvedAt: string | null;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  acceptedAt: string | null;
  /** A Voxlae account already exists for this email. */
  hasAccount: boolean;
}

export interface AdminWaitlistResponse {
  entries: WaitlistEntry[];
  counts: {
    total: number;
    pending: number;
    approved: number;
    joined: number;
    byRole: Record<WaitlistRole, number>;
  };
}

/** What approving / re-inviting did: whether the email went out, and the invite link to share by hand. */
export interface InviteOutcome {
  kind: 'invite' | 'welcome_back';
  emailSent: boolean;
  inviteUrl: string | null;
}

export interface AdminAccount {
  userId: number;
  email: string;
  name: string | null;
  roles: string[];
  createdAt: string | null;
  lastLoginAt: string | null;
  access: 'admin' | 'allowed' | 'blocked';
}

/** GET /api/invites/{token} — who a live invite link is for. */
export interface InviteInfo {
  email: string;
  role: WaitlistRole;
}
