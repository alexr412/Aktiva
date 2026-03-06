
'use client';

import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature } from '@/lib/types';

/**
 * Zentrale Blacklist für permanente System-Ausschlüsse.
 * Diese Kategorien werden sowohl serverseitig (via exclude-Parameter)
 * als auch clientseitig (via Post-Processing) entfernt, sofern kein Override vorliegt.
 */
export const BLACKLISTED_CATEGORIES = [
  "adult.stripclub",
  "adult.brothel",
  "adult.swingerclub",
  "adult.adult_gaming_centre",
  "adult.casino",
  "accommodation",
  "airport",
  "childcare",
  "healthcare",
  "highway",
  "parking",
  "service",
  "populated_place",
  "power",
  "postal_code",
  "political",
  "low_emission_zone",
  "amenity",
  "administrative",
  "railway"
];

// Generiert den Exclude-String für die API-URL
export const GLOBAL_EXCLUDE_STRING = BLACKLISTED_CATEGORIES.map(cat => `categories:${cat}`).join(',');

export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  categories: string[],
  limit: number,
  offset: number
): Promise<Place[]> {
  // 1. Zuweisung fokussierter POI-Kategorien für den All-Tab
  let targetCategories: string[];
  if (categories.length === 0 || categories.includes('all')) {
    targetCategories = ["tourism", "entertainment", "heritage"];
  } else {
    targetCategories = categories;
  }

  // 2. Erzwungene Injektion von conditions=named und GLOBAL_EXCLUDE_STRING (Defense in Depth)
  const fetchUrl = `https://api.geoapify.com/v2/places?categories=${targetCategories.join(',')}&filter=circle:${lon},${lat},${radiusMeters}&bias=proximity:${lon},${lat}&limit=${limit}&offset=${offset}&conditions=named&exclude=${GLOBAL_EXCLUDE_STRING}&apiKey=${GEOAPIFY_API_KEY}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Geoapify API request failed: ${response.status}. ${errorText}`);
      return [];
    }
    const data = await response.json();

    if (!data.features) {
      console.warn("Geoapify response was successful but contained no 'features' array.");
      return [];
    }

    // 3. Strukturierte Filter-Pipeline (Inklusions-Priorität / Whitelist Override)
    const rawFeatures = data.features || [];
    const safeFeatures = rawFeatures.filter((feature: any) => {
      const itemTags = feature.properties?.categories || [];
      const catsArray = Array.isArray(itemTags) ? itemTags : [itemTags];

      // Priorität 1: Inklusions-Override (Whitelist)
      // Wenn ein gewünschter Tag existiert, wird das Element zwingend gerendert.
      const hasIncludedTag = targetCategories.length > 0 && catsArray.some((tag: string) => targetCategories.includes(tag));
      if (hasIncludedTag) return true;

      // Priorität 2: Sekundäre Exklusion (Blacklist)
      // Greift nur, wenn Priorität 1 nicht zutrifft.
      const hasExcludedTag = BLACKLISTED_CATEGORIES.length > 0 && catsArray.some((tag: string) => BLACKLISTED_CATEGORIES.includes(tag));
      if (hasExcludedTag) return false;

      return true; 
    });

    return safeFeatures.map((feature: GeoapifyFeature) => {
      const props = feature.properties;
      let rating;
      if (props.datasource?.raw?.rating) {
        const parsedRating = parseFloat(props.datasource.raw.rating);
        if (!isNaN(parsedRating)) {
            rating = Math.max(0, Math.min(5, parsedRating));
        }
      }

      return {
        id: props.place_id,
        name: props.name || props.address_line1,
        address: props.address_line2,
        categories: Array.isArray(props.categories) ? props.categories : [props.categories],
        lat: props.lat,
        lon: props.lon,
        rating: rating,
        distance: props.distance,
      } as Place;
    });
  } catch (error) {
    console.error('An unexpected error occurred while fetching places from Geoapify:', error);
    return [];
  }
}
