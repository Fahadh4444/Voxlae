/**
 * Typed view of the database. Flyway owns the schema; this file only describes it.
 *
 * To change the schema, write a migration in `db/migration/` and run `pnpm db:migrate`. Then
 * update this file to match (or run `pnpm db:verify` to re-introspect and diff).
 *
 * ⚠️  Never run `drizzle-kit generate`. It diffs this file against the database and emits SQL to
 * "fix" the difference — but its DSL cannot represent RLS policies, grants, triggers or
 * functions, so it reads them as drift and removes them. On the first attempt it generated
 * `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` for all 36 tables. `V43__supabase_security_perf`
 * enables RLS deliberately, and Supabase serves these tables over PostgREST with the anon key, so
 * applying that would have exposed the database. The `.enableRLS()` markers below document the
 * real state; they are not what protects it — Flyway owning migrations is.
 */
import { pgTable, index, foreignKey, unique, bigserial, varchar, bigint, timestamp, boolean, uniqueIndex, uuid, text, check, integer, jsonb, date, numeric, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const jwtRefreshTokens = pgTable("jwt_refresh_tokens", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	token: varchar({ length: 500 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	revoked: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_jwt_refresh_tokens_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("idx_jwt_refresh_tokens_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "jwt_refresh_tokens_user_id_fkey"
		}).onDelete("cascade"),
	unique("jwt_refresh_tokens_token_key").on(table.token),
]).enableRLS();

export const platforms = pgTable("platforms", {
	platformId: bigserial("platform_id", { mode: "bigint" }).primaryKey().notNull(),
	platformName: varchar("platform_name", { length: 50 }).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	unique("platforms_platform_name_key").on(table.platformName),
]).enableRLS();

export const connectedAccounts = pgTable("connected_accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	platformId: bigint("platform_id", { mode: "number" }).notNull(),
	externalAccountId: varchar("external_account_id", { length: 255 }).notNull(),
	accountName: varchar("account_name", { length: 255 }),
	accountAvatarUrl: varchar("account_avatar_url", { length: 1024 }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	tokenExpiry: timestamp("token_expiry", { withTimezone: true, mode: 'string' }),
	scopes: text(),
	revoked: boolean().default(false).notNull(),
	connectedAt: timestamp("connected_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: 'string' }),
	connectionStatus: varchar("connection_status", { length: 50 }).default('CONNECTED').notNull(),
}, (table) => [
	index("idx_connected_accounts_active").using("btree", table.platformId.asc().nullsLast().op("int8_ops"), table.connectionStatus.asc().nullsLast().op("int8_ops")).where(sql`(((connection_status)::text = 'ACTIVE'::text) AND (revoked = false))`),
	index("idx_connected_accounts_external_id").using("btree", table.externalAccountId.asc().nullsLast().op("text_ops")),
	index("idx_connected_accounts_platform_id").using("btree", table.platformId.asc().nullsLast().op("int8_ops")),
	index("idx_connected_accounts_status").using("btree", table.connectionStatus.asc().nullsLast().op("text_ops")),
	index("idx_connected_accounts_token_expiry").using("btree", table.tokenExpiry.asc().nullsLast().op("timestamptz_ops")).where(sql`((token_expiry IS NOT NULL) AND (revoked = false))`),
	index("idx_connected_accounts_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	index("idx_connected_accounts_user_platform").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.platformId.asc().nullsLast().op("int8_ops")),
	uniqueIndex("uq_connected_account_user_platform_active").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.platformId.asc().nullsLast().op("int8_ops")).where(sql`(revoked = false)`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "connected_accounts_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.platformId],
			foreignColumns: [platforms.platformId],
			name: "connected_accounts_platform_id_fkey"
		}).onDelete("cascade"),
	unique("uq_connected_account_external").on(table.platformId, table.externalAccountId),
]).enableRLS();

export const users = pgTable("users", {
	userId: bigserial("user_id", { mode: "bigint" }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	age: integer(),
	gender: varchar({ length: 50 }),
	email: varchar({ length: 255 }).notNull(),
	onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
	nicheDomain: varchar("niche_domain", { length: 255 }),
	nicheSubdomain: varchar("niche_subdomain", { length: 255 }),
	location: varchar({ length: 255 }),
	experienceLevel: integer("experience_level"),
	postingFrequency: integer("posting_frequency"),
	socialExpectation: varchar("social_expectation", { length: 100 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	provider: varchar({ length: 50 }),
	emailVerified: boolean("email_verified").default(false),
	phoneVerified: boolean("phone_verified").default(false),
	passwordHash: varchar("password_hash", { length: 255 }),
	phoneNumber: varchar("phone_number", { length: 20 }),
	activeRole: varchar("active_role", { length: 50 }),
	primaryGoal: varchar("primary_goal", { length: 60 }),
}, (table) => [
	index("idx_users_active_role").using("btree", table.activeRole.asc().nullsLast().op("text_ops")),
	unique("users_email_key").on(table.email),
	check("users_age_check", sql`age >= 0`),
	check("users_experience_level_check", sql`(experience_level >= 1) AND (experience_level <= 3)`),
	check("users_posting_frequency_check", sql`posting_frequency >= 0`),
]).enableRLS();

export const userMetricsSnapshotRecords = pgTable("user_metrics_snapshot_records", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	platformId: bigint("platform_id", { mode: "number" }).notNull(),
	snapshotAt: timestamp("snapshot_at", { withTimezone: true, mode: 'string' }).notNull(),
	metricType: varchar("metric_type", { length: 100 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	metricValue: bigint("metric_value", { mode: "number" }).default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_metrics_snapshot_timestamp").using("btree", table.snapshotAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_user_metrics_snapshot_user_platform").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.platformId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "user_metrics_snapshot_records_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.platformId],
			foreignColumns: [platforms.platformId],
			name: "user_metrics_snapshot_records_platform_id_fkey"
		}).onDelete("cascade"),
]).enableRLS();

export const userMetricsSnapshots = pgTable("user_metrics_snapshots", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalVideos: bigint("total_videos", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalFollowers: bigint("total_followers", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalComments: bigint("total_comments", { mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalViews: bigint("total_views", { mode: "number" }).default(0).notNull(),
	platformBreakdown: jsonb("platform_breakdown"),
	triggerType: varchar("trigger_type", { length: 50 }),
	capturedAt: timestamp("captured_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_user_metrics_snapshots_captured_at").using("btree", table.capturedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_user_metrics_snapshots_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "user_metrics_snapshots_user_id_fkey"
		}).onDelete("cascade"),
]).enableRLS();

export const youtubeVideos = pgTable("youtube_videos", {
	videoId: varchar("video_id", { length: 64 }).primaryKey().notNull(),
	channelId: varchar("channel_id", { length: 64 }).notNull(),
	title: varchar({ length: 500 }).notNull(),
	description: text(),
	duration: varchar({ length: 32 }),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	thumbnailUrl: varchar("thumbnail_url", { length: 1024 }),
	privacyStatus: varchar("privacy_status", { length: 32 }),
	liveBroadcastContent: varchar("live_broadcast_content", { length: 32 }),
	categoryId: varchar("category_id", { length: 32 }),
	tags: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_youtube_videos_channel_id").using("btree", table.channelId.asc().nullsLast().op("text_ops")),
	index("idx_youtube_videos_channel_published").using("btree", table.channelId.asc().nullsLast().op("text_ops"), table.publishedAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_youtube_videos_published_at").using("btree", table.publishedAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [youtubeChannels.channelId],
			name: "fk_youtube_videos_channel"
		}).onDelete("cascade"),
]).enableRLS();

export const youtubeChannels = pgTable("youtube_channels", {
	channelId: varchar("channel_id", { length: 64 }).primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	customUrl: varchar("custom_url", { length: 255 }),
	country: varchar({ length: 10 }),
	publishedAt: timestamp("published_at", { withTimezone: true, mode: 'string' }),
	thumbnailUrl: varchar("thumbnail_url", { length: 1024 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	subscriberCount: bigint("subscriber_count", { mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	videoCount: bigint("video_count", { mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	viewCount: bigint("view_count", { mode: "number" }).default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}).enableRLS();

export const youtubeVideoDailyMetrics = pgTable("youtube_video_daily_metrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	videoId: varchar("video_id", { length: 64 }).notNull(),
	metricDate: date("metric_date").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	views: bigint({ mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	estimatedMinutesWatched: bigint("estimated_minutes_watched", { mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	averageViewDuration: bigint("average_view_duration", { mode: "number" }).default(0),
	averageViewPercentage: numeric("average_view_percentage", { precision: 5, scale:  2 }).default('0'),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dislikes: bigint({ mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	comments: bigint({ mode: "number" }).default(0),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	shares: bigint({ mode: "number" }).default(0),
	trafficSources: jsonb("traffic_sources"),
	audienceDemographics: jsonb("audience_demographics"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_video_metrics_date").using("btree", table.metricDate.asc().nullsLast().op("date_ops")),
	foreignKey({
			columns: [table.videoId],
			foreignColumns: [youtubeVideos.videoId],
			name: "fk_youtube_video_daily_metrics_video"
		}).onDelete("cascade"),
	unique("uq_video_daily_metrics").on(table.videoId, table.metricDate),
]).enableRLS();

export const userRoles = pgTable("user_roles", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	role: varchar({ length: 50 }).notNull(),
	verificationStatus: varchar("verification_status", { length: 50 }).default('UNVERIFIED').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	status: varchar({ length: 50 }).default('ACTIVE').notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_roles_role").using("btree", table.role.asc().nullsLast().op("text_ops")),
	index("idx_user_roles_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "fk_user_roles_user"
		}).onDelete("cascade"),
	unique("uq_user_role").on(table.userId, table.role),
]).enableRLS();

export const freelancerProfiles = pgTable("freelancer_profiles", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	bio: text(),
	experience: varchar({ length: 500 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	headline: varchar({ length: 120 }),
	avatarUrl: varchar("avatar_url", { length: 1024 }),
	location: varchar({ length: 120 }),
	availability: varchar({ length: 20 }).default('OPEN_TO_OFFERS').notNull(),
	profileSlug: varchar("profile_slug", { length: 160 }),
	rateAmount: numeric("rate_amount", { precision: 12, scale:  2 }),
	rateCurrency: varchar("rate_currency", { length: 8 }),
	rateUnit: varchar("rate_unit", { length: 10 }),
	profileTemplate: varchar("profile_template", { length: 40 }).default('CLASSIC').notNull(),
	coverImageUrl: varchar("cover_image_url", { length: 1024 }),
	coverHiddenOn: varchar("cover_hidden_on", { length: 255 }),
}, (table) => [
	uniqueIndex("uq_freelancer_profile_slug").using("btree", table.profileSlug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "fk_freelancer_profiles_user"
		}).onDelete("cascade"),
	unique("freelancer_profiles_user_id_key").on(table.userId),
	check("chk_freelancer_availability", sql`(availability)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'OPEN_TO_OFFERS'::character varying, 'BOOKED'::character varying])::text[])`),
	check("chk_freelancer_rate_unit", sql`(rate_unit IS NULL) OR ((rate_unit)::text = ANY ((ARRAY['HOUR'::character varying, 'DAY'::character varying, 'PROJECT'::character varying])::text[]))`),
	check("chk_freelancer_profile_template", sql`(profile_template)::text = ANY ((ARRAY['CLASSIC'::character varying, 'GALLERY'::character varying, 'EDITORIAL'::character varying, 'SPOTLIGHT'::character varying, 'STUDIO'::character varying, 'INDEX'::character varying, 'TERMINAL'::character varying, 'BRUTALIST'::character varying, 'BENTO'::character varying])::text[])`),
]).enableRLS();

export const freelancerSkills = pgTable("freelancer_skills", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }).notNull(),
	skill: varchar({ length: 255 }).notNull(),
}, (table) => [
	index("idx_freelancer_skills_profile_id").using("btree", table.profileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [freelancerProfiles.id],
			name: "fk_freelancer_skills_profile"
		}).onDelete("cascade"),
]).enableRLS();

export const otpCodes = pgTable("otp_codes", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	identifier: varchar({ length: 255 }).notNull(),
	otpType: varchar("otp_type", { length: 20 }).notNull(),
	code: varchar({ length: 6 }).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	used: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_otp_codes_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_otp_codes_identifier").using("btree", table.identifier.asc().nullsLast().op("text_ops")),
	index("idx_otp_codes_type_identifier").using("btree", table.otpType.asc().nullsLast().op("text_ops"), table.identifier.asc().nullsLast().op("text_ops")),
	check("chk_otp_type", sql`(otp_type)::text = ANY ((ARRAY['EMAIL'::character varying, 'PHONE'::character varying, 'PASSWORD_RESET'::character varying])::text[])`),
]).enableRLS();

export const contentTrends = pgTable("content_trends", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	source: varchar({ length: 20 }).notNull(),
	category: varchar({ length: 32 }).notNull(),
	region: varchar({ length: 8 }).default('GLOBAL').notNull(),
	timeframe: varchar({ length: 8 }).default('WEEK').notNull(),
	topic: varchar({ length: 200 }).notNull(),
	summary: varchar({ length: 400 }),
	momentumScore: integer("momentum_score").default(50).notNull(),
	sampleTitle: varchar("sample_title", { length: 300 }),
	sampleUrl: varchar("sample_url", { length: 600 }),
	thumbnailUrl: varchar("thumbnail_url", { length: 600 }),
	ageBand: varchar("age_band", { length: 16 }),
	externalId: varchar("external_id", { length: 200 }),
	fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_content_trends_cat_region").using("btree", table.category.asc().nullsLast().op("text_ops"), table.region.asc().nullsLast().op("text_ops"), table.timeframe.asc().nullsLast().op("text_ops")),
	unique("uq_content_trend").on(table.source, table.category, table.region, table.topic),
]).enableRLS();

export const creatorProfiles = pgTable("creator_profiles", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	goal: varchar({ length: 100 }),
	timeCommitment: varchar("time_commitment", { length: 50 }),
	monetizationIntent: varchar("monetization_intent", { length: 20 }),
	faceComfort: varchar("face_comfort", { length: 50 }),
	speakingComfort: varchar("speaking_comfort", { length: 50 }),
	comfortLanguage: varchar("comfort_language", { length: 50 }),
	contentType: varchar("content_type", { length: 50 }),
	isExistingCreator: boolean("is_existing_creator").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "fk_creator_profiles_user"
		}).onDelete("cascade"),
	unique("creator_profiles_user_id_key").on(table.userId),
]).enableRLS();

export const creatorSkills = pgTable("creator_skills", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }).notNull(),
	skill: varchar({ length: 255 }).notNull(),
}, (table) => [
	index("idx_creator_skills_profile_id").using("btree", table.profileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [creatorProfiles.id],
			name: "fk_creator_skills_profile"
		}).onDelete("cascade"),
]).enableRLS();

