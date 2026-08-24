'use client';

import type { Timestamp, FieldValue } from 'firebase/firestore';

export interface CommunicationPreferences {
  /** Optionale Empfehlungen per E-Mail */
  emailRecommendations: boolean;
  /** Optionale Produkt-Neuigkeiten per E-Mail */
  emailProductNews: boolean;
  /** Optionale Marketing-Angebote per E-Mail */
  emailMarketing: boolean;
  /** Optionale E-Mail-Erinnerungen für geplante Aktivitäten. Zwingende Service- und Sicherheitsmeldungen (Absagen, wesentliche Änderungen) werden unabhängig von dieser Einstellung gesendet. */
  activityEmails: boolean;
  marketingConsentAt: Timestamp | FieldValue | null;
  marketingConsentVersion: string | null;
  marketingUnsubscribedAt: Timestamp | FieldValue | null;
}

export type ActivityCategory = 'Sport' | 'Tech' | 'Party' | 'Kultur' | 'Outdoor' | 'Gaming' | 'Networking' | 'Sonstiges' | 'Other';

export interface PublicUserProfile {
  uid: string;
  username: string;
  photoURL: string | null;
  isPremium?: boolean;
  isSupporter?: boolean;
  isCreator?: boolean;
  level?: number;
  equippedTitle?: string | null;
  equippedBorder?: string | null;
  age?: number;
  location?: string;
  bio?: string;
  interests?: string[];
  tinderInterests?: string[];
  ratingCount?: number;
  averageRating?: number;
}

export interface ParticipantDetailEntry {
  displayName: string | null;
  photoURL: string | null;
  username?: string | null;
  isPremium?: boolean;
  isSupporter?: boolean;
  isCreator?: boolean;
  level?: number;
  checkInStatus?: CheckInStatus;
  checkInTime?: Timestamp;
  hasReviewed?: boolean;
}

export interface ParticipantPreviewEntry {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  username?: string | null;
}

export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'chat_message'
  | 'chat_request'
  | 'activity_invite'
  | 'activity_join_request'
  | 'activity_join_response'
  | 'join_request'
  | 'join_response'
  | 'activity_update'
  | 'activity_reminder'
  | 'nearby_activity'
  | 'nearby_spot'
  | 'recommendation'
  | 'engagement_reminder'
  | 'system'
  | 'friend_nearby_activity';

export interface NotificationSenderProfile {
  displayName?: string;
  photoURL?: string;
  username?: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId?: string;
  senderName?: string;
  senderProfile?: NotificationSenderProfile;
  type: NotificationType;
  title: string;
  message: string;
  body?: string;
  isRead: boolean;
  createdAt: Timestamp;
  link?: string;
  targetUrl?: string;
  activityId?: string;
  spotId?: string;
  actorId?: string;
  entityId?: string;
  eventId?: string;
  customMessage?: string;
  responseStatus?: 'accepted' | 'declined' | 'cancelled';
  readAt?: Timestamp;
}

export type FriendRequestNotificationState =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'processed'
  | 'invalid';

export function deriveFriendRequestNotificationState(
  notification: Partial<Notification>,
  friendRequestsReceived?: string[],
  friends?: string[]
): FriendRequestNotificationState {
  const actorId = notification.actorId || notification.senderId || notification.entityId;

  if (!actorId || typeof actorId !== 'string') {
    return 'invalid';
  }

  if (notification.responseStatus === 'accepted' || (friends && friends.includes(actorId))) {
    return 'accepted';
  }

  if (notification.responseStatus === 'declined') {
    return 'declined';
  }

  if (notification.responseStatus === 'cancelled') {
    return 'cancelled';
  }

  if (friendRequestsReceived && friendRequestsReceived.includes(actorId)) {
    return 'pending';
  }

  return 'processed';
}

export interface PushTokenDoc {
  token: string;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastSeenAt: Timestamp;
}

export type KYCStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type CheckInStatus = 'pending' | 'scanned';

