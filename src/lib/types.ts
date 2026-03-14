'use client';

import type { Timestamp } from 'firebase/firestore';

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
  // Monetization fields
  isPromoted?: boolean; // B2B sponsored
  isSponsored?: boolean; // Used for golden marker / top rank
  affiliateUrl?: string;
  // Voting fields
  upvotes?: number;
  downvotes?: number;
  userVotes?: Record<string, 'up' | 'down'>;
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
  creatorId: string;
  creatorName: string | null;
  creatorPhotoURL: string | null;
  participantIds: string[];
  maxParticipants?: number;
  createdAt: Timestamp;
  isCustomActivity?: boolean;
  lastInteractionAt?: Timestamp;
  category?: string;
  categories?: string[];
  status: 'active' | 'open' | 'completed' | 'cancelled';
  completionVotes: string[];
  participantDetails: {
      [uid: string]: {
          displayName: string | null;
          photoURL: string | null;
          isPremium?: boolean;
          isSupporter?: boolean;
      }
  };
  // Modul 5: Premium Vorschau (Denormalisiert)
  participantsPreview?: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  }[];
  // Monetization fields
  isBoosted?: boolean;
  boostedAt?: Timestamp | null;
  boostExpiresAt?: Timestamp;
  // Micro-Ticketing
  isPaid?: boolean;
  price?: number;
  // RBAC & Voting fields
  upvotes?: number;
  downvotes?: number;
  userVotes?: Record<string, 'up' | 'down'>;
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
    creatorId?: string;
    participantIds: string[];
    participantDetails: {
        [uid: string]: {
            displayName: string | null;
            photoURL: string | null;
            isPremium?: boolean;
            isSupporter?: boolean;
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
  friends?: string[];
  friendRequestsSent?: string[];
  friendRequestsReceived?: string[];
  gender?: string;
  pronouns?: string;
  languages?: string[];
  dietaryPreferences?: string[];
  socialBattery?: string;
  notificationSettings?: {
    friendRequests: boolean;
    activityInvites: boolean;
    chatMessages: boolean;
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
  verified?: boolean;
  onboardingCompleted: boolean;
  friendCode?: string;
  hiddenEntityIds?: string[];
  activeTabs?: string[];
  // Monetization fields
  isPremium?: boolean;
  isSupporter?: boolean;
  tokens?: number;
  successfulFreeHosts?: number;
  // RBAC fields
  isAdmin?: boolean;
}

export interface Review {
  id?: string;
  activityId: string;
  reviewerId: string;
  targetUserId: string;
  rating: number; // 1-5
  text?: string;
  createdAt: Timestamp;
}

export interface Notification {
    id: string;
    recipientId: string;
    senderId: string;
    senderProfile?: {
        displayName: string | null;
        photoURL: string | null;
    };
    type: 'friend_request' | 'activity_invite' | 'proximity_alert';
    isRead: boolean;
    createdAt: Timestamp;
    referenceId?: string;
}

export interface Report {
  id?: string;
  reporterId: string;
  reportedEntityId: string;
  entityType: 'activity' | 'user';
  reason: string;
  status: 'pending' | 'resolved';
  createdAt: Timestamp;
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
