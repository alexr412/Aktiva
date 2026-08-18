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
  fallback = "Activa-Nutzer"
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
  const neutralFallback = language === 'de' ? 'Activa-Nutzer' : 'Activa user';
  
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

import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";

/**
 * Safely converts various date representation formats (Timestamp, Date, string, number) to a JS Date object or null.
 */
export function toDateObject(val: any): Date | null {
  if (!val) return null;
  if (typeof val.toDate === 'function') {
    const d = val.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val?.seconds === 'number') {
    const d = new Date(val.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'number' || typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Formats activity date range for UI display (e.g., Detail/Overview page).
 * Logic:
 * 1. Only start date exists -> show start date (e.g. "Di., 11. Aug.")
 * 2. Start and end date exist and are identical -> show date once (e.g. "Di., 11. Aug.")
 * 3. Start and end date exist and are different -> show range (e.g. "Mo., 20. Juli – Di., 11. Aug.")
 * 6. Does not hide end date due to `isTimeFlexible` or missing time.
 */
export function formatActivityDateRange(
  activityDate?: any,
  activityEndDate?: any,
  language: 'de' | 'en' = 'de'
): string {
  const start = toDateObject(activityDate);
  if (!start) return '';

  const locale = language === 'de' ? de : enUS;
  const startStr = format(start, 'eee, d. MMM', { locale });

  const end = toDateObject(activityEndDate);
  if (!end) {
    return startStr;
  }

  const endStr = format(end, 'eee, d. MMM', { locale });
  if (startStr === endStr) {
    return startStr;
  }

  return `${startStr} – ${endStr}`;
}

/**
 * Formats activity time for UI display:
 * 4. If activity is time-flexible -> "Flexibel" / "Flexible"
 * 5. If fixed time exists -> formatted time "HH:mm"
 */
export function formatActivityTimeDisplay(
  activityDate?: any,
  isTimeFlexible?: boolean,
  language: 'de' | 'en' = 'de'
): string {
  if (isTimeFlexible) {
    return language === 'de' ? 'Flexibel' : 'Flexible';
  }
  const start = toDateObject(activityDate);
  if (!start) {
    return language === 'de' ? 'Flexibel' : 'Flexible';
  }
  return format(start, 'HH:mm');
}