export interface Place {
  id: string;
  name: string;
  address: string;
  categories: string[];
  lat: number;
  lon: number;
  rating?: number;
  imageUrl?: string;
  activityCount?: number;
  distance?: number;
  relevanceScore?: number;
  isPromoted?: boolean;
  isSponsored?: boolean;
  affiliateUrl?: string;
  upvotes?: number;
  downvotes?: number;
  userVotes?: Record<string, 'up' | 'down'>;
  globalScore?: number;
  openingHours?: string | null;
  rankingContext?: any;
  voteBoostScore?: number;
  isFromFirestore?: boolean;
  qualityPenalty?: number;
  activityBoost?: number;
  isGenericName?: boolean;
  sourceType?: 'place' | 'activity';
  isUserEvent?: boolean;
  category?: string;
  normalizedCategory?: string;
  _rawProperties?: any;
}

export interface FavoritePlace {
  id: string;
  name: string;
  address: string;
  categories: string[];
  lat: number;
  lon: number;
  openingHours?: string | null;
}

export interface Activity {
  id?: string;
  placeId?: string;
  placeName: string;
  placeAddress?: string;
  lat?: number;
  lon?: number;
  title?: string;
  name?: string;
  locationLabel?: string;
  city?: string;
  postalCode?: string;
  address?: string;
  imageUrl?: string;
  activityDate: Timestamp;
  activityEndDate?: Timestamp;
  isTimeFlexible: boolean;
  isDateFlexible?: boolean;
  joinMode?: 'direct' | 'request';
  category?: string;
  hostId: string;
  hostName: string | null;
  hostUsername?: string | null;
  hostPhotoURL: string | null;
  participantIds: string[];
  maxParticipants?: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
  isCustomActivity?: boolean;
  lastInteractionAt?: Timestamp;
  categories?: string[];
  tags?: string[];
  status: 'active' | 'open' | 'completed' | 'cancelled' | 'blacklisted';
  completionVotes: string[];
  participantDetails: {
      [uid: string]: ParticipantDetailEntry;
  };
  participantsPreview?: ParticipantPreviewEntry[];
  kickedUserIds?: string[];
  isBoosted?: boolean;
  boostedAt?: Timestamp | null;
  isPaid?: boolean;
  price?: number;
  upvotes?: number;
  userVotes?: Record<string, 'up' | 'down'>;
  globalScore?: number;
  communityScore: number;
  voteBoostScore?: number;
  votedUserIds?: string[];
  isVerified?: boolean;
  reportCount?: number;
  avgRating?: number;
  reviewCount?: number;
  description?: string;
  requirements?: {
    ageRange?: { min?: number; max?: number };
    gender?: string[]; // e.g. ['male', 'female', 'diverse']
    requireProfilePicture?: boolean;
    requireVerification?: boolean; // KYC / verified identity
    minimumRating?: number;
  };
  stats?: {
    impressions?: number;
    pushJoins?: number;
    referralJoins?: number;
  };
  sourceType?: 'place' | 'activity';
  isUserEvent?: boolean;
  normalizedCategory?: string;
  creationSource?: 'community' | 'place_activity';
  placeCategories?: string[];
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string | null;
  senderUsername?: string | null;
  senderPhotoURL: string | null;
  sentAt: Timestamp | any;
  isPremium?: boolean;
  isSupporter?: boolean;
  isCreator?: boolean;
  replyToId?: string;
  replyToText?: string;
  replyToSenderName?: string;
  replyToSenderUsername?: string | null;
  isEdited?: boolean;
  editedAt?: Timestamp;
  isSystem?: boolean;
  systemType?: string;
  status?: 'sending' | 'sent' | 'failed';
}

export interface PinnedMessage {
  id: string;
  text: string;
  senderName: string;
  senderUsername?: string | null;
  pinnedAt?: Timestamp | Date;
}