export const creatorContentLanguages = pgTable("creator_content_languages", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }).notNull(),
	language: varchar({ length: 100 }).notNull(),
}, (table) => [
	index("idx_creator_content_languages_profile_id").using("btree", table.profileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [creatorProfiles.id],
			name: "fk_creator_content_languages_profile"
		}).onDelete("cascade"),
]).enableRLS();

export const creatorPlatformFamiliarity = pgTable("creator_platform_familiarity", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }).notNull(),
	platform: varchar({ length: 100 }).notNull(),
}, (table) => [
	index("idx_creator_platform_familiarity_profile_id").using("btree", table.profileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [creatorProfiles.id],
			name: "fk_creator_platform_familiarity_profile"
		}).onDelete("cascade"),
]).enableRLS();

export const creatorExistingPlatforms = pgTable("creator_existing_platforms", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }).notNull(),
	platform: varchar({ length: 100 }).notNull(),
}, (table) => [
	index("idx_creator_existing_platforms_profile_id").using("btree", table.profileId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [creatorProfiles.id],
			name: "fk_creator_existing_platforms_profile"
		}).onDelete("cascade"),
]).enableRLS();

export const platformDailySnapshot = pgTable("platform_daily_snapshot", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	connectedAccountId: uuid("connected_account_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	platform: varchar({ length: 20 }).notNull(),
	snapshotDate: date("snapshot_date").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	followersTotal: bigint("followers_total", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	views: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	reach: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	engagement: bigint({ mode: "number" }).default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	watchTimeMinutes: bigint("watch_time_minutes", { mode: "number" }).default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_pds_user_platform_date").using("btree", table.userId.asc().nullsLast().op("date_ops"), table.platform.asc().nullsLast().op("date_ops"), table.snapshotDate.asc().nullsLast().op("int8_ops")),
	uniqueIndex("uq_pds_user_platform_date_null_account").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.platform.asc().nullsLast().op("text_ops"), table.snapshotDate.asc().nullsLast().op("text_ops")).where(sql`(connected_account_id IS NULL)`),
	foreignKey({
			columns: [table.connectedAccountId],
			foreignColumns: [connectedAccounts.id],
			name: "platform_daily_snapshot_connected_account_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "platform_daily_snapshot_user_id_fkey"
		}).onDelete("cascade"),
	unique("uq_platform_daily_snapshot").on(table.connectedAccountId, table.snapshotDate),
]).enableRLS();

