import type { Place, Activity } from '@/lib/types';
import type { ActivityCapacityStatus, MapMarkerItem } from './map-types';

/**
 * Validates latitude and longitude coordinates.
 */
export function isValidCoordinate(lat?: any, lon?: any): boolean {
  const parsedLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const parsedLon = typeof lon === 'number' ? lon : parseFloat(lon);
  return (
    !isNaN(parsedLat) &&
    !isNaN(parsedLon) &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLon >= -180 &&
    parsedLon <= 180
  );
}

/**
 * Calculates activity capacity status centrally:
 * - 'full': participantIds.length >= maxParticipants
 * - 'almost_full': remaining slots <= 2 (and not full)
 * - 'open': otherwise
 */
export function calculateActivityCapacityStatus(activity: Activity): ActivityCapacityStatus {
  const max = activity.maxParticipants ?? 4;
  const count = activity.participantIds?.length ?? (activity.participantsPreview?.length || 1);

  if (count >= max) {
    return 'full';
  }
  if (max - count <= 2) {
    return 'almost_full';
  }
  return 'open';
}

/**
 * Converts already-filtered Places array into MapMarkerItems with valid coordinates.
 */
export function parsePlaceMarkers(places: Place[]): MapMarkerItem[] {
  if (!Array.isArray(places)) return [];

  const markers: MapMarkerItem[] = [];

  for (const place of places) {
    const lat = place.lat;
    const lon = place.lon ?? (place as any).lng;

    if (!isValidCoordinate(lat, lon)) {
      continue;
    }

    markers.push({
      id: place.id,
      type: 'place',
      title: place.name || 'Ort',
      lat,
      lon,
      category: place.categories?.[0] || place.category || 'Standard',
      categories: place.categories || [],
      isBoosted: !!(place.isPromoted || place.isSponsored || place.activityBoost),
      rawItem: place,
    });
  }

  return markers;
}

/**
 * Converts already-filtered Activities array into MapMarkerItems with valid coordinates.
 */
export function parseActivityMarkers(activities: Activity[]): MapMarkerItem[] {
  if (!Array.isArray(activities)) return [];

  const markers: MapMarkerItem[] = [];

  for (const act of activities) {
    // Exclude cancelled or non-active activities
    if (act.status && act.status !== 'active') {
      continue;
    }

    const lat = act.lat;
    const lon = act.lon ?? (act as any).lng;

    if (!isValidCoordinate(lat, lon)) {
      continue;
    }

    const capacityStatus = calculateActivityCapacityStatus(act);
    const count = act.participantIds?.length ?? (act.participantsPreview?.length || 1);
    const max = act.maxParticipants ?? 4;

    markers.push({
      id: act.id || `act_${Math.random().toString(36).substr(2, 9)}`,
      type: 'activity',
      title: act.title || act.name || act.placeName || 'Aktivität',
      lat: lat!,
      lon: lon!,
      capacityStatus,
      isBoosted: !!act.isBoosted,
      participantCount: count,
      maxParticipants: max,
      rawItem: act,
    });
  }

  return markers;
}

/**
 * Generates GeoJSON FeatureCollection for MapLibre Native Layer rendering.
 */
export function createMapGeoJSON(markers: MapMarkerItem[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = markers.map((item) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [item.lon, item.lat], // [longitude, latitude] per GeoJSON spec
    },
    properties: {
      id: item.id,
      type: item.type,
      title: item.title,
      category: item.category || 'Standard',
      capacityStatus: item.capacityStatus || 'open',
      isBoosted: item.isBoosted ? 1 : 0,
      participantCount: item.participantCount || 1,
      maxParticipants: item.maxParticipants || 4,
    },
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

import type { NearbyFriend } from '@/hooks/use-friend-radar';

export function generateCircleCoordinates(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  points = 64
): [number, number][] {
  const coordinates: [number, number][] = [];
  const earthRadiusKm = 6371;
  const latRad = (centerLat * Math.PI) / 180;
  const lonRad = (centerLon * Math.PI) / 180;

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 360) / points;
    const bearingRad = (bearing * Math.PI) / 180;

    const pointLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(radiusKm / earthRadiusKm) +
        Math.cos(latRad) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(bearingRad)
    );

    const pointLonRad =
      lonRad +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(radiusKm / earthRadiusKm) * Math.cos(latRad),
        Math.cos(radiusKm / earthRadiusKm) - Math.sin(latRad) * Math.sin(pointLatRad)
      );

    const pointLat = (pointLatRad * 180) / Math.PI;
    const pointLon = (pointLonRad * 180) / Math.PI;

    coordinates.push([pointLon, pointLat]);
  }
  return coordinates;
}

/**
 * Generates a GeoJSON polygon feature representing a radius circle around a center coordinate.
 */
export function createRadiusCircleGeoJSON(
  centerLat: number,
  centerLon: number,
  radiusKm: number
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const coordinates = generateCircleCoordinates(centerLat, centerLon, radiusKm);
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
        properties: {
          radiusKm,
        },
      },
    ],
  };
}

/**
 * Generates GeoJSON FeatureCollection for MapLibre Native Layer rendering of friends.
 * Contains both Polygon cell circles and Point cell centers.
 */
export function createFriendsGeoJSON(
  friends: NearbyFriend[]
): GeoJSON.FeatureCollection<GeoJSON.Geometry> {
  const features: GeoJSON.Feature<GeoJSON.Geometry>[] = [];

  for (const friend of friends) {
    const lat = friend.approximateLatitude;
    const lon = friend.approximateLongitude;
    if (!isValidCoordinate(lat, lon)) continue;

    // 1. Polygon representing cell uncertainty
    const coordinates = generateCircleCoordinates(lat, lon, friend.precisionKm || 2.0);
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates],
      },
      properties: {
        type: 'friend-area',
        userId: friend.userId,
        username: friend.username,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl,
        distanceBucket: friend.distanceBucket,
        updatedAt: friend.updatedAt,
      },
    });

    // 2. Point representing cell center
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat],
      },
      properties: {
        type: 'friend-point',
        userId: friend.userId,
        username: friend.username,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl,
        distanceBucket: friend.distanceBucket,
        updatedAt: friend.updatedAt,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