export interface Chat {
    id: string;
    type?: 'direct' | 'activity';
    activityId?: string;
    placeId?: string;
    placeName?: string;
    categories?: string[];
    placeCategories?: string[];
    hostId?: string;
    hostName?: string | null;
    hostUsername?: string | null;
    participantIds: string[];
    participantDetails: {
        [uid: string]: ParticipantDetailEntry;
    };
    lastMessage: {
        text: string;
        senderId: string;
        senderName: string | null;
        senderUsername?: string | null;
        sentAt: Timestamp;
    } | null;
    createdAt: Timestamp;
    lastActivityAt?: Timestamp;
    unreadCount?: { [userId: string]: number };
    pinnedMessages?: PinnedMessage[];
    isUserEvent?: boolean;
    creationSource?: 'community' | 'place_activity';
    status?: 'active' | 'cancelled';
}

export interface GeoapifyFeature {
  properties: {
    name?: string;
    address_line1: string;
    address_line2: string;
    categories: string[] | string;
    lat: number;
    lon: number;
    place_id: string;
    distance?: number;
    opening_hours?: string;
    datasource: {
      raw: {
        rating?: string;
        ['building:part']?: string;
        memorial?: string;
        opening_hours?: string;
      };
    };
  };
}

export interface UserPreferences {
  likedTags: string[];
  dislikedTags: string[];
}

export interface NotificationPreferences {
  pushEnabled: boolean;
  soundEnabled: boolean;

  friendRequests: boolean;
  friendAccepted: boolean;

  chatMessages: boolean;
  activityRequests: boolean;

  activityParticipants: boolean;
  activityUpdates: boolean;
  activityReminders: boolean;

  nearbyActivities: boolean;
  nearbySpots?: boolean;
  recommendations: boolean;
  engagementReminders: boolean;

  // Legacy / backwards compatibility fields
  localHighlights?: boolean;
  nearbyFriendActivityNotifications?: boolean;
  activityInvites?: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: false,
  soundEnabled: true,

  friendRequests: true,
  friendAccepted: true,

  chatMessages: true,
  activityRequests: true,

  activityParticipants: true,
  activityUpdates: true,
  activityReminders: true,

  nearbyActivities: true,
  nearbySpots: true,
  recommendations: true,
  engagementReminders: true,

  localHighlights: false,
  nearbyFriendActivityNotifications: true,
  activityInvites: true,
};

export const NEARBY_SPOT_PUSH_DAILY_LIMIT = 3;

export function getEffectiveNotificationPreferences(userProfile?: UserProfile | null): NotificationPreferences {
  const settings = (userProfile?.notificationSettings as Partial<NotificationPreferences>) || {};
  return {
    pushEnabled: settings.pushEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled,
    soundEnabled: settings.soundEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.soundEnabled,
    friendRequests: settings.friendRequests ?? DEFAULT_NOTIFICATION_PREFERENCES.friendRequests,
    friendAccepted: settings.friendAccepted ?? DEFAULT_NOTIFICATION_PREFERENCES.friendAccepted,
    chatMessages: settings.chatMessages ?? DEFAULT_NOTIFICATION_PREFERENCES.chatMessages,
    activityRequests: settings.activityRequests ?? DEFAULT_NOTIFICATION_PREFERENCES.activityRequests,
    activityParticipants: settings.activityParticipants ?? DEFAULT_NOTIFICATION_PREFERENCES.activityParticipants,
    activityUpdates: settings.activityUpdates ?? DEFAULT_NOTIFICATION_PREFERENCES.activityUpdates,
    activityReminders: settings.activityReminders ?? DEFAULT_NOTIFICATION_PREFERENCES.activityReminders,
    nearbyActivities: settings.nearbyActivities ?? settings.nearbySpots ?? DEFAULT_NOTIFICATION_PREFERENCES.nearbyActivities,
    nearbySpots: settings.nearbySpots ?? settings.nearbyActivities ?? DEFAULT_NOTIFICATION_PREFERENCES.nearbySpots,
    recommendations: settings.recommendations ?? DEFAULT_NOTIFICATION_PREFERENCES.recommendations,
    engagementReminders: settings.engagementReminders ?? DEFAULT_NOTIFICATION_PREFERENCES.engagementReminders,
    localHighlights: settings.localHighlights ?? DEFAULT_NOTIFICATION_PREFERENCES.localHighlights,
    nearbyFriendActivityNotifications: settings.nearbyFriendActivityNotifications ?? DEFAULT_NOTIFICATION_PREFERENCES.nearbyFriendActivityNotifications,
    activityInvites: settings.activityInvites ?? DEFAULT_NOTIFICATION_PREFERENCES.activityInvites,
  };
}

