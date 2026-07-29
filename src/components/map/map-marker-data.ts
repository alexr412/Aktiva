import type { Place, Activity } from '@/lib/types';
import type { ActivityCapacityStatus, MapMarkerItem } from './map-types';
import { getFirstName, normalizePrecisionMeters, formatDistanceBucketText } from '../../lib/radar-types';

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
  const coords: [number, number][] = [];
  const kmInLat = 111.32;
  const kmInLon = 111.32 * Math.cos((centerLat * Math.PI) / 180);

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const dLat = (radiusKm * Math.sin(theta)) / kmInLat;
    const dLon = (radiusKm * Math.cos(theta)) / kmInLon;
    coords.push([centerLon + dLon, centerLat + dLat]);
  }
  coords.push(coords[0]); // Close polygon
  return coords;
}

/**
 * Generates GeoJSON FeatureCollection for radius circle visualization.
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

export interface PositionedFriend {
  friend: NearbyFriend;
  renderLat: number;
  renderLng: number;
}

export function applyGridOffset(friends: NearbyFriend[]): PositionedFriend[] {
  if (!Array.isArray(friends)) return [];
  const cellGroups = new Map<string, NearbyFriend[]>();
  for (const f of friends) {
    if (!f || typeof f !== 'object') continue;
    const lat = Number(f.approximateLatitude || 0);
    const lng = Number(f.approximateLongitude || 0);
    const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
    const group = cellGroups.get(key) || [];
    group.push(f);
    cellGroups.set(key, group);
  }

  const result: PositionedFriend[] = [];

  for (const [_, group] of cellGroups.entries()) {
    if (group.length === 1) {
      result.push({
        friend: group[0],
        renderLat: Number(group[0].approximateLatitude || 0),
        renderLng: Number(group[0].approximateLongitude || 0),
      });
    } else {
      const count = group.length;
      const offsetRadiusMeters = 18;
      const dLatStep = offsetRadiusMeters / 111320;

      group.forEach((f, idx) => {
        const angle = (2 * Math.PI * idx) / count;
        const lat = Number(f.approximateLatitude || 0);
        const lng = Number(f.approximateLongitude || 0);
        const cosLat = Math.max(0.01, Math.cos((lat * Math.PI) / 180));
        const dLonStep = offsetRadiusMeters / (111320 * cosLat);

        const renderLat = Number((lat + dLatStep * Math.sin(angle)).toFixed(6));
        const renderLng = Number((lng + dLonStep * Math.cos(angle)).toFixed(6));

        result.push({
          friend: f,
          renderLat,
          renderLng,
        });
      });
    }
  }

  return result;
}

/**
 * Generates GeoJSON FeatureCollection for MapLibre Native Layer rendering of friends.
 * Contains both Polygon cell circles and Point cell centers.
 */
export function createFriendsGeoJSON(
  friends: NearbyFriend[]
): GeoJSON.FeatureCollection<GeoJSON.Geometry> {
  const features: GeoJSON.Feature<GeoJSON.Geometry>[] = [];
  const positionedFriends = applyGridOffset(friends);

  for (const posFriend of positionedFriends) {
    const friend = posFriend.friend;
    const lat = friend.approximateLatitude;
    const lon = friend.approximateLongitude;
    if (!isValidCoordinate(lat, lon)) continue;

    const precM = normalizePrecisionMeters(friend);
    const radiusKm = precM / 1000;
    const firstName = getFirstName(friend.displayName, friend.username);

    // 1. Polygon representing precisionMeters uncertainty grid cell
    const coordinates = generateCircleCoordinates(lat, lon, radiusKm);
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
        displayName: friend.displayName || friend.username,
        firstName,
        avatarUrl: friend.avatarUrl,
        distanceBucket: friend.distanceBucket,
        distanceBucketText: formatDistanceBucketText(friend.distanceBucket),
        precisionMeters: precM,
        updatedAt: friend.updatedAt,
      },
    });

    // 2. Point representing cell center (positioned with offset if multiple friends in same cell)
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [posFriend.renderLng, posFriend.renderLat],
      },
      properties: {
        type: 'friend-point',
        userId: friend.userId,
        username: friend.username,
        displayName: friend.displayName || friend.username,
        firstName,
        avatarUrl: friend.avatarUrl,
        distanceBucket: friend.distanceBucket,
        distanceBucketText: formatDistanceBucketText(friend.distanceBucket),
        precisionMeters: precM,
        updatedAt: friend.updatedAt,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}
