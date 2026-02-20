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
}

export interface Activity {
  id?: string;
  placeId?: string;
  placeName: string;
  placeAddress?: string;
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
  status: 'active' | 'completed';
  completionVotes: string[];
  participantDetails: {
      [uid: string]: {
          displayName: string | null;
          photoURL: string | null;
      }
  };
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string | null;
  senderPhotoURL: string | null;
  sentAt: Timestamp;
}

export interface Chat {
    id: string;
    activityId: string;
    placeName: string;
    creatorId?: string;
    participantIds: string[];
    participantDetails: {
        [uid: string]: {
            displayName: string | null;
            photoURL: string | null;
        }
    };
    lastMessage: {
        text: string;
        senderName: string | null;
        sentAt: Timestamp;
    } | null;
    createdAt: Timestamp;
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
      };
    };
  };
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
  verified?: boolean;
  onboardingCompleted: boolean;
  friendCode?: string;
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
    type: 'friend_request' | 'activity_invite';
    isRead: boolean;
    createdAt: Timestamp;
    referenceId?: string;
}