export function getNotificationTargetUrl(notification: Partial<Notification>): string {
  if (notification.targetUrl) return notification.targetUrl;
  if (notification.link) return notification.link;

  switch (notification.type) {
    case 'friend_request':
    case 'friend_accepted':
      return '/profile';
    case 'chat_message':
    case 'chat_request':
      return notification.entityId ? `/chat/${notification.entityId}` : '/chat';
    case 'activity_invite':
    case 'activity_join_request':
    case 'activity_join_response':
    case 'join_request':
    case 'join_response':
    case 'activity_update':
    case 'activity_reminder':
    case 'friend_nearby_activity':
      return notification.activityId ? `/activities/${notification.activityId}` : (notification.entityId ? `/activities/${notification.entityId}` : '/');
    case 'nearby_spot':
      return notification.spotId ? `/map?spot=${notification.spotId}` : (notification.entityId ? `/map?spot=${notification.entityId}` : '/explore');
    case 'recommendation':
    case 'engagement_reminder':
      return '/explore';
    case 'system':
    default:
      return '/';
  }
}

export function normalizeNotification(rawDoc: any): Notification {
  const id = rawDoc.id || '';
  const recipientId = rawDoc.recipientId || '';
  const actorId = rawDoc.actorId || rawDoc.senderId || undefined;
  const entityId = rawDoc.entityId || rawDoc.activityId || rawDoc.spotId || undefined;
  const eventId = rawDoc.eventId || id;
  const type: NotificationType = rawDoc.type || 'system';
  const title = rawDoc.title || (type === 'friend_request' ? 'Freundschaftsanfrage' : 'Benachrichtigung');
  const body = rawDoc.body || rawDoc.message || '';
  const isRead = Boolean(rawDoc.isRead);
  const createdAt = rawDoc.createdAt || { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0, toDate: () => new Date() };
  const readAt = rawDoc.readAt || undefined;

  const targetUrl = getNotificationTargetUrl({
    targetUrl: rawDoc.targetUrl,
    link: rawDoc.link,
    type,
    entityId,
    activityId: rawDoc.activityId,
    spotId: rawDoc.spotId
  });

  return {
    ...rawDoc,
    id,
    recipientId,
    actorId,
    entityId,
    eventId,
    type,
    title,
    body,
    message: body,
    targetUrl,
    link: targetUrl,
    isRead,
    createdAt,
    readAt
  };
}

export function formatUnreadBadge(count: number): string {
  if (count <= 0) return '';
  if (count >= 100) return '99+';
  return String(count);
}

