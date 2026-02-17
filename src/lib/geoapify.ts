import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature } from '@/lib/types';

export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  categories: string[]
): Promise<Place[]> {
  const categoryList = categories.join(',');
  const url = `https://api.geoapify.com/v2/places?categories=${categoryList}&filter=circle:${lon},${lat},5000&bias=popularity:${lon},${lat}&limit=50&conditions=named&apiKey=${GEOAPIFY_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch places from Geoapify');
    }
    const data = await response.json();

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
        categories: props.categories,
        lat: props.lat,
        lon: props.lon,
        rating: rating,
      };
    });
  } catch (error) {
    console.error('Geoapify fetch error:', error);
    return [];
  }
}
