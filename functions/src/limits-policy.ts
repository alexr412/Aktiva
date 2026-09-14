/**
 * Server-side Limit & Tier Policy Module for Cloud Functions.
 * Self-contained without relative imports outside functions/src to ensure deployability.
 */

export interface UserProfileData {
  isOrganizer?: boolean;
  premiumTier?: 'free' | 'tier1' | 'tier2' | 'tier3';
  isPremium?: boolean;
  premiumUntil?: any;
  tempPremiumUntil?: any;
  [key: string]: any;
}

export function parseTimestampMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export function isPremiumActive(profile: UserProfileData | null | undefined, now?: Date | number): boolean {
  if (!profile || !profile.isPremium) return false;
  const nowMs = typeof now === 'number' ? now : (now instanceof Date ? now.getTime() : Date.now());

  const expiry = profile.premiumExpiresAt !== undefined ? profile.premiumExpiresAt : profile.premiumUntil;
  if (expiry === undefined || expiry === null) return true;
  const expiresMillis = parseTimestampMillis(expiry);
  return expiresMillis !== null && expiresMillis > nowMs;
}

export function getParticipantLimit(profile: UserProfileData | null | undefined, now?: Date | number): number {
  if (profile?.isOrganizer || profile?.premiumTier === 'tier3') return 50;
  if (isPremiumActive(profile, now)) {
    if (profile?.premiumTier === 'tier2') return 12;
    if (profile?.premiumTier === 'tier1') return 8;
    return 8; // Default active premium fallback
  }
  return 4;
}

export function getMaxOpenRoomsLimit(profile: UserProfileData | null | undefined, now?: Date | number): number {
  if (profile?.isOrganizer || profile?.premiumTier === 'tier3') return 50;
  if (isPremiumActive(profile, now)) {
    if (profile?.premiumTier === 'tier2') return 25;
    if (profile?.premiumTier === 'tier1') return 10;
    return 10; // Default active premium fallback
  }
  return 5;
}

export function getRadarRadiusLimit(profile: UserProfileData | null | undefined, now?: Date | number): number {
  if (profile?.premiumTier === 'tier3' || profile?.isOrganizer) return 100;
  if (isPremiumActive(profile, now)) {
    if (profile?.premiumTier === 'tier2') return 50;
    return 30; // Tier 1 or default active premium
  }
  return 10;
}
