import type { Place, Activity } from '@/lib/types';
import type { ActivityCapacityStatus, MapMarkerItem } from './map-types';
import { getFirstName, normalizePrecisionMeters, formatDistanceBucketText } from '../../lib/radar-types';
import { getActivityActionStatus } from '../../lib/activity-action-state';

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

/**
 * Escapes HTML characters to prevent XSS in dynamic popups.
 */
export function escapeHTML(str?: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats activity date and time string cleanly.
 */
export function formatActivityDateTime(activityDate?: any, isTimeFlexible?: boolean, lang: 'de' | 'en' = 'de'): string {
  if (!activityDate) return lang === 'de' ? 'Datum nach Absprache' : 'Flexible date';
  const date = activityDate.toDate ? activityDate.toDate() : new Date(activityDate);
  if (isNaN(date.getTime())) return lang === 'de' ? 'Datum nach Absprache' : 'Flexible date';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return lang === 'de' ? `Heute · ${timeStr}` : `Today · ${timeStr}`;
  }
  if (isTomorrow) {
    return lang === 'de' ? `Morgen · ${timeStr}` : `Tomorrow · ${timeStr}`;
  }
  const dateStr = date.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { day: '2-digit', month: '2-digit' });
  return `${dateStr} · ${timeStr}`;
}

/**
 * Calculates Haversine distance in km from user location.
 */