export const creatorPlans = pgTable("creator_plans", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }),
	planData: text("plan_data"),
	version: integer().default(1),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	promptVersion: varchar("prompt_version", { length: 50 }).default('v1.0'),
	profileSnapshot: text("profile_snapshot"),
	aiOutput: text("ai_output"),
	generationStatus: varchar("generation_status", { length: 20 }).default('COMPLETED'),
	retryCount: integer("retry_count").default(0),
	errorMessage: text("error_message"),
}, (table) => [
	index("idx_creator_plans_profile_id").using("btree", table.profileId.asc().nullsLast().op("int8_ops")),
	index("idx_creator_plans_prompt_version").using("btree", table.promptVersion.asc().nullsLast().op("text_ops"), table.isActive.asc().nullsLast().op("bool_ops")).where(sql`(is_active = true)`),
	index("idx_creator_plans_user_active").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.isActive.asc().nullsLast().op("int8_ops")).where(sql`(is_active = true)`),
	index("idx_creator_plans_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	index("idx_creator_plans_user_version").using("btree", table.userId.asc().nullsLast().op("int8_ops"), table.version.desc().nullsFirst().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "fk_creator_plans_user"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [creatorProfiles.id],
			name: "fk_creator_plans_profile"
		}).onDelete("set null"),
]).enableRLS();

