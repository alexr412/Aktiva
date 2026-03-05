'use client';

import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature } from '@/lib/types';

export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radiusMeters: number,
  categories: string[],
  limit: number,
  offset: number
): Promise<Place[]> {
  // 1. Zuweisung fokussierter POI-Kategorien für den All-Tab gemäß System-Anweisung
  let targetCategories: string[];
  if (categories.length === 0 || categories.includes('all')) {
    targetCategories = ["tourism", "entertainment", "heritage"];
  } else {
    targetCategories = categories;
  }

  // 2. Erzwungene Injektion von conditions=named und globale NSFW-Blacklist (exclude adult)
  // Limit wird hier dynamisch übergeben, in der Discover-Ansicht auf 300 erhöht
  let url = `https://api.geoapify.com/v2/places?categories=${targetCategories.join(',')}&filter=circle:${lon},${lat},${radiusMeters}&bias=proximity:${lon},${lat}&limit=${limit}&offset=${offset}&conditions=named&exclude=categories:adult&apiKey=${GEOAPIFY_API_KEY}`;

  try {
    const response = await fetch(url);
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

    return data.features.map((feature: GeoapifyFeature) => {
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
