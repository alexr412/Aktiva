'use client';

import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature } from '@/lib/types';

/**
 * Stufe 0A: Absolutes System-Veto (Hard Veto)
 * Diese Kategorien werden unter allen Umständen blockiert.
 */
export const BASE_HARD_VETO = [
  "education.school", "education.driving_school", "education.language_school",
  "education.music_school", "education.college", 
  "emergency", "childcare", "healthcare", "pet.crematorium", "production.factory",
  "adult.stripclub", "adult.brothel", "adult.swingerclub", "adult.adult_gaming_centre", "adult.casino"
];

/**
 * Stufe 0B: Relativer Abbruch (Soft Veto)
 * Greift nur, wenn keine weiteren validen Core-Tags vorhanden sind.
 */
export const BASE_SOFT_VETO = [
  "heritage", "heritage.unesco", 
  "office", "administrative", "rental", "amenity", "power", "populated_place",
  "public_transport", "postal_code", "political", "low_emission_zone", "accommodation"
];

/**
 * Statische Metadaten-Attribute (Conditions), die nicht die Kern-Identität definieren.
 */
export const CONDITION_PREFIXES = [
  "internet_access", "wheelchair", "dogs", "access", "access_limited", 
  "no_access", "fee", "no_fee", "named", "vegetarian", "vegan", 
  "halal", "kosher", "organic", "gluten_free", "sugar_free", "egg_free", "soy_free"
];

// Kombinierte Liste für den API-Ausschluss (optimierte Vor-Filterung)
export const GLOBAL_EXCLUDE_STRING = [...BASE_HARD_VETO].map(cat => `categories:${cat}`).join(',');

export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  categories: string[],
  limit: number,
  offset: number
): Promise<Place[]> {
  let targetCategories: string[];
  if (categories.length === 0 || categories.includes('all')) {
    targetCategories = ["tourism", "entertainment", "heritage"];
  } else {
    targetCategories = categories;
  }

  const fetchUrl = `https://api.geoapify.com/v2/places?categories=${targetCategories.join(',')}&filter=circle:${lon},${lat},${radiusMeters}&bias=proximity:${lon},${lat}&limit=${limit}&offset=${offset}&conditions=named&exclude=${GLOBAL_EXCLUDE_STRING}&apiKey=${GEOAPIFY_API_KEY}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.features) return [];

    const rawFeatures = data.features || [];
    
    const safeFeatures = rawFeatures.filter((feature: any) => {
      const allTags: string[] = Array.isArray(feature.properties?.categories) 
        ? feature.properties.categories 
        : [feature.properties?.categories];

      // STUFE 0: Absolutes System-Veto (Hard Veto)
      const violatesBaseHard = allTags.some(tag => 
        BASE_HARD_VETO.some(veto => tag === veto || tag.startsWith(`${veto}.`))
      );
      if (violatesBaseHard) return false;

      // STUFE 2: Zwingende Inklusion (Whitelist Override)
      // Wenn ein Tag explizit angefordert wurde, zeigen wir den Ort an.
      const isAllMode = targetCategories.includes("tourism") && targetCategories.length === 3;
      if (!isAllMode && targetCategories.length > 0) {
        const satisfiesInclusion = allTags.some(tag => targetCategories.includes(tag));
        if (satisfiesInclusion) return true;
        // Wenn kein angeforderter Tag dabei ist, in diesem Modus filtern
        return false;
      }

      // Extraktion der Identitäts-Tags (Core) für Soft Veto
      const coreTags = allTags.filter(tag => 
        !CONDITION_PREFIXES.some(prefix => tag === prefix || tag.startsWith(`${prefix}.`)) &&
        !tag.startsWith("building")
      );

      // STUFE 3: Relative Exklusion (Soft Veto)
      if (BASE_SOFT_VETO.length > 0 && coreTags.length > 0) {
        const isSolelyExcludedIdentity = coreTags.every(coreTag => 
          BASE_SOFT_VETO.some(excludedTag => coreTag === excludedTag || coreTag.startsWith(`${excludedTag}.`))
        );
        if (isSolelyExcludedIdentity) return false;
      }

      return true; 
    });

    return safeFeatures.map((feature: GeoapifyFeature) => {
      const props = feature.properties;
      let rating;
      if (props.datasource?.raw?.rating) {
        const parsedRating = parseFloat(props.datasource.raw.rating);
        if (!isNaN(parsedRating)) rating = Math.max(0, Math.min(5, parsedRating));
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
    console.error('Fetch error:', error);
    return [];
  }
}
