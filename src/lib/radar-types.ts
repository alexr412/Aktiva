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
  precisionMeters: number;
  precisionKm?: number;
  updatedAt?: any;
}

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
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

export function getFirstName(displayName?: string, username?: string): string {
  const normalizedName = displayName?.trim();
  if (normalizedName) {
    return normalizedName.split(/\s+/)[0];
  }
  return username?.trim() || 'Freund';
}

export function normalizePrecisionMeters(friend: any): number {
  if (friend && typeof friend === 'object') {
    if (Number.isFinite(friend.precisionMeters) && friend.precisionMeters > 0) {
      return friend.precisionMeters;
    }
    if (Number.isFinite(friend.precisionKm) && friend.precisionKm > 0) {
      return friend.precisionKm * 1000;
    }
  }
  return 250;
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

export function formatDistanceBucketText(bucket?: string, lang: 'de' | 'en' = 'de'): string {
  switch (bucket) {
    case 'under_1_km':
      return lang === 'de' ? 'Unter 1 km entfernt' : 'Under 1 km away';
    case '1_to_2_km':
      return lang === 'de' ? '1–2 km entfernt' : '1–2 km away';
    case '2_to_5_km':
      return lang === 'de' ? '2–5 km entfernt' : '2–5 km away';
    case '5_to_10_km':
      return lang === 'de' ? '5–10 km entfernt' : '5–10 km away';
    case '10_to_25_km':
      return lang === 'de' ? '10–25 km entfernt' : '10–25 km away';
    default:
      return lang === 'de' ? 'In der Nähe' : 'Nearby';
  }
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
