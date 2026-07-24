/**
 * Shared Client-Side Radar Types & Pure Helpers.
 * Clean, runtime-neutral exports for frontend UI components and hooks.
 */

export const CURRENT_RADAR_CONSENT_VERSION = 'v1.0';

export interface RadarSettings {
  enabled: boolean;
  radiusKm: number;
  consentVersion: string;
  consentedAt: any | null;
  updatedAt: any;
}

export interface RadarLocation {
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

export interface NearbyFriend {
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

export function calculateDistanceBucket(distanceKm: number): DistanceBucket {
  if (distanceKm < 1.0) return 'under_1_km';
  if (distanceKm < 2.0) return '1_to_2_km';
  if (distanceKm < 5.0) return '2_to_5_km';
  if (distanceKm < 10.0) return '5_to_10_km';
  return '10_to_25_km';
}

export function obfuscateMetricGridLocation(
  latitude: number,
  longitude: number
): { approximateLatitude: number; approximateLongitude: number; precisionKm: number } {
  const GRID_LAT_STEP = 0.018;
  const GRID_LON_STEP = 0.030;

  const latCellIndex = Math.floor(latitude / GRID_LAT_STEP);
  const lonCellIndex = Math.floor(longitude / GRID_LON_STEP);

  const approxLat = Number(((latCellIndex + 0.5) * GRID_LAT_STEP).toFixed(6));
  const approxLon = Number(((lonCellIndex + 0.5) * GRID_LON_STEP).toFixed(6));

  return {
    approximateLatitude: approxLat,
    approximateLongitude: approxLon,
    precisionKm: 2.0,
  };
}