export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  age?: number;
  location?: string;
  bio?: string;
  interests?: string[];
  tinderInterests?: string[];
  likedTags: string[];
  dislikedTags: string[];
  categoryAffinities?: Record<string, number>;
  friends?: string[];
  friendRequestsSent?: string[];
  friendRequestsReceived?: string[];
  gender?: string;
  pronouns?: string;
  socialBattery?: string;
  notificationSettings?: Partial<NotificationPreferences>;
  proximitySettings?: {
    enabled: boolean;
    radiusKm: number;
  };
  lastLocation?: {
    lat: number;
    lng: number;
    city?: string | null;
    updatedAt: Timestamp;
  };
  fcmToken?: string | null;
  legalAcceptedAt?: Timestamp | null;
  termsAcceptedAt?: Timestamp | null;
  useTermsAcceptedAt?: Timestamp | null;
  privacyAcceptedAt?: Timestamp | null;
  cookiesAcceptedAt?: Timestamp | null;
  legalVersion?: string;
  legalLocale?: string;
  onboardingCompleted: boolean;
  username?: string | null;
  usernameLowercase?: string | null;
  usernameLastChangedAt?: Timestamp;
  usernameChangeHistory?: Timestamp[];
  birthday?: string;
  language?: 'de' | 'en';
  emailVerificationRequired?: boolean;
  emailVerificationProvider?: string;
  emailVerificationReason?: string;
  emailVerificationCreatedAt?: Timestamp | null;
  emailVerifiedAt?: Timestamp | null;
  verificationEmailLastSentAt?: Timestamp | null;
  hiddenEntityIds?: string[];
  activeTabs?: string[];
  isPremium?: boolean;
  isSupporter?: boolean;
  isCreator?: boolean;
  tokens?: number;
  successfulFreeHosts?: number;
  fiatBalance?: number;
  escrowBalance?: number;
  balancesInCents?: boolean;
  successfulReferrals?: number;
  pointsBalance?: number;
  pointsLifetime?: number;
  level?: number;
  equippedTitle?: string | null;
  equippedBorder?: string | null;
  referralCode?: string;
  referredBy?: string | null;
  averageRating?: number;
  ratingCount?: number;
  kycStatus?: KYCStatus;
  blacklist?: {
    soft: string[];
    hard: string[];
  };
  role?: 'user' | 'moderator' | 'admin' | 'superadmin' | 'supporter';
  isBanned?: boolean;
  accountStatus?: 'active' | 'suspended' | 'banned';
  suspendedUntil?: Timestamp | null;
  suspendedBy?: string | null;
  suspensionReasonPublic?: string | null;
  suspensionNoteInternal?: string | null;
  bannedAt?: Timestamp | null;
  bannedBy?: string | null;
  banReasonPublic?: string | null;
  banNoteInternal?: string | null;
  displayNameLower?: string;
  emailLower?: string;
  createdAt?: Timestamp | any;
  updatedAt?: Timestamp | any;
  isExplorer?: boolean;
  isOrganizer?: boolean;
  premiumTier?: 'tier1' | 'tier2' | 'tier3' | null;
  premiumEntitlements?: string[];
  premiumStartsAt?: Timestamp;
  premiumExpiresAt?: Timestamp | null;
  premiumSource?: string;
  premiumCampaignId?: string;
  communicationPreferences?: CommunicationPreferences;
}

export function getEffectiveCommunicationPreferences(profile: UserProfile | null): CommunicationPreferences {
  const prefs = profile?.communicationPreferences;
  return {
    emailRecommendations: prefs?.emailRecommendations ?? false,
    emailProductNews: prefs?.emailProductNews ?? false,
    emailMarketing: prefs?.emailMarketing ?? false,
    activityEmails: prefs?.activityEmails ?? true,
    marketingConsentAt: prefs?.marketingConsentAt ?? null,
    marketingConsentVersion: prefs?.marketingConsentVersion ?? null,
    marketingUnsubscribedAt: prefs?.marketingUnsubscribedAt ?? null,
  };
}

export type AccountStatus = 'active' | 'suspended' | 'banned';

/**
 * Single canonical calculation of the effective account status.
 * - 'banned': if isBanned === true or accountStatus === 'banned'
 * - 'suspended': if accountStatus === 'suspended' and suspendedUntil is in the future (> now)
 * - 'active': in all other cases (including active users, missing status, or expired suspensions)
 */