export const brandProfiles = pgTable("brand_profiles", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	companyName: varchar("company_name", { length: 255 }),
	industry: varchar({ length: 255 }),
	description: text(),
	website: varchar({ length: 500 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	companySize: varchar("company_size", { length: 40 }),
	lookingFor: text("looking_for"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "fk_brand_profiles_user"
		}).onDelete("cascade"),
	unique("brand_profiles_user_id_key").on(table.userId),
]).enableRLS();

export const contentTrendHashtags = pgTable("content_trend_hashtags", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	trendId: bigint("trend_id", { mode: "number" }).notNull(),
	hashtag: varchar({ length: 80 }).notNull(),
	grp: varchar({ length: 12 }).default('core').notNull(),
}, (table) => [
	index("idx_content_trend_hashtags_trend").using("btree", table.trendId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.trendId],
			foreignColumns: [contentTrends.id],
			name: "content_trend_hashtags_trend_id_fkey"
		}).onDelete("cascade"),
]).enableRLS();

export const igAutomations = pgTable("ig_automations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	connectionId: uuid("connection_id").notNull(),
	name: varchar({ length: 140 }).notNull(),
	type: varchar({ length: 40 }).notNull(),
	enabled: boolean().default(true).notNull(),
	targetMode: varchar("target_mode", { length: 20 }).default('SPECIFIC').notNull(),
	includeFuturePosts: boolean("include_future_posts").default(true).notNull(),
	keywordMatchMode: varchar("keyword_match_mode", { length: 20 }).default('CONTAINS').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_ig_automations_connection").using("btree", table.connectionId.asc().nullsLast().op("uuid_ops")),
	index("idx_ig_automations_connection_enabled").using("btree", table.connectionId.asc().nullsLast().op("bool_ops"), table.enabled.asc().nullsLast().op("uuid_ops")),
	index("idx_ig_automations_user").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "ig_automations_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.connectionId],
			foreignColumns: [igAutomationConnections.id],
			name: "ig_automations_connection_id_fkey"
		}).onDelete("cascade"),
]).enableRLS();

