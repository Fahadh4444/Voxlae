import { relations } from "drizzle-orm/relations";
import { users, jwtRefreshTokens, connectedAccounts, platforms, userMetricsSnapshotRecords, userMetricsSnapshots, youtubeChannels, youtubeVideos, youtubeVideoDailyMetrics, userRoles, freelancerProfiles, freelancerSkills, creatorProfiles, creatorSkills, creatorContentLanguages, creatorPlatformFamiliarity, creatorExistingPlatforms, platformDailySnapshot, creatorPlans, brandProfiles, contentTrends, contentTrendHashtags, igAutomations, igAutomationConnections, igAutomationKeywords, igAutomationTargets, igAutomationReplies, igAutomationExecutions, igAutomationOptouts, userPlatform, freelancerLanguages, freelancerTools, freelancerExperience, freelancerPortfolioItems } from "./schema";

export const jwtRefreshTokensRelations = relations(jwtRefreshTokens, ({one}) => ({
	user: one(users, {
		fields: [jwtRefreshTokens.userId],
		references: [users.userId]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	jwtRefreshTokens: many(jwtRefreshTokens),
	connectedAccounts: many(connectedAccounts),
	userMetricsSnapshotRecords: many(userMetricsSnapshotRecords),
	userMetricsSnapshots: many(userMetricsSnapshots),
	userRoles: many(userRoles),
	freelancerProfiles: many(freelancerProfiles),
	creatorProfiles: many(creatorProfiles),
	platformDailySnapshots: many(platformDailySnapshot),
	creatorPlans: many(creatorPlans),
	brandProfiles: many(brandProfiles),
	igAutomations: many(igAutomations),
	igAutomationConnections: many(igAutomationConnections),
	userPlatforms: many(userPlatform),
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({one, many}) => ({
	user: one(users, {
		fields: [connectedAccounts.userId],
		references: [users.userId]
	}),
	platform: one(platforms, {
		fields: [connectedAccounts.platformId],
		references: [platforms.platformId]
	}),
	platformDailySnapshots: many(platformDailySnapshot),
}));

export const platformsRelations = relations(platforms, ({many}) => ({
	connectedAccounts: many(connectedAccounts),
	userMetricsSnapshotRecords: many(userMetricsSnapshotRecords),
	userPlatforms: many(userPlatform),
}));

export const userMetricsSnapshotRecordsRelations = relations(userMetricsSnapshotRecords, ({one}) => ({
	user: one(users, {
		fields: [userMetricsSnapshotRecords.userId],
		references: [users.userId]
	}),
	platform: one(platforms, {
		fields: [userMetricsSnapshotRecords.platformId],
		references: [platforms.platformId]
	}),
}));

export const userMetricsSnapshotsRelations = relations(userMetricsSnapshots, ({one}) => ({
	user: one(users, {
		fields: [userMetricsSnapshots.userId],
		references: [users.userId]
	}),
}));

export const youtubeVideosRelations = relations(youtubeVideos, ({one, many}) => ({
	youtubeChannel: one(youtubeChannels, {
		fields: [youtubeVideos.channelId],
		references: [youtubeChannels.channelId]
	}),
	youtubeVideoDailyMetrics: many(youtubeVideoDailyMetrics),
}));

export const youtubeChannelsRelations = relations(youtubeChannels, ({many}) => ({
	youtubeVideos: many(youtubeVideos),
}));

export const youtubeVideoDailyMetricsRelations = relations(youtubeVideoDailyMetrics, ({one}) => ({
	youtubeVideo: one(youtubeVideos, {
		fields: [youtubeVideoDailyMetrics.videoId],
		references: [youtubeVideos.videoId]
	}),
}));

export const userRolesRelations = relations(userRoles, ({one}) => ({
	user: one(users, {
		fields: [userRoles.userId],
		references: [users.userId]
	}),
}));

export const freelancerProfilesRelations = relations(freelancerProfiles, ({one, many}) => ({
	user: one(users, {
		fields: [freelancerProfiles.userId],
		references: [users.userId]
	}),
	freelancerSkills: many(freelancerSkills),
	freelancerLanguages: many(freelancerLanguages),
	freelancerTools: many(freelancerTools),
	freelancerExperiences: many(freelancerExperience),
	freelancerPortfolioItems: many(freelancerPortfolioItems),
}));

export const freelancerSkillsRelations = relations(freelancerSkills, ({one}) => ({
	freelancerProfile: one(freelancerProfiles, {
		fields: [freelancerSkills.profileId],
		references: [freelancerProfiles.id]
	}),
}));

export const creatorProfilesRelations = relations(creatorProfiles, ({one, many}) => ({
	user: one(users, {
		fields: [creatorProfiles.userId],
		references: [users.userId]
	}),
	creatorSkills: many(creatorSkills),
	creatorContentLanguages: many(creatorContentLanguages),
	creatorPlatformFamiliarities: many(creatorPlatformFamiliarity),
	creatorExistingPlatforms: many(creatorExistingPlatforms),
	creatorPlans: many(creatorPlans),
}));

export const creatorSkillsRelations = relations(creatorSkills, ({one}) => ({
	creatorProfile: one(creatorProfiles, {
		fields: [creatorSkills.profileId],
		references: [creatorProfiles.id]
	}),
}));

export const creatorContentLanguagesRelations = relations(creatorContentLanguages, ({one}) => ({
	creatorProfile: one(creatorProfiles, {
		fields: [creatorContentLanguages.profileId],
		references: [creatorProfiles.id]
	}),
}));

export const creatorPlatformFamiliarityRelations = relations(creatorPlatformFamiliarity, ({one}) => ({
	creatorProfile: one(creatorProfiles, {
		fields: [creatorPlatformFamiliarity.profileId],
		references: [creatorProfiles.id]
	}),
}));

export const creatorExistingPlatformsRelations = relations(creatorExistingPlatforms, ({one}) => ({
	creatorProfile: one(creatorProfiles, {
		fields: [creatorExistingPlatforms.profileId],
		references: [creatorProfiles.id]
	}),
}));

export const platformDailySnapshotRelations = relations(platformDailySnapshot, ({one}) => ({
	connectedAccount: one(connectedAccounts, {
		fields: [platformDailySnapshot.connectedAccountId],
		references: [connectedAccounts.id]
	}),
	user: one(users, {
		fields: [platformDailySnapshot.userId],
		references: [users.userId]
	}),
}));

export const creatorPlansRelations = relations(creatorPlans, ({one}) => ({
	user: one(users, {
		fields: [creatorPlans.userId],
		references: [users.userId]
	}),
	creatorProfile: one(creatorProfiles, {
		fields: [creatorPlans.profileId],
		references: [creatorProfiles.id]
	}),
}));

export const brandProfilesRelations = relations(brandProfiles, ({one}) => ({
	user: one(users, {
		fields: [brandProfiles.userId],
		references: [users.userId]
	}),
}));

export const contentTrendHashtagsRelations = relations(contentTrendHashtags, ({one}) => ({
	contentTrend: one(contentTrends, {
		fields: [contentTrendHashtags.trendId],
		references: [contentTrends.id]
	}),
}));

export const contentTrendsRelations = relations(contentTrends, ({many}) => ({
	contentTrendHashtags: many(contentTrendHashtags),
}));

export const igAutomationsRelations = relations(igAutomations, ({one, many}) => ({
	user: one(users, {
		fields: [igAutomations.userId],
		references: [users.userId]
	}),
	igAutomationConnection: one(igAutomationConnections, {
		fields: [igAutomations.connectionId],
		references: [igAutomationConnections.id]
	}),
	igAutomationKeywords: many(igAutomationKeywords),
	igAutomationTargets: many(igAutomationTargets),
	igAutomationReplies: many(igAutomationReplies),
	igAutomationExecutions: many(igAutomationExecutions),
}));

export const igAutomationConnectionsRelations = relations(igAutomationConnections, ({one, many}) => ({
	igAutomations: many(igAutomations),
	igAutomationExecutions: many(igAutomationExecutions),
	igAutomationOptouts: many(igAutomationOptouts),
	user: one(users, {
		fields: [igAutomationConnections.userId],
		references: [users.userId]
	}),
}));

export const igAutomationKeywordsRelations = relations(igAutomationKeywords, ({one}) => ({
	igAutomation: one(igAutomations, {
		fields: [igAutomationKeywords.automationId],
		references: [igAutomations.id]
	}),
}));

export const igAutomationTargetsRelations = relations(igAutomationTargets, ({one}) => ({
	igAutomation: one(igAutomations, {
		fields: [igAutomationTargets.automationId],
		references: [igAutomations.id]
	}),
}));

export const igAutomationRepliesRelations = relations(igAutomationReplies, ({one}) => ({
	igAutomation: one(igAutomations, {
		fields: [igAutomationReplies.automationId],
		references: [igAutomations.id]
	}),
}));

export const igAutomationExecutionsRelations = relations(igAutomationExecutions, ({one}) => ({
	igAutomation: one(igAutomations, {
		fields: [igAutomationExecutions.automationId],
		references: [igAutomations.id]
	}),
	igAutomationConnection: one(igAutomationConnections, {
		fields: [igAutomationExecutions.connectionId],
		references: [igAutomationConnections.id]
	}),
}));

export const igAutomationOptoutsRelations = relations(igAutomationOptouts, ({one}) => ({
	igAutomationConnection: one(igAutomationConnections, {
		fields: [igAutomationOptouts.connectionId],
		references: [igAutomationConnections.id]
	}),
}));

export const userPlatformRelations = relations(userPlatform, ({one}) => ({
	user: one(users, {
		fields: [userPlatform.userId],
		references: [users.userId]
	}),
	platform: one(platforms, {
		fields: [userPlatform.platformId],
		references: [platforms.platformId]
	}),
}));

export const freelancerLanguagesRelations = relations(freelancerLanguages, ({one}) => ({
	freelancerProfile: one(freelancerProfiles, {
		fields: [freelancerLanguages.profileId],
		references: [freelancerProfiles.id]
	}),
}));

export const freelancerToolsRelations = relations(freelancerTools, ({one}) => ({
	freelancerProfile: one(freelancerProfiles, {
		fields: [freelancerTools.profileId],
		references: [freelancerProfiles.id]
	}),
}));

export const freelancerExperienceRelations = relations(freelancerExperience, ({one}) => ({
	freelancerProfile: one(freelancerProfiles, {
		fields: [freelancerExperience.profileId],
		references: [freelancerProfiles.id]
	}),
}));

export const freelancerPortfolioItemsRelations = relations(freelancerPortfolioItems, ({one}) => ({
	freelancerProfile: one(freelancerProfiles, {
		fields: [freelancerPortfolioItems.profileId],
		references: [freelancerProfiles.id]
	}),
}));