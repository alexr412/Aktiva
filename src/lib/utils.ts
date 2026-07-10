import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Global strict formatting rule for all system labels and tags.
 * Ensures uppercase, no underscores, and consistent spacing.
 */
export function formatLabel(label: string | undefined | null): string {
  if (!label) return "";
  
  return label
    .toString()
    .replace(/_/g, " ") // Block underscores
    .replace(/([a-z])([A-Z])/g, "$1 $2") // Handle camelCase
    .replace(/\./g, " ") // Block dots (for category paths)
    .toUpperCase()
    .trim();
}

export function formatFirstName(
  name?: string | null,
  fallback = "User"
): string {
  const trimmed = name?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.split(/\s+/)[0] || fallback;
}

import type { ParticipantDetailEntry } from '@/lib/types';

export function formatPublicUsername(
  username?: string | null,
  fallback = "Aktiva-Nutzer"
): string {
  if (username) {
    const clean = username.trim().replace(/^@/, '');
    if (clean) return `@${clean}`;
  }
  return fallback;
}

export function resolvePublicUsername({
  uid,
  participantDetails,
  currentUserProfile,
  otherUser,
  language = 'de'
}: {
  uid: string;
  participantDetails?: Record<string, ParticipantDetailEntry> | null;
  currentUserProfile?: any;
  otherUser?: any;
  language?: 'de' | 'en';
}): string {
  const neutralFallback = language === 'de' ? 'Aktiva-Nutzer' : 'Aktiva user';
  
  if (currentUserProfile && uid === currentUserProfile.uid) {
    if (currentUserProfile.username) {
      return `@${currentUserProfile.username.trim().replace(/^@/, '')}`;
    }
    return neutralFallback;
  }
  
  if (otherUser && uid === otherUser.uid) {
    if (otherUser.username) {
      return `@${otherUser.username.trim().replace(/^@/, '')}`;
    }
    return neutralFallback;
  }
  
  if (participantDetails?.[uid]?.username) {
    return `@${participantDetails[uid].username!.trim().replace(/^@/, '')}`;
  }
  
  return neutralFallback;
}

