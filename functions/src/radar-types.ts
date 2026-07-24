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
  precisionKm: number;
  updatedAt: any;
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

/**
 * Metric grid location obfuscation.
 * Divides coordinate space into a metric grid of ~2.0 km (0.018° lat, 0.030° lon at ~53°N).
 * Returns the exact center coordinate of the grid cell and conservative precisionKm = 2.0.
 * Guaranteed deterministic: Repeated queries for the exact same coordinate yield the exact same cell center.
 */
export function obfuscateMetricGridLocation(
  latitude: number,
  longitude: number
): { approximateLatitude: number; approximateLongitude: number; precisionKm: number } {
  // ~2.0 km grid step sizes
  const GRID_LAT_STEP = 0.018; // ~2.0 km latitude
  const GRID_LON_STEP = 0.030; // ~2.0 km longitude at mid-latitudes (~53°N)

  // Determine integer grid cell indices
  const latCellIndex = Math.floor(latitude / GRID_LAT_STEP);
  const lonCellIndex = Math.floor(longitude / GRID_LON_STEP);

  // Compute exact center of the grid cell
  const approxLat = Number(((latCellIndex + 0.5) * GRID_LAT_STEP).toFixed(6));
  const approxLon = Number(((lonCellIndex + 0.5) * GRID_LON_STEP).toFixed(6));

  return {
    approximateLatitude: approxLat,
    approximateLongitude: approxLon,
    precisionKm: 2.0,
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
