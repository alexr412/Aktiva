'use client';

/**
 * Berechnet die Entfernung zwischen zwei Koordinatenpaaren in Kilometern
 * unter Verwendung der Haversine-Formel.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Erdradius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
