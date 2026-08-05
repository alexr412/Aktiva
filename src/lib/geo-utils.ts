'use client';

/**
 * Berechnet die Haversine-Entfernung in Kilometern zwischen zwei Punkten.
 * Gibt null zurück bei ungültigen, unvollständigen oder außerhalb der Grenzen liegenden Werten.
 */
export function calculateDistanceKm(
  userLat?: number | null,
  userLng?: number | null,
  targetLat?: number | null,
  targetLng?: number | null
): number | null {
  if (
    userLat === undefined || userLat === null || typeof userLat !== 'number' || isNaN(userLat) || !isFinite(userLat) ||
    userLng === undefined || userLng === null || typeof userLng !== 'number' || isNaN(userLng) || !isFinite(userLng) ||
    targetLat === undefined || targetLat === null || typeof targetLat !== 'number' || isNaN(targetLat) || !isFinite(targetLat) ||
    targetLng === undefined || targetLng === null || typeof targetLng !== 'number' || isNaN(targetLng) || !isFinite(targetLng)
  ) {
    return null;
  }

  // Bounds check: Latitude [-90, 90], Longitude [-180, 180]
  if (Math.abs(userLat) > 90 || Math.abs(targetLat) > 90 || Math.abs(userLng) > 180 || Math.abs(targetLng) > 180) {
    return null;
  }

  const R = 6371; // Erdradius in km
  const dLat = (targetLat - userLat) * (Math.PI / 180);
  const dLon = (targetLng - userLng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(userLat * (Math.PI / 180)) * Math.cos(targetLat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Berechnet die Entfernung zwischen zwei Koordinatenpaaren in Kilometern
 * unter Verwendung der Haversine-Formel (Kompatibilitäts-Wrapper).
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dist = calculateDistanceKm(lat1, lon1, lat2, lon2);
  return dist !== null ? dist : 0;
}

/**
 * Extrahiert Breitengrad (lat) und Längengrad (lng) aus verschiedenen Zielobjekten.
 * Benutzt Type Guards ohne `any` und unterstützt u.a. GeoJSON [longitude, latitude].
 */
export function extractCoordinates(target: unknown): { lat: number; lng: number } | null {
  if (!target || typeof target !== 'object') return null;
  const obj = target as Record<string, unknown>;

  let lat: number | undefined;
  let lng: number | undefined;

  const parseNum = (val: unknown): number | undefined => {
    if (typeof val === 'number' && !isNaN(val) && isFinite(val)) return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && isFinite(parsed)) return parsed;
    }
    return undefined;
  };

  // Direct properties
  lat = parseNum(obj.lat) ?? parseNum(obj.latitude);
  lng = parseNum(obj.lng) ?? parseNum(obj.lon) ?? parseNum(obj.longitude);

  // GeoJSON [longitude, latitude]
  if (lat === undefined || lng === undefined) {
    const coords = Array.isArray(obj.coordinates) ? obj.coordinates : undefined;
    const geomCoords = (obj.geometry && typeof obj.geometry === 'object' && Array.isArray((obj.geometry as Record<string, unknown>).coordinates))
      ? (obj.geometry as Record<string, unknown>).coordinates as unknown[]
      : undefined;
    const targetCoords = coords || geomCoords;

    if (Array.isArray(targetCoords) && targetCoords.length >= 2) {
      const gLng = parseNum(targetCoords[0]);
      const gLat = parseNum(targetCoords[1]);
      if (gLat !== undefined && gLng !== undefined) {
        lat = lat ?? gLat;
        lng = lng ?? gLng;
      }
    }
  }

  // Nested location object
  if ((lat === undefined || lng === undefined) && obj.location && typeof obj.location === 'object') {
    const loc = obj.location as Record<string, unknown>;
    lat = lat ?? parseNum(loc.lat) ?? parseNum(loc.latitude);
    lng = lng ?? parseNum(loc.lng) ?? parseNum(loc.lon) ?? parseNum(loc.longitude);
  }

  if (lat !== undefined && lng !== undefined) {
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Formatiert eine Entfernung in Kilometern einheitlich für Feed und Details.
 * Unter 1 km wird die Distanz in Metern (z. B. "400m"), ab 1 km in Kilometern (z. B. "2.5km") angegeben.
 */
export function formatDistance(distanceInKm: number | null | undefined): string | null {
  if (
    distanceInKm === undefined ||
    distanceInKm === null ||
    typeof distanceInKm !== 'number' ||
    isNaN(distanceInKm) ||
    !isFinite(distanceInKm) ||
    distanceInKm < 0
  ) {
    return null;
  }
  if (distanceInKm < 1) {
    return `${Math.round(distanceInKm * 1000)}m`;
  }
  return `${distanceInKm.toFixed(1)}km`;
}


export type ApproximateLocationData = {
  label: string;
  city?: string;
  postalCode?: string;
};

export function buildApproximateLocationData(input: any): ApproximateLocationData {
  if (!input) {
    return { label: "Unbekannter Ort" };
  }

  const postalCode = 
    input.postalCode || 
    input.postcode || 
    input.postCode || 
    input.properties?.postcode || 
    input.properties?.postalCode || 
    input._rawProperties?.postcode || 
    input._rawProperties?.postal_code;
    
  let city =
    input.city ||
    input.town ||
    input.village ||
    input.municipality ||
    input.properties?.city ||
    input.properties?.town ||
    input.properties?.village ||
    input.properties?.municipality ||
    input._rawProperties?.city ||
    input._rawProperties?.town ||
    input._rawProperties?.village ||
    input._rawProperties?.municipality;

  // Fallback: try parsing from address if city/postcode is missing
  if (!postalCode && !city && input.address) {
    const parts = input.address.split(',').map((s: string) => s.trim());
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2];
      const match = candidate.match(/^(\d{4,5})\s+(.+)$/);
      if (match) {
        return {
          label: candidate,
          postalCode: match[1],
          city: match[2]
        };
      }
      city = candidate;
    } else if (parts.length === 1) {
      city = parts[0];
    }
  }

  const cityStr = city ? String(city) : undefined;
  const pcStr = postalCode ? String(postalCode) : undefined;

  if (pcStr && cityStr) {
    return {
      label: `${pcStr} ${cityStr}`,
      city: cityStr,
      postalCode: pcStr
    };
  }
  if (cityStr) {
    return {
      label: cityStr,
      city: cityStr
    };
  }
  if (pcStr) {
    return {
      label: pcStr,
      postalCode: pcStr
    };
  }
  return { label: "Unbekannter Ort" };
}