export const igAutomationKeywords = pgTable("ig_automation_keywords", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	automationId: uuid("automation_id").notNull(),
	keyword: varchar({ length: 140 }).notNull(),
}, (table) => [
	index("idx_ig_automation_keywords_automation").using("btree", table.automationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.automationId],
			foreignColumns: [igAutomations.id],
			name: "ig_automation_keywords_automation_id_fkey"
		}).onDelete("cascade"),
]).enableRLS();

export const igAutomationTargets = pgTable("ig_automation_targets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	automationId: uuid("automation_id").notNull(),
	mediaId: varchar("media_id", { length: 255 }).notNull(),
	permalink: varchar({ length: 1024 }),
	thumbnailUrl: varchar("thumbnail_url", { length: 1024 }),
	caption: text(),
}, (table) => [
	index("idx_ig_automation_targets_media").using("btree", table.mediaId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.automationId],
			foreignColumns: [igAutomations.id],
			name: "ig_automation_targets_automation_id_fkey"
		}).onDelete("cascade"),
	unique("uq_ig_automation_target").on(table.automationId, table.mediaId),
]).enableRLS();

export const igAutomationReplies = pgTable("ig_automation_replies", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	automationId: uuid("automation_id").notNull(),
	channel: varchar({ length: 20 }).notNull(),
	variantOrder: integer("variant_order").default(0).notNull(),
	variantText: text("variant_text").notNull(),
	linkUrl: varchar("link_url", { length: 1024 }),
	followPromptText: text("follow_prompt_text"),
	unlockText: text("unlock_text"),
}, (table) => [
	index("idx_ig_automation_replies_automation").using("btree", table.automationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.automationId],
			foreignColumns: [igAutomations.id],
			name: "ig_automation_replies_automation_id_fkey"
		}).onDelete("cascade"),
]).enableRLS();

