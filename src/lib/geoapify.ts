'use client';

import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature } from '@/lib/types';

/**
 * Stufe 0: Statische System-Exklusionen (Irrelevante POIs)
 * Diese Kategorien besitzen keine Relevanz für den primären Interaktions-Loop.
 */
export const BASE_EXCLUSIONS = [
  "education.school",
  "education.driving_school",
  "education.language_school",
  "education.music_school",
  "education.college",
  "heritage.unesco"
];

/**
 * Statische Metadaten-Attribute (Conditions), die nicht die Kern-Identität definieren.
 */
export const CONDITION_PREFIXES = [
  "internet_access", "wheelchair", "dogs", "access", "access_limited", 
  "no_access", "fee", "no_fee", "named", "vegetarian", "vegan", 
  "halal", "kosher", "organic", "gluten_free", "sugar_free", "egg_free", "soy_free"
];

/**
 * Stufe 1: Hard Veto - Kategorien, die unter allen Umständen blockiert werden.
 */
export const HARD_VETO_CATEGORIES = [
  "adult.stripclub",
  "adult.brothel",
  "adult.swingerclub",
  "adult.adult_gaming_centre",
  "adult.casino"
];

/**
 * Stufe 3: Soft Blacklist - Kategorien, die nur dann zum Ausschluss führen, 
 * wenn der Ort KEINE anderen validen Identitäts-Tags besitzt.
 */
export const SOFT_BLACKLIST_CATEGORIES = [
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
  "railway",
  "heritage"
];

// Kombinierte Liste für den API-Ausschluss (optimierte Vor-Filterung)
export const BLACKLISTED_CATEGORIES = [...BASE_EXCLUSIONS, ...HARD_VETO_CATEGORIES, ...SOFT_BLACKLIST_CATEGORIES];
export const GLOBAL_EXCLUDE_STRING = BLACKLISTED_CATEGORIES.map(cat => `categories:${cat}`).join(',');

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
    
    // Anwendung der 4-Stufen-Filter-Pipeline
    const safeFeatures = rawFeatures.filter((feature: any) => {
      const allTags: string[] = Array.isArray(feature.properties?.categories) 
        ? feature.properties.categories 
        : [feature.properties?.categories];

      // STUFE 0: Base Veto (Systemseitige Grund-Exklusion)
      const violatesBaseExclusion = allTags.some(tag => BASE_EXCLUSIONS.includes(tag));
      if (violatesBaseExclusion) return false;

      // Trennung in Identität (Core) und Attribute (Conditions)
      const coreTags = allTags.filter(tag => 
        !CONDITION_PREFIXES.some(prefix => tag === prefix || tag.startsWith(`${prefix}.`))
      );

      // STUFE 1: Hard Veto (Nutzerdefinierte absolute Exklusion)
      const violatesHardVeto = allTags.some(tag => HARD_VETO_CATEGORIES.includes(tag));
      if (violatesHardVeto) return false;

      // STUFE 2: Zwingende Inklusion (Whitelist)
      const isAllMode = targetCategories.includes("tourism") && targetCategories.length === 3;
      if (!isAllMode && targetCategories.length > 0) {
        const satisfiesInclusion = allTags.some(tag => targetCategories.includes(tag));
        if (!satisfiesInclusion) return false;
      }

      // STUFE 3: Relative Exklusion (Soft Blacklist)
      if (coreTags.length > 0) {
        const isSolelyExcludedIdentity = coreTags.every(coreTag => 
          SOFT_BLACKLIST_CATEGORIES.some(excludedTag => coreTag === excludedTag || coreTag.startsWith(`${excludedTag}.`))
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
