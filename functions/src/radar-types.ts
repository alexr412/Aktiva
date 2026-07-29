/**
 * Runtime-Neutral Shared Radar Types & Pure Functions for Backend / Functions.
 * Contains ZERO Next.js or Firebase Client SDK imports.
 */

export const CURRENT_RADAR_CONSENT_VERSION = 'v1.0';

export interface RadarSettingsData {
  enabled: boolean;
  radiusKm: number;
  consentVersion: string;
  consentedAt: any | null;
  updatedAt: any;
}

export interface RadarLocationData {
  latitude: number;
  longitude: number;
  updatedAt: any;
  expiresAt: any;
}

export type DistanceBucket =
  | 'under_1_km'
  | '1_to_2_km'
  | '2_to_5_km'
  | '5_to_10_km'
  | '10_to_25_km';

export interface ObfuscatedNearbyFriend {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  distanceBucket: DistanceBucket;
  approximateLatitude: number;
  approximateLongitude: number;
  precisionMeters: number;
  precisionKm?: number;
  updatedAt?: any;
}

/**
 * Calculates Haversine distance in kilometers between two coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Categorizes distance in kilometers into deterministic distance buckets.
 */
export function calculateDistanceBucket(distanceKm: number): DistanceBucket {
  if (distanceKm < 1.0) return 'under_1_km';
  if (distanceKm < 2.0) return '1_to_2_km';
  if (distanceKm < 5.0) return '2_to_5_km';
  if (distanceKm < 10.0) return '5_to_10_km';
  return '10_to_25_km';
}

export function getFirstName(displayName?: string, username?: string): string {
  const normalizedName = displayName?.trim();
  if (normalizedName) {
    return normalizedName.split(/\s+/)[0];
  }
  return username?.trim() || 'Freund';
}

export function calculatePrecisionMeters(accuracy?: number): number {
  if (
    typeof accuracy !== 'number' ||
    !Number.isFinite(accuracy) ||
    accuracy <= 0 ||
    accuracy > 10000
  ) {
    return 250;
  }
  return Math.max(100, Math.ceil(accuracy / 25) * 25);
}

export function quantizeCoordinates(
  latitude: number,
  longitude: number,
  precisionMeters: number
): { approximateLatitude: number; approximateLongitude: number; precisionMeters: number } {
  const safeLat = Math.max(-89.9, Math.min(89.9, latitude));
  const latitudeStep = precisionMeters / 111_320;
  const cosLat = Math.max(0.01, Math.cos((safeLat * Math.PI) / 180));
  const longitudeStep = precisionMeters / (111_320 * cosLat);

  let approxLat = Math.round(latitude / latitudeStep) * latitudeStep;
  let approxLon = Math.round(longitude / longitudeStep) * longitudeStep;

  approxLat = Number(approxLat.toFixed(6));
  approxLon = Number(approxLon.toFixed(6));

  approxLat = Math.max(-90, Math.min(90, approxLat));
  approxLon = Math.max(-180, Math.min(180, approxLon));

  return {
    approximateLatitude: approxLat,
    approximateLongitude: approxLon,
    precisionMeters,
  };
}

/**
 * Metric grid location obfuscation (legacy fallback).
 */
export function obfuscateMetricGridLocation(
  latitude: number,
  longitude: number,
  accuracy?: number
): { approximateLatitude: number; approximateLongitude: number; precisionMeters: number; precisionKm: number } {
  const precisionMeters = calculatePrecisionMeters(accuracy);
  const { approximateLatitude, approximateLongitude } = quantizeCoordinates(latitude, longitude, precisionMeters);
  return {
    approximateLatitude,
    approximateLongitude,
    precisionMeters,
    precisionKm: precisionMeters / 1000,
  };
}

/**
 * Evaluates server-side Radar access permission:
 * User has access if `isOrganizer === true` or active Premium (`isPremiumActive`).
 */
export function hasRadarAccessPermission(userProfile: any, now: Date = new Date()): boolean {
  if (!userProfile) return false;
  if (userProfile.isOrganizer === true) return true;

  // Active premium check
  if (!userProfile.isPremium) return false;

  if (!userProfile.premiumExpiresAt) {
    return true; // Lifetime/permanent premium
  }

  const expiresAtMs =
    typeof userProfile.premiumExpiresAt.toMillis === 'function'
      ? userProfile.premiumExpiresAt.toMillis()
      : typeof userProfile.premiumExpiresAt === 'number'
      ? userProfile.premiumExpiresAt
      : new Date(userProfile.premiumExpiresAt).getTime();

  return !isNaN(expiresAtMs) && expiresAtMs > now.getTime();
}