export const igAutomationExecutions = pgTable("ig_automation_executions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	automationId: uuid("automation_id").notNull(),
	connectionId: uuid("connection_id").notNull(),
	commentId: varchar("comment_id", { length: 255 }).notNull(),
	mediaId: varchar("media_id", { length: 255 }),
	commenterIgsid: varchar("commenter_igsid", { length: 255 }),
	commenterUsername: varchar("commenter_username", { length: 255 }),
	commentText: text("comment_text"),
	status: varchar({ length: 30 }).notNull(),
	followVerified: boolean("follow_verified"),
	publicReplySent: boolean("public_reply_sent").default(false).notNull(),
	dmSent: boolean("dm_sent").default(false).notNull(),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_ig_automation_executions_automation").using("btree", table.automationId.asc().nullsLast().op("uuid_ops")),
	index("idx_ig_automation_executions_connection").using("btree", table.connectionId.asc().nullsLast().op("uuid_ops")),
	index("idx_ig_automation_executions_pending_follow").using("btree", table.connectionId.asc().nullsLast().op("text_ops"), table.commenterIgsid.asc().nullsLast().op("uuid_ops")).where(sql`((status)::text = 'AWAITING_FOLLOW'::text)`),
	foreignKey({
			columns: [table.automationId],
			foreignColumns: [igAutomations.id],
			name: "ig_automation_executions_automation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.connectionId],
			foreignColumns: [igAutomationConnections.id],
			name: "ig_automation_executions_connection_id_fkey"
		}).onDelete("cascade"),
	unique("uq_ig_automation_execution_comment").on(table.commentId),
]).enableRLS();

export const igAutomationOptouts = pgTable("ig_automation_optouts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	connectionId: uuid("connection_id").notNull(),
	commenterIgsid: varchar("commenter_igsid", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.connectionId],
			foreignColumns: [igAutomationConnections.id],
			name: "ig_automation_optouts_connection_id_fkey"
		}).onDelete("cascade"),
	unique("uq_ig_automation_optout").on(table.connectionId, table.commenterIgsid),
]).enableRLS();

export const igAutomationConnections = pgTable("ig_automation_connections", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	igUserId: varchar("ig_user_id", { length: 255 }).notNull(),
	username: varchar({ length: 255 }),
	accountAvatarUrl: varchar("account_avatar_url", { length: 1024 }),
	accessToken: text("access_token"),
	tokenExpiry: timestamp("token_expiry", { withTimezone: true, mode: 'string' }),
	scopes: text(),
	webhookSubscribed: boolean("webhook_subscribed").default(false).notNull(),
	status: varchar({ length: 20 }).default('CONNECTED').notNull(),
	connectedAt: timestamp("connected_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	followersCount: bigint("followers_count", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	mediaCount: bigint("media_count", { mode: "number" }),
}, (table) => [
	uniqueIndex("uq_ig_automation_connection_user").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "ig_automation_connections_user_id_fkey"
		}).onDelete("cascade"),
	unique("uq_ig_automation_connection_ig_user").on(table.igUserId),
]).enableRLS();