export function formatPlaceDistance(
  lat: number,
  lon: number,
  userLocation: { lat: number; lng: number } | null,
  lang: 'de' | 'en' = 'de'
): string | null {
  if (!userLocation || !isValidCoordinate(lat, lon) || !isValidCoordinate(userLocation.lat, userLocation.lng)) {
    return null;
  }
  const R = 6371; // Earth radius in km
  const dLat = ((userLocation.lat - lat) * Math.PI) / 180;
  const dLon = ((userLocation.lng - lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat * Math.PI) / 180) * Math.cos((userLocation.lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distKm = R * c;

  const formatted = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1).replace('.', ',')} km`;
  return lang === 'de' ? `${formatted} entfernt` : `${formatted} away`;
}

/**
 * Calculates activity join state centrally.
 */
export function getActivityJoinState(
  activity: Activity,
  currentUserId?: string,
  lang: 'de' | 'en' = 'de'
): { action: string; label: string; disabled: boolean; btnClass: string } {
  const isHost = currentUserId && activity.hostId === currentUserId;
  const isJoined = currentUserId && activity.participantIds?.includes(currentUserId);
  const isPending = currentUserId && (activity as any).pendingRequestIds?.includes(currentUserId);

  const persistentStatus = getActivityActionStatus(activity.id);
  if (persistentStatus === 'submitting') {
    const isDirect = activity.joinMode === 'direct';
    const label = isDirect
      ? (lang === 'de' ? 'Wird beigetreten …' : 'Joining …')
      : (lang === 'de' ? 'Wird gesendet …' : 'Submitting …');
    return { action: 'submitting', label, disabled: true, btnClass: 'bg-purple-400 dark:bg-purple-900/60 text-white cursor-wait opacity-80' };
  }
  if (persistentStatus === 'requested') {
    return { action: 'pending', label: lang === 'de' ? 'Anfrage gesendet' : 'Request sent', disabled: true, btnClass: 'bg-amber-600/90 text-white cursor-default' };
  }
  if (persistentStatus === 'joined') {
    return { action: 'joined', label: lang === 'de' ? 'Beigetreten' : 'Joined', disabled: true, btnClass: 'bg-emerald-600/90 text-white cursor-default' };
  }
  
  const count = activity.participantIds?.length ?? (activity.participantsPreview?.length || 1);
  const max = activity.maxParticipants ?? 4;
  const isFull = count >= max;

  if (activity.status === 'cancelled') {
    return { action: 'none', label: lang === 'de' ? 'Abgesagt' : 'Cancelled', disabled: true, btnClass: 'bg-slate-200 dark:bg-neutral-800 text-slate-400 cursor-not-allowed' };
  }
  if (activity.status === 'completed') {
    return { action: 'none', label: lang === 'de' ? 'Beendet' : 'Ended', disabled: true, btnClass: 'bg-slate-200 dark:bg-neutral-800 text-slate-400 cursor-not-allowed' };
  }
  if (isHost) {
    return { action: 'manage', label: lang === 'de' ? 'Verwalten' : 'Manage', disabled: false, btnClass: 'bg-purple-600 hover:bg-purple-700 text-white' };
  }
  if (isJoined) {
    return { action: 'joined', label: lang === 'de' ? 'Beigetreten' : 'Joined', disabled: true, btnClass: 'bg-emerald-600/90 text-white cursor-default' };
  }
  if (isPending) {
    return { action: 'pending', label: lang === 'de' ? 'Anfrage gesendet' : 'Request sent', disabled: true, btnClass: 'bg-amber-600/90 text-white cursor-default' };
  }
  if (isFull) {
    return { action: 'full', label: lang === 'de' ? 'Ausgebucht' : 'Full', disabled: true, btnClass: 'bg-slate-300 dark:bg-neutral-800 text-slate-500 cursor-not-allowed' };
  }
  if (activity.joinMode === 'request' || (activity as any).requiresApproval) {
    return { action: 'request', label: lang === 'de' ? 'Teilnahme anfragen' : 'Request to join', disabled: false, btnClass: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-500/25' };
  }
  return { action: 'join', label: lang === 'de' ? 'Teilnehmen' : 'Join', disabled: false, btnClass: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-purple-500/25' };
}

function createSafeElement(tag: string, className: string, htmlContent: string): any {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const el = document.createElement(tag);
    el.className = className;
    el.innerHTML = htmlContent;
    return el;
  }
  const element: any = {
    tagName: tag.toUpperCase(),
    className,
    innerHTML: htmlContent,
    querySelector: (selector: string) => {
      const classTarget = selector.startsWith('.') ? selector.slice(1) : selector;
      if (htmlContent.includes(classTarget)) {
        const classRegex = new RegExp(`class="([^"]*${classTarget}[^"]*)"`);
        const match = htmlContent.match(classRegex);
        const fullClassName = match ? match[1] : classTarget;
        return {
          className: fullClassName,
          innerHTML: htmlContent,
          addEventListener: (_event: string, _fn: Function) => {},
        };
      }
      return null;
    },
    querySelectorAll: () => [],
    addEventListener: (_event: string, _fn: Function) => {},
  };
  return element;
}

/**
 * Returns a category-specific SVG icon string based on place categories.
 */
export function getPlaceCategoryIconSVG(categories?: string[], primaryCategory?: string): string {
  const combined = [...(categories || []), primaryCategory || ''].map((c) => (c || '').toLowerCase()).join(' ');

  if (/catering|restaurant|food|caf[eé]|bar|dining|gastronomy|bakery|fast_food|pub/.test(combined)) {
    // Gastronomy / Food
    return `<svg class="w-10 h-10 text-white/95 drop-shadow-md place-category-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 6v6m0 0v6m0-6h6m-6 0H6M18 9v6m-12-6v6"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 3v4a2 2 0 01-2 2H5a2 2 0 01-2-2V3m3 0v18M18 3v7a2 2 0 002 2h0a2 2 0 002-2V3m-3 0v18"></path></svg>`;
  } else if (/park|nature|outdoor|garden|beach|forest|lake|playground|recreation/.test(combined)) {
    // Nature / Outdoor
    return `<svg class="w-10 h-10 text-white/95 drop-shadow-md place-category-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M5 3v4M3 5h4m6 0a9 9 0 019 9c0 4.97-4.03 9-9 9a9 9 0 01-9-9c0-4.97 4.03-9 9-9zm0 0c0 4.97 4.03 9 9 9"></path></svg>`;
  } else if (/museum|historic|landmark|building|memorial|monument|architecture|tourism/.test(combined)) {
    // Culture / Landmark
    return `<svg class="w-10 h-10 text-white/95 drop-shadow-md place-category-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>`;
  } else if (/sport|fitness|gym|swimming|climbing|stadium|sports_centre|bouldering|active/.test(combined)) {
    // Sport / Activity
    return `<svg class="w-10 h-10 text-white/95 drop-shadow-md place-category-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`;
  } else if (/entertainment|leisure|culture|event|arts|theater|cinema|nightlife|attraction|sightseeing/.test(combined)) {
    // Entertainment / Ticket
    return `<svg class="w-10 h-10 text-white/95 drop-shadow-md place-category-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"></path></svg>`;
  } else {
    // Fallback compass/location star icon
    return `<svg class="w-10 h-10 text-white/95 drop-shadow-md place-category-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>`;
  }
}

/**
 * Creates styled HTML DOM Element for Place Popups.
 */
export function createPlacePopupHTML(
  place: Place,
  userLocation: { lat: number; lng: number } | null,
  lang: 'de' | 'en' = 'de',
  isFavorite: boolean = false,
  isFavoriteLoading: boolean = false
): {
  container: HTMLDivElement;
  closeBtn: HTMLElement | null;
  detailsBtn: HTMLElement | null;
  routeBtn: HTMLElement | null;
  shareBtn: HTMLElement | null;
  favBtn: HTMLElement | null;
} {
  const category = place.categories?.[0] || place.category || (lang === 'de' ? 'Ort' : 'Place');
  const name = place.name || (lang === 'de' ? 'Unbenannter Ort' : 'Unnamed place');
  const ratingText = typeof place.rating === 'number' && place.rating > 0 ? place.rating.toFixed(1) : null;
  const distText = formatPlaceDistance(place.lat, place.lon ?? (place as any).lng, userLocation, lang);
  const isOpen = (place as any).isOpenNow;
  const openStatusText = isOpen === true ? (lang === 'de' ? 'Jetzt geöffnet' : 'Open now') : isOpen === false ? (lang === 'de' ? 'Geschlossen' : 'Closed') : '';

  const categoryIconSVG = getPlaceCategoryIconSVG(place.categories, place.category);

  const htmlContent = `
    <div class="relative w-full h-24 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 overflow-hidden flex items-center justify-center place-popup-header">
      <button type="button" class="friend-popup-close absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 active:bg-black/80 text-white flex items-center justify-center transition-all z-20 shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="${lang === 'de' ? 'Schließen' : 'Close'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>

      <button type="button" class="place-popup-fav-btn absolute top-3 left-3 w-8 h-8 min-w-[32px] min-h-[32px] rounded-full ${isFavorite ? 'bg-rose-500 text-white' : 'bg-black/40 hover:bg-black/60 active:bg-black/80 text-white'} flex items-center justify-center transition-all z-20 shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-400" aria-label="${isFavorite ? (lang === 'de' ? 'Favorit entfernen' : 'Remove favorite') : (lang === 'de' ? 'Als Favorit speichern' : 'Save as favorite')}" ${isFavoriteLoading ? 'disabled' : ''}>
        ${
          isFavoriteLoading
            ? `<svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>`
            : `<svg class="w-4 h-4 ${isFavorite ? 'fill-white' : 'fill-none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`
        }
      </button>

      ${
        place.imageUrl
          ? `<img src="${escapeHTML(place.imageUrl)}" class="w-full h-full object-cover" alt="${escapeHTML(name)}" />`
          : categoryIconSVG
      }

      <div class="absolute bottom-2 left-2 bg-white/95 dark:bg-neutral-900/90 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-emerald-500/20 shadow-sm">
        ${escapeHTML(category)}
      </div>
    </div>

    <div class="p-3.5 flex flex-col gap-1.5 text-left">
      <div class="font-black text-base text-slate-900 dark:text-white leading-tight line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
        ${escapeHTML(name)}
      </div>

      <div class="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-neutral-300">
        ${ratingText ? `<span class="inline-flex items-center gap-0.5 text-amber-500 font-bold"><svg class="w-3.5 h-3.5 fill-amber-400 inline" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>${ratingText} ★</span>` : ''}
        ${distText ? `<span class="text-slate-400 dark:text-neutral-400">• ${distText}</span>` : ''}
      </div>

      <div class="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
        ${openStatusText ? `<span class="${isOpen ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-500 font-bold'} mr-1.5">${openStatusText}</span>` : ''}
        <span>${escapeHTML(place.address || (place as any).city || '')}</span>
      </div>

      <div class="mt-2.5 flex flex-col gap-2">
        <button type="button" class="place-popup-details-btn min-h-[44px] w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="${lang === 'de' ? 'Details ansehen' : 'View details'}">
          <span>${lang === 'de' ? 'Details ansehen' : 'View details'}</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path></svg>
        </button>
        <div class="flex items-center gap-2">
          <button type="button" class="place-popup-route-btn flex-1 min-h-[44px] py-2 px-3 bg-slate-200/80 hover:bg-slate-300 active:bg-slate-400/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="Route">
            <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
            <span>Route</span>
          </button>
          <button type="button" class="place-popup-share-btn flex-1 min-h-[44px] py-2 px-3 bg-slate-200/80 hover:bg-slate-300 active:bg-slate-400/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400" aria-label="${lang === 'de' ? 'Teilen' : 'Share'}">
            <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            <span>${lang === 'de' ? 'Teilen' : 'Share'}</span>
          </button>
        </div>
      </div>
    </div>
  `;
  const containerClass = 'activa-place-card aktiva-place-card relative overflow-hidden rounded-[22px] bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-md border border-emerald-500/30 dark:border-emerald-600/30 shadow-2xl flex flex-col w-[250px] sm:w-[270px] cursor-pointer group transition-all hover:border-emerald-400/60';
  const container = createSafeElement('div', containerClass, htmlContent);

  return {
    container,
    closeBtn: container.querySelector('.friend-popup-close'),
    detailsBtn: container.querySelector('.place-popup-details-btn'),
    routeBtn: container.querySelector('.place-popup-route-btn'),
    shareBtn: container.querySelector('.place-popup-share-btn'),
    favBtn: container.querySelector('.place-popup-fav-btn'),
  };
}

/**
 * Creates styled HTML DOM Element for Activity Popups.
 */
export function createActivityPopupHTML(
  activity: Activity,
  userLocation: { lat: number; lng: number } | null,
  currentUserId?: string,
  lang: 'de' | 'en' = 'de'
): {
  container: HTMLDivElement;
  closeBtn: HTMLElement | null;
  detailsBtn: HTMLElement | null;
  joinBtn: HTMLElement | null;
  joinState: { action: string; label: string; disabled: boolean; btnClass: string };
} {
  const title = activity.title || activity.name || activity.placeName || (lang === 'de' ? 'Aktivität' : 'Activity');
  const category = activity.category || (lang === 'de' ? 'Community' : 'Community');
  const dateTimeStr = formatActivityDateTime(activity.activityDate, activity.isTimeFlexible, lang);
  const locationName = activity.placeName || activity.locationLabel || activity.address || (lang === 'de' ? 'Ort' : 'Location');
  const hostName = activity.hostUsername || activity.hostName || 'host';

  const count = activity.participantIds?.length ?? (activity.participantsPreview?.length || 1);
  const max = activity.maxParticipants ?? 4;
  const joinState = getActivityJoinState(activity, currentUserId, lang);

  const htmlContent = `
    <div class="relative w-full h-24 bg-gradient-to-br from-violet-600 to-purple-700 overflow-hidden flex items-center justify-center">
      <button type="button" class="friend-popup-close absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 active:bg-black/80 text-white flex items-center justify-center transition-all z-20 shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-400" aria-label="${lang === 'de' ? 'Schließen' : 'Close'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>

      ${
        activity.imageUrl
          ? `<img src="${escapeHTML(activity.imageUrl)}" class="w-full h-full object-cover" alt="${escapeHTML(title)}" />`
          : `<svg class="w-10 h-10 text-purple-100/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`
      }

      <div class="absolute bottom-2 left-2 bg-purple-950/80 text-purple-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-purple-500/30">
        ${escapeHTML(category)}
      </div>
    </div>

    <div class="p-3.5 flex flex-col gap-1.5 text-left">
      <div class="font-black text-base text-slate-900 dark:text-white leading-tight line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
        ${escapeHTML(title)}
      </div>

      <div class="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-300">
        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span>${dateTimeStr}</span>
      </div>

      <div class="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center justify-between gap-1">
        <span class="truncate">${escapeHTML(locationName)}</span>
        <span class="font-bold shrink-0 text-slate-700 dark:text-neutral-200">${count}/${max} ${lang === 'de' ? 'Teilnehmer' : 'joined'}</span>
      </div>

      <div class="text-[10px] text-slate-400 dark:text-neutral-400 italic truncate">
        ${lang === 'de' ? 'Organisiert von' : 'Hosted by'} @${escapeHTML(hostName)}
      </div>

      <div class="mt-2.5 flex items-center gap-2">
        <button type="button" class="activity-popup-join-btn flex-1 min-h-[44px] py-2 px-3 ${joinState.btnClass} font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all focus-visible:ring-2 focus-visible:ring-purple-400" ${joinState.disabled ? 'disabled' : ''} aria-label="${joinState.label}">
          <span>${joinState.label}</span>
        </button>
        <button type="button" class="activity-popup-details-btn min-h-[44px] py-2 px-3 bg-slate-200/80 hover:bg-slate-300 active:bg-slate-400/80 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all focus-visible:ring-2 focus-visible:ring-purple-400" aria-label="${lang === 'de' ? 'Details ansehen' : 'View details'}">
          <span>Details</span>
        </button>
      </div>
    </div>
  `;

  const containerClass = 'activa-activity-card aktiva-activity-card relative overflow-hidden rounded-[22px] bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-md border border-purple-500/30 dark:border-purple-600/30 shadow-2xl flex flex-col w-[250px] sm:w-[270px] cursor-pointer group transition-all hover:border-purple-400/60';
  const container = createSafeElement('div', containerClass, htmlContent);

  return {
    container,
    closeBtn: container.querySelector('.friend-popup-close'),
    detailsBtn: container.querySelector('.activity-popup-details-btn'),
    joinBtn: container.querySelector('.activity-popup-join-btn'),
    joinState,
  };
}

/**
 * Creates styled HTML DOM Element for Friend Popups.
 */
export function createFriendPopupHTML(
  friend: NearbyFriend,
  lang: 'de' | 'en' = 'de'
): {
  container: HTMLDivElement;
  closeBtn: HTMLElement | null;
  profileBtn: HTMLElement | null;
} {
  const fullName = friend.displayName || friend.username;
  const initial = (fullName || '?').substring(0, 1).toUpperCase();
  const distText = formatDistanceBucketText(friend.distanceBucket, lang);
  const precMeters = normalizePrecisionMeters(friend);

  const htmlContent = `
    <button type="button" class="friend-popup-close absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all z-20 shadow-sm cursor-pointer" aria-label="${lang === 'de' ? 'Schließen' : 'Close'}">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>

    <div class="w-14 h-14 rounded-full mb-2.5 overflow-hidden border-2 border-blue-500/80 ring-4 ring-blue-500/15 shadow-md flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 group-hover:scale-105 transition-transform duration-200">
      ${
        friend.avatarUrl
          ? `<img src="${escapeHTML(friend.avatarUrl)}" class="w-full h-full object-cover rounded-full" alt="${escapeHTML(fullName)}" />`
          : `<span class="text-white text-lg font-black">${initial}</span>`
      }
    </div>

    <div class="font-black text-base tracking-tight text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
      ${escapeHTML(fullName)}
    </div>
    <div class="text-xs font-medium text-slate-400 dark:text-neutral-400 mb-2">
      @${escapeHTML(friend.username)}
    </div>

    <div class="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[11px] font-bold px-3 py-1 rounded-full mb-2.5 border border-blue-200/80 dark:border-blue-800/80 shadow-sm">
      <svg class="w-3 h-3 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
      </svg>
      <span>${distText}</span>
    </div>

    <div class="text-[10px] text-slate-500 dark:text-neutral-400 font-medium italic bg-slate-100/70 dark:bg-neutral-800/50 px-2.5 py-1 rounded-lg w-full mb-3 border border-slate-200/40 dark:border-neutral-700/40">
      ${lang === 'de' ? `Ungefährer Standort (~${precMeters}-Meter-Raster)` : `Approximate location (~${precMeters}m grid)`}
    </div>

    <button type="button" class="friend-popup-profile-btn w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all group-hover:shadow-blue-500/25">
      <span>${lang === 'de' ? 'Profil ansehen' : 'View profile'}</span>
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
      </svg>
    </button>
  `;

  const containerClass = 'activa-friend-card aktiva-friend-card relative overflow-hidden p-4 rounded-[22px] bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-md border border-slate-200/80 dark:border-neutral-700/80 shadow-2xl flex flex-col items-center text-center w-[230px] sm:w-[245px] cursor-pointer group transition-all hover:border-blue-400/50';
  const container = createSafeElement('div', containerClass, htmlContent);

  return {
    container,
    closeBtn: container.querySelector('.friend-popup-close'),
    profileBtn: container.querySelector('.friend-popup-profile-btn'),
  };
}

export const neutralizedRoadShieldLayers = new Set<string>();

export function neutralizeBrokenRoadShieldLayers(map: any): void {
  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    if (layer.type !== 'symbol') continue;
    if (neutralizedRoadShieldLayers.has(layer.id)) continue;

    const layerId = layer.id.toLowerCase();
    const iconImage = map.getLayoutProperty(layer.id, 'icon-image');
    const iconTextFit = map.getLayoutProperty(layer.id, 'icon-text-fit');

    const serializedIconImage = JSON.stringify(iconImage ?? '').toLowerCase();

    const isBrokenRoadShieldLayer =
      layerId.includes('shield') ||
      layerId.includes('road-number') ||
      layerId.includes('road_number') ||
      layerId.includes('road-ref') ||
      layerId.includes('road_ref') ||
      (Boolean(iconTextFit) && serializedIconImage.includes('road_'));

    if (!isBrokenRoadShieldLayer) continue;

    // Nur das fehlerhafte Schildbild ausblenden.
    // Text und normale Straßenbeschriftungen bleiben erhalten.
    map.setPaintProperty(layer.id, 'icon-opacity', 0);

    neutralizedRoadShieldLayers.add(layer.id);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[ROAD SHIELD DISABLED]', {
        layerId: layer.id,
        iconImage,
        iconTextFit,
      });
    }
  }
}

function safeSetPaint(map: any, layerId: string, prop: string, targetValue: any): void {
  try {
    const current = map.getPaintProperty(layerId, prop);
    if (current === targetValue || JSON.stringify(current) === JSON.stringify(targetValue)) {
      return;
    }
    map.setPaintProperty(layerId, prop, targetValue);
  } catch (e) {}
}

function safeSetLayout(map: any, layerId: string, prop: string, targetValue: any): void {
  try {
    const current = map.getLayoutProperty(layerId, prop);
    if (current === targetValue || JSON.stringify(current) === JSON.stringify(targetValue)) {
      return;
    }
    map.setLayoutProperty(layerId, prop, targetValue);
  } catch (e) {}
}

/**
 * Applies a Soft Pastel visual theme to vector basemap style layers without affecting Activa layers.
 * Uses safeSetPaint and safeSetLayout guards to ensure idempotency and prevent styledata update loops.
 */
export function applySoftPastelBasemapStyle(map: any): void {
  if (!map || typeof map.getStyle !== 'function') return;
  const layers = map.getStyle()?.layers ?? [];

  for (const layer of layers) {
    if (!layer || !layer.id) continue;
    const id = layer.id.toLowerCase();
    const type = layer.type;

    // Preserve all Activa-specific application layers completely untouched
    if (
      id.startsWith('places-') ||
      id.startsWith('activities-') ||
      id.startsWith('friends-') ||
      id.startsWith('radius-')
    ) {
      continue;
    }

    // 1. Background
    if (type === 'background') {
      safeSetPaint(map, layer.id, 'background-color', '#f8f6f0');
      continue;
    }

    // 2. Water / Coastline / Lakes / Rivers
    if (
      id.includes('water') ||
      id.includes('ocean') ||
      id.includes('river') ||
      id.includes('lake') ||
      id.includes('stream') ||
      id.includes('canal')
    ) {
      if (type === 'fill') {
        safeSetPaint(map, layer.id, 'fill-color', '#c5e3ed');
      } else if (type === 'line') {
        safeSetPaint(map, layer.id, 'line-color', '#b4dadf');
      }
      continue;
    }

    // 3. Forests & Greenery / Parks
    if (id.includes('forest') || id.includes('wood')) {
      if (type === 'fill') {
        safeSetPaint(map, layer.id, 'fill-color', '#c4dfcc');
      }
      continue;
    }

    if (
      id.includes('park') ||
      id.includes('grass') ||
      id.includes('green') ||
      id.includes('garden') ||
      id.includes('cemetery') ||
      id.includes('pitch') ||
      id.includes('leisure') ||
      id.includes('meadow')
    ) {
      if (type === 'fill') {
        safeSetPaint(map, layer.id, 'fill-color', '#d4ead8');
      }
      continue;
    }

    // 4. Buildings
    if (id.includes('building') || id.includes('structure') || id.includes('house')) {
      if (type === 'fill' || type === 'fill-extrusion') {
        safeSetPaint(map, layer.id, 'fill-color', '#eeebe4');
        safeSetPaint(map, layer.id, 'fill-opacity', 0.7);
      } else if (type === 'line') {
        safeSetPaint(map, layer.id, 'line-color', '#e2ded6');
      }
      continue;
    }

    // 5. Motorways, Highways & Major Roads
    if (id.includes('motorway') || id.includes('freeway')) {
      if (type === 'line') {
        safeSetPaint(map, layer.id, 'line-color', '#e6cbab');
      }
      continue;
    }

    if (
      id.includes('primary') ||
      id.includes('secondary') ||
      id.includes('trunk') ||
      id.includes('main') ||
      id.includes('arterial')
    ) {
      if (type === 'line') {
        safeSetPaint(map, layer.id, 'line-color', '#eadab8');
      }
      continue;
    }

    if (id.includes('rail') || id.includes('train') || id.includes('transit') || id.includes('subway')) {
      if (type === 'line') {
        safeSetPaint(map, layer.id, 'line-color', '#d3cfcf');
      }
      continue;
    }

    if (
      id.includes('road') ||
      id.includes('street') ||
      id.includes('highway') ||
      id.includes('path') ||
      id.includes('pedestrian') ||
      id.includes('service') ||
      id.includes('track') ||
      id.includes('tunnel') ||
      id.includes('bridge')
    ) {
      if (type === 'line') {
        safeSetPaint(map, layer.id, 'line-color', '#e8e4dc');
      }
      continue;
    }

    // 6. Text Labels & POI Reductions
    if (type === 'symbol') {
      safeSetPaint(map, layer.id, 'text-color', '#4a4a4a');
      safeSetPaint(map, layer.id, 'text-halo-color', '#faf8f5');

      // Keep stations, city/district names, street names visible, but hide unneeded foreign POI icon clutter
      const isStationOrTownLabel =
        id.includes('station') ||
        id.includes('transit') ||
        id.includes('rail') ||
        id.includes('city') ||
        id.includes('town') ||
        id.includes('village') ||
        id.includes('place') ||
        id.includes('country') ||
        id.includes('state') ||
        id.includes('street') ||
        id.includes('road');

      if (!isStationOrTownLabel && (id.includes('poi') || id.includes('shop') || id.includes('amenity'))) {
        safeSetLayout(map, layer.id, 'visibility', 'none');
      }
    }
  }
}


