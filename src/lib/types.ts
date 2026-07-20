'use client';

import type { Timestamp } from 'firebase/firestore';

export type ActivityCategory = 'Sport' | 'Tech' | 'Party' | 'Kultur' | 'Outdoor' | 'Gaming' | 'Networking' | 'Sonstiges' | 'Other';

export interface PublicUserProfile {
  uid: string;
  username: string;
  photoURL: string | null;
  isPremium?: boolean;
  isSupporter?: boolean;
  isCreator?: boolean;
  age?: number;
  location?: string;
  bio?: string;
  interests?: string[];
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

export interface NotificationSenderProfile {
  displayName?: string;
  photoURL?: string;
  username?: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName?: string;
  senderProfile?: NotificationSenderProfile;
  type: 'friend_request' | 'activity_invite' | 'system' | 'join_request' | 'join_response' | 'friend_nearby_activity';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Timestamp;
  link?: string;
  activityId?: string;
  customMessage?: string;
  responseStatus?: 'accepted' | 'declined';
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
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string | null;
  senderUsername?: string | null;
  senderPhotoURL: string | null;
  sentAt: Timestamp;
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
    placeName?: string;
    categories?: string[];
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
  notificationSettings?: {
    friendRequests: boolean;
    activityInvites: boolean;
    chatMessages: boolean;
    localHighlights: boolean;
    nearbyFriendActivityNotifications?: boolean;
  };
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
  referralCode?: string;
  referredBy?: string | null;
  averageRating?: number;
  ratingCount?: number;
  kycStatus?: KYCStatus;
  blacklist?: {
    soft: string[];
    hard: string[];
  };
  role?: 'user' | 'admin' | 'supporter';
  isBanned?: boolean;
  isExplorer?: boolean;
  isOrganizer?: boolean;
  premiumEntitlements?: string[];
  premiumStartsAt?: Timestamp;
  premiumExpiresAt?: Timestamp | null;
  premiumSource?: string;
  premiumCampaignId?: string;
}

export type PremiumFeature =
  | 'advanced_filters'
  | 'extended_radius'
  | 'collections'
  | 'boost_tokens'
  | 'premium_badge'
  | 'ai_discovery'
  | 'organizer_analytics';

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
 * Returns the binding participant limit for activity creation.
 * Hierarchy: 1. Organizer (50) -> 2. Active Premium (12) -> 3. Free (4)
 */
export function getParticipantLimit(profile: UserProfile | null, now?: Date | number): number {
  if (profile?.isOrganizer) return 50;
  if (isPremiumActive(profile, now)) return 12;
  return 4;
}

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