export const userPlatform = pgTable("user_platform", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	userId: bigint("user_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	platformId: bigint("platform_id", { mode: "number" }).notNull(),
}, (table) => [
	index("idx_user_platform_user_id").using("btree", table.userId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.userId],
			name: "user_platforms_used_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.platformId],
			foreignColumns: [platforms.platformId],
			name: "user_platforms_used_platform_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userId, table.platformId], name: "user_platforms_used_pkey"}),
]).enableRLS();

export const freelancerLanguages = pgTable("freelancer_languages", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }).notNull(),
	sortOrder: integer("sort_order").notNull(),
	language: varchar({ length: 60 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [freelancerProfiles.id],
			name: "freelancer_languages_profile_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.profileId, table.sortOrder], name: "freelancer_languages_pkey"}),
]).enableRLS();

export const freelancerTools = pgTable("freelancer_tools", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }).notNull(),
	sortOrder: integer("sort_order").notNull(),
	tool: varchar({ length: 80 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [freelancerProfiles.id],
			name: "freelancer_tools_profile_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.profileId, table.sortOrder], name: "freelancer_tools_pkey"}),
]).enableRLS();

export const contentCategoryMomentum = pgTable("content_category_momentum", {
	category: varchar({ length: 32 }).notNull(),
	region: varchar({ length: 8 }).notNull(),
	snapshotDate: date("snapshot_date").notNull(),
	avgMomentum: integer("avg_momentum").default(0).notNull(),
	trendCount: integer("trend_count").default(0).notNull(),
}, (table) => [
	index("idx_category_momentum_region_date").using("btree", table.region.asc().nullsLast().op("date_ops"), table.snapshotDate.asc().nullsLast().op("date_ops")),
	primaryKey({ columns: [table.category, table.region, table.snapshotDate], name: "content_category_momentum_pkey"}),
]).enableRLS();

export const freelancerExperience = pgTable("freelancer_experience", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }).notNull(),
	sortOrder: integer("sort_order").notNull(),
	title: varchar({ length: 150 }).notNull(),
	organization: varchar({ length: 150 }),
	startDate: date("start_date"),
	endDate: date("end_date"),
	description: varchar({ length: 600 }),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [freelancerProfiles.id],
			name: "freelancer_experience_profile_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.profileId, table.sortOrder], name: "freelancer_experience_pkey"}),
]).enableRLS();

export const freelancerPortfolioItems = pgTable("freelancer_portfolio_items", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	profileId: bigint("profile_id", { mode: "number" }).notNull(),
	sortOrder: integer("sort_order").notNull(),
	title: varchar({ length: 150 }).notNull(),
	outcome: varchar({ length: 300 }),
	role: varchar({ length: 100 }),
	projectUrl: varchar("project_url", { length: 1024 }),
	thumbnailUrl: varchar("thumbnail_url", { length: 1024 }),
	previewTitle: varchar("preview_title", { length: 300 }),
	previewDescription: varchar("preview_description", { length: 600 }),
	previewSite: varchar("preview_site", { length: 120 }),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [freelancerProfiles.id],
			name: "freelancer_portfolio_items_profile_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.profileId, table.sortOrder], name: "freelancer_portfolio_items_pkey"}),
]).enableRLS();

/**
 * Durable fixed-window counters.
 *
 * Replaces the in-process `ConcurrentHashMap` buckets in Spring's `AutomationSendGuard` and
 * `AutomationRateLimiter`. Those reset to zero whenever the process restarts, which on serverless
 * means *every cold start* — and the counters they hold are what keep a creator's account inside
 * Instagram's spam thresholds. Losing them doesn't degrade a cache, it gets real accounts
 * throttled, so the state has to outlive the instance before any automation traffic moves.
 *
 * Postgres rather than Redis on purpose: the volumes involved (tens of sends per account-hour)
 * sit well inside what a single indexed table handles, and it avoids adding a vendor for
 * something the existing database already does atomically. Swap the driver if volume ever
 * justifies it — `src/lib/ratelimit.ts` is the only caller.
 */
export const rateLimitWindows = pgTable("rate_limit_windows", {
	bucket: varchar({ length: 64 }).notNull(),
	key: varchar({ length: 255 }).notNull(),
	windowStart: timestamp("window_start", { withTimezone: true, mode: 'string' }).notNull(),
	count: integer().default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.bucket, table.key, table.windowStart], name: "rate_limit_windows_pkey" }),
	index("idx_rate_limit_windows_window_start").using("btree", table.windowStart.asc().nullsLast()),
]).enableRLS();
