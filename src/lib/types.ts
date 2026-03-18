'use client';

import type { Timestamp } from 'firebase/firestore';

export type ActivityCategory = 'Sport' | 'Tech' | 'Party' | 'Kultur' | 'Outdoor' | 'Gaming' | 'Networking' | 'Sonstiges';

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
}

export interface FavoritePlace {
  id: string;
  name: string;
  address: string;
  categories: string[];
  lat: number;
  lon: number;
}

export interface Activity {
  id?: string;
  placeId?: string;
  placeName: string;
  placeAddress?: string;
  lat?: number;
  lon?: number;
  activityDate: Timestamp;
  activityEndDate?: Timestamp;
  isTimeFlexible?: boolean;
  hostId: string;
  hostName: string | null;
  hostPhotoURL: string | null;
  participantIds: string[];
  maxParticipants?: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  isCustomActivity?: boolean;
  lastInteractionAt?: Timestamp;
  category?: ActivityCategory;
  categories?: string[];
  tags?: string[];
  status: 'active' | 'open' | 'completed' | 'cancelled' | 'blacklisted';
  completionVotes: string[];
  participantDetails: {
      [uid: string]: {
          displayName: string | null;
          photoURL: string | null;
          isPremium?: boolean;
          isSupporter?: boolean;
          checkInStatus?: CheckInStatus;
          checkInTime?: Timestamp;
          hasReviewed?: boolean;
      }
  };
  participantsPreview?: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  }[];
  isBoosted?: boolean;
  boostedAt?: Timestamp | null;
  isPaid?: boolean;
  price?: number;
  upvotes?: number;
  downvotes?: number;
  userVotes?: Record<string, 'up' | 'down'>;
  globalScore?: number;
  isVerified?: boolean;
  reportCount?: number;
  avgRating?: number;
  reviewCount?: number;
  stats?: {
    impressions?: number;
    pushJoins?: number;
    referralJoins?: number;
  };
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string | null;
  senderPhotoURL: string | null;
  sentAt: Timestamp;
  isPremium?: boolean;
  isSupporter?: boolean;
}

export interface Chat {
    id: string;
    activityId?: string;
    placeName?: string;
    hostId?: string;
    participantIds: string[];
    participantDetails: {
        [uid: string]: {
            displayName: string | null;
            photoURL: string | null;
            isPremium?: boolean;
            isSupporter?: boolean;
            checkInStatus?: CheckInStatus;
            checkInTime?: Timestamp;
        }
    };
    lastMessage: {
        text: string;
        senderName: string | null;
        sentAt: Timestamp;
    } | null;
    createdAt: Timestamp;
    unreadCount?: { [userId: string]: number };
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
    datasource: {
      raw: {
        rating?: string;
        ['building:part']?: string;
        memorial?: string;
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
  };
  proximitySettings?: {
    enabled: boolean;
    radiusKm: number;
  };
  lastLocation?: {
    lat: number;
    lng: number;
    updatedAt: Timestamp;
  };
  fcmToken?: string;
  onboardingCompleted: boolean;
  friendCode?: string;
  hiddenEntityIds?: string[];
  activeTabs?: string[];
  isPremium?: boolean;
  isSupporter?: boolean;
  isCreator?: boolean;
  tokens?: number;
  successfulFreeHosts?: number;
  fiatBalance?: number;
  escrowBalance?: number;
  successfulReferrals?: number;
  averageRating?: number;
  ratingCount?: number;
  kycStatus?: KYCStatus;
  isAdmin?: boolean;
  role?: 'user' | 'admin';
  isBanned?: boolean;
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
}

export interface PlanningState {
    isPlanning: boolean;
    destination: Destination | null;
}
