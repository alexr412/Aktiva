import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature } from '@/lib/types';

export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  categories: string[]
): Promise<Place[]> {
  const categoryList = categories.join(',');
  const limit = 500;
  let url = `https://api.geoapify.com/v2/places?filter=circle:${lon},${lat},5000&bias=proximity:${lon},${lat}&limit=${limit}&conditions=named&apiKey=${GEOAPIFY_API_KEY}`;

  if (categoryList) {
    url += `&categories=${categoryList}`;
  }


  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      // Using console.warn to avoid showing a scary error overlay in development.
      // This is likely an API key issue (invalid or rate-limited).
      console.warn(`Geoapify API request failed: ${response.status}. ${errorText}`);
      return [];
    }
    const data = await response.json();

    // Guard against a response that doesn't contain the features array.
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
        // Geoapify can return a single category as a string, so we ensure it's always an array.
        categories: Array.isArray(props.categories) ? props.categories : [props.categories],
        lat: props.lat,
        lon: props.lon,
        rating: rating,
      };
    });
  } catch (error) {
    console.error('An unexpected error occurred while fetching places from Geoapify:', error);
    return [];
  }
}