export function getEffectiveAccountStatus(profile: UserProfile | null, now?: Date | number): AccountStatus {
  if (!profile) return 'active';
  if (profile.isBanned || profile.accountStatus === 'banned') return 'banned';
  if (profile.accountStatus === 'suspended' && profile.suspendedUntil) {
    const suspendedMillis = parseTimestampMillis(profile.suspendedUntil);
    const currentMillis = now instanceof Date ? now.getTime() : (typeof now === 'number' ? now : Date.now());
    if (suspendedMillis !== null && suspendedMillis > currentMillis) {
      return 'suspended';
    }
  }
  return 'active';
}

/**
 * Helper to check if a user account is active (not banned and not currently suspended).
 */
export function isAccountActive(profile: UserProfile | null, now?: Date | number): boolean {
  return getEffectiveAccountStatus(profile, now) === 'active';
}

export type PremiumFeature =
  | 'advanced_filters'
  | 'extended_radius'
  | 'collections'
  | 'boost_tokens'
  | 'premium_badge'
  | 'ai_discovery'
  | 'organizer_analytics'
  | 'profile_visitors'
  | 'incognito_mode'
  | 'priority_join'
  | 'read_receipts'
  | 'co_hosts'
  | 'custom_banners'
  | 'passcode_events'
  | 'waitlist_management';

/**
 * Defensive helper to convert various timestamp forms (Firestore Timestamp, JS Date, number, ISO string)
 * into milliseconds since epoch. Returns null if invalid.
 */
export function parseTimestampMillis(ts: any): number | null {
  if (ts === null || ts === undefined) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return isNaN(ts) ? null : ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? null : parsed;
  }
  if (typeof ts === 'object' && typeof ts.seconds === 'number') {
    return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1000000);
  }
  return null;
}

/**
 * Central Helper to evaluate if user's premium status is currently active.
 * - Legacy permanent premium: isPremium === true and premiumExpiresAt is missing or null
 * - Temporary premium: isPremium === true and premiumExpiresAt > now
 */
export function isPremiumActive(profile: UserProfile | null, now?: Date | number): boolean {
  if (!profile || !profile.isPremium) return false;
  if (profile.premiumExpiresAt === undefined || profile.premiumExpiresAt === null) {
    return true; // Legacy permanent premium
  }
  const expiresMillis = parseTimestampMillis(profile.premiumExpiresAt);
  if (expiresMillis === null) return false;

  const currentMillis = now instanceof Date ? now.getTime() : (typeof now === 'number' ? now : Date.now());
  return expiresMillis > currentMillis;
}

export function hasPremiumFeature(profile: UserProfile | null, feature: PremiumFeature, now?: Date | number): boolean {
  if (!profile) return false;
  if (isPremiumActive(profile, now)) return true;
  return !!profile.premiumEntitlements?.includes(feature);
}

/**
 * Returns the binding participant limit for activity creation based on tier.
 * Hierarchy: Organizer Tier 3 / Role (50) -> Tier 2 (12) -> Tier 1 (8) -> Free (4)
 */
export function getParticipantLimit(profile: UserProfile | null, now?: Date | number): number {
  if (profile?.isOrganizer || profile?.premiumTier === 'tier3') return 50;
  if (isPremiumActive(profile, now)) {
    if (profile?.premiumTier === 'tier2') return 12;
    if (profile?.premiumTier === 'tier1') return 8;
    return 8; // Default active premium fallback
  }
  return 4;
}

/**
 * Returns the maximum number of concurrent open/active hosted rooms based on tier.
 * Free (5) -> Tier 1 (10) -> Tier 2 (25) -> Tier 3 / Organizer (50)
 */
export function getMaxOpenRoomsLimit(profile: UserProfile | null, now?: Date | number): number {
  if (profile?.isOrganizer || profile?.premiumTier === 'tier3') return 50;
  if (isPremiumActive(profile, now)) {
    if (profile?.premiumTier === 'tier2') return 25;
    if (profile?.premiumTier === 'tier1') return 10;
    return 10; // Default active premium fallback
  }
  return 5;
}


