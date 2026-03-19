'use client';

import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature, UserPreferences } from '@/lib/types';

/**
 * Stufe 0A: Absoluter Abbruch (Hard Veto)
 * Blockiert das Rendering dieser Knoten und ihrer Sub-Kategorien bedingungslos via .startsWith()
 */
export const BASE_HARD_VETO = [
  "building.accommodation", "building.parking", "building.residential", "building.school", "building.service", "building.toilet",
  "memorial", "memorial.buddhist", "memorial.cemetery", "memorial.cemetery.sector", "memorial.christian", "memorial.christian.catholic", "memorial.christian.orthodox", "memorial.christian.protestant", "memorial.graveyard", "memorial.hindu", "memorial.jewish", "memorial.muslim",
  "tourism.information", "tourism.information.office",
  "commercial.supermarket", "commercial.convenience", "commercial.discount_store", "commercial.elektronics", "commercial.erotic", "commercial.health_and_beauty.optician", "commercial.health_and_beauty.pharmacy", "commercial.houseware_and_hardware", "commercial.pet",
  "service.vehicle", "commercial.outdoor_and_sport.bicycle", "commercial.food_and_drink.butcher",
  "tourism.attraction.artwork"
];

/**
 * Stufe 0B: Relativer Abbruch (Soft Veto)
 */
export const BASE_SOFT_VETO = [
  "education.school", "education.driving_school", "education.language_school", "education.music_school", "education.college",
  "heritage.unesco",
  "accommodation", "accommodation.apartment", "accommodation.chalet", "accommodation.guest_house", "accommodation.hostel", "accommodation.hotel", "accommodation.hut", "accommodation.motel",
  "emergency", "childcare", "healthcare", "heritage", "office", "pet.crematorium", "pet.service", "pet.shop", "pet.veterinary",
  "production.factory", "rental", "amenity", "public_transport", "power", "administrative", "political", "low_emission_zone",
  "populated_place", "adult.brothel", "adult.adult_gaming_centre", "service", "commercial"
];

/**
 * Statische Metadaten-Attribute (Conditions)
 */
export const CONDITION_PREFIXES = [
  "internet_access", "wheelchair", "dogs", "access", "access_limited", 
  "no_access", "fee", "no_fee", "named", "vegetarian", "vegan", 
  "halal", "kosher", "organic", "gluten_free", "sugar_free", "egg_free", "soy_free"
];

export const GLOBAL_EXCLUDE_STRING = [...BASE_HARD_VETO].map(cat => `categories:${cat}`).join(',');

export const applyFilters = (items: any[], userSoftVetoList: string[] = []) => {
  const combinedSoftVetoList = [...BASE_SOFT_VETO, ...userSoftVetoList];

  return items.filter(item => {
    const isStolperstein = item.properties?.datasource?.raw?.memorial === 'stolperstein';
    if (isStolperstein) return false;

    const allTags: string[] = Array.isArray(item.tags) ? item.tags : (item.properties?.categories ? (Array.isArray(item.properties.categories) ? item.properties.categories : [item.properties.categories]) : []);

    const violatesHardVeto = allTags.some(tag => 
      BASE_HARD_VETO.some(veto => tag === veto || tag.startsWith(`${veto}.`))
    );
    if (violatesHardVeto) return false;

    const coreTags = allTags.filter(tag => 
      !CONDITION_PREFIXES.some(prefix => tag === prefix || tag.startsWith(`${prefix}.`)) &&
      (!tag.startsWith("building") || combinedSoftVetoList.includes(tag))
    );

    const specificCoreTags = coreTags.filter(tag => 
      !coreTags.some(otherTag => otherTag !== tag && otherTag.startsWith(`${tag}.`))
    );

    if (specificCoreTags.length > 0) {
      const isSolelyExcludedIdentity = specificCoreTags.every(specificTag => 
        combinedSoftVetoList.includes(specificTag)
      );
      
      if (isSolelyExcludedIdentity) return false;
    }

    return true;
  });
};

export const calculateRelevanceScore = (itemTags: string[], distanceInMeters: number, prefs: UserPreferences): number => {
  let score = 1000;
  if (itemTags.includes('education.library')) score += 15000;
  const hasLikedTag = itemTags.some(tag => prefs.likedTags.some(liked => tag === liked || tag.startsWith(`${liked}.`)));
  if (hasLikedTag) score += 5000;
  const hasDislikedTag = itemTags.some(tag => prefs.dislikedTags.some(disliked => tag === disliked || tag.startsWith(`${disliked}.`)));
  if (hasDislikedTag) score -= 800;
  score -= (distanceInMeters / 10);
  return score;
};

export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  categories: string[],
  limit: number,
  offset: number
): Promise<Place[]> {
  let targetCategories: string[] = categories.length === 0 || categories.includes('all') ? ["tourism", "entertainment", "heritage"] : categories;
  const fetchUrl = `https://api.geoapify.com/v2/places?categories=${targetCategories.join(',')}&filter=circle:${lon},${lat},${radiusMeters}&bias=proximity:${lon},${lat}&limit=${limit}&offset=${offset}&conditions=named&exclude=${GLOBAL_EXCLUDE_STRING}&apiKey=${GEOAPIFY_API_KEY}`;

  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) return [];
    const data = await response.json();
    if (!data.features) return [];
    const rawFeatures = data.features || [];
    const itemsToFilter = rawFeatures.map((f: any) => ({
        tags: Array.isArray(f.properties.categories) ? f.properties.categories : [f.properties.categories],
        properties: f.properties,
        distance: f.properties.distance || 0
    }));
    const safeItems = applyFilters(itemsToFilter);
    return safeItems.map((item: any) => {
      const props = item.properties;
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
        openingHours: props.opening_hours || props.datasource?.raw?.opening_hours || null
      } as Place;
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return [];
  }
}

/**
 * Wandelt Koordinaten in eine lesbare Adresse um (Reverse Geocoding).
 */
export async function reverseGeocode(lat: number, lon: number): Promise<Place | null> {
  const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const props = data.features[0].properties;
      return {
        id: props.place_id,
        name: props.name || props.address_line1,
        address: props.address_line2,
        categories: props.categories || [],
        lat: props.lat,
        lon: props.lon,
        openingHours: props.opening_hours || props.datasource?.raw?.opening_hours || null
      } as Place;
    }
  } catch (error) {
    console.error("Reverse Geocode failed:", error);
  }
  return null;
}

/**
 * Sucht nach Orten basierend auf Texteingabe (Autocomplete).
 */
export async function autocompletePlaces(text: string): Promise<Place[]> {
  if (!text || text.length < 3) return [];
  const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&limit=5&apiKey=${GEOAPIFY_API_KEY}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (data.features) {
      return data.features.map((f: any) => ({
        id: f.properties.place_id,
        name: f.properties.name || f.properties.address_line1,
        address: f.properties.address_line2,
        categories: f.properties.categories || [],
        lat: f.properties.lat,
        lon: f.properties.lon,
        openingHours: f.properties.opening_hours || f.properties.datasource?.raw?.opening_hours || null
      } as Place));
    }
  } catch (error) {
    console.error("Autocomplete failed:", error);
  }
  return [];
}