/**
 * Returns the maximum radar radius limit in km based on tier.
 * Free (10km) -> Tier 1 (30km) -> Tier 2 (50km) -> Tier 3 (100km)
 */
export function getRadarRadiusLimit(profile: UserProfile | null, now?: Date | number): number {
  if (profile?.premiumTier === 'tier3' || profile?.isOrganizer) return 100;
  if (isPremiumActive(profile, now)) {
    if (profile?.premiumTier === 'tier2') return 50;
    return 30; // Tier 1 or default active premium
  }
  return 10;
}

/**
 * Returns collection limits (maxCollections & maxItems per collection).
 * Free: 1 / 10 | Tier 1: 5 / 25 | Tier 2: 15 / 50 | Tier 3: 30 / 100
 */
export function getCollectionLimits(profile: UserProfile | null, now?: Date | number): { maxCollections: number; maxItems: number } {
  if (profile?.premiumTier === 'tier3' || profile?.isOrganizer) {
    return { maxCollections: 30, maxItems: 100 };
  }
  if (isPremiumActive(profile, now)) {
    if (profile?.premiumTier === 'tier2') {
      return { maxCollections: 15, maxItems: 50 };
    }
    return { maxCollections: 5, maxItems: 25 }; // Tier 1 or fallback
  }
  return { maxCollections: 1, maxItems: 10 };
}

/**
 * Returns monthly AI discovery request limit.
 * Free: 0 | Tier 1: 10 | Tier 2: 30 | Tier 3: 60
 */
export function getAiDiscoveryLimit(profile: UserProfile | null, now?: Date | number): number {
  if (profile?.premiumTier === 'tier3' || profile?.isOrganizer) return 60;
  if (isPremiumActive(profile, now)) {
    if (profile?.premiumTier === 'tier2') return 30;
    return 10;
  }
  return 0;
};

/**
 * Returns a human-readable expiration string if user has temporary active premium.
 */
export function formatPremiumExpiry(profile: UserProfile | null, language: 'de' | 'en' = 'de'): string | null {
  if (!profile || !profile.isPremium || !profile.premiumExpiresAt) return null;
  const expiresMillis = parseTimestampMillis(profile.premiumExpiresAt);
  if (expiresMillis === null) return null;

  const date = new Date(expiresMillis);
  if (isNaN(date.getTime())) return null;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return language === 'de' ? `${day}.${month}.${year}` : `${month}/${day}/${year}`;
}

export interface SavedCollection {
  id: string;
  name: string;
  places: string[];
  createdAt: any;
  updatedAt: any;
}

export interface Boost {
  id: string;
  userId: string;
  activityId?: string;
  placeId?: string;
  createdAt: any;
  expiresAt: any;
  boostLevel: 'standard' | 'high';
  multiplier: number;
}


export interface Review {
  id?: string;
  activityId: string;
  reviewerId: string;
  targetId: string;
  targetType: 'user' | 'activity';
  rating: number;
  comment?: string;
  createdAt: Timestamp;
}

export interface Refund {
  id: string;
  activityId: string;
  userId: string;
  amount: number;
  status: 'pending' | 'completed';
  createdAt: Timestamp;
  processedAt?: Timestamp;
}

export interface Report {
  id?: string;
  activityId?: string;
  reporterId: string;
  reportedEntityId?: string;
  entityType?: 'activity' | 'user';
  reason: string;
  status: 'pending' | 'resolved' | 'resolved_deleted' | 'rejected' | 'open' | 'moderation_review';
  createdAt: Timestamp;
  resolvedAt?: Timestamp;
}

export interface CreatorApplication {
  id: string;
  userId: string;
  userDisplayName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  averageRating: number;
  activitiesCount: number;
  ratingCount?: number;
}

export interface Destination {
    name: string;
    lat: number;
    lng: number;
    city?: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
    isManualLocation?: boolean;
}

export interface PlanningState {
    isPlanning: boolean;
    destination: Destination | null;
}
