import { GEOAPIFY_API_KEY } from '@/lib/config';
import type { Place, GeoapifyFeature } from '@/lib/types';
import imageData from './placeholder-images.json';

type ImageData = {
  seed: string;
  width: number;
  height: number;
  hint: string;
};

const placeImages = imageData as Record<string, ImageData[]>;

let imageCounter = 0;

function getPlaceholderImage(categories: string[]): ImageData {
    for (const category of categories) {
        if (placeImages[category]) {
            const images = placeImages[category];
            return images[imageCounter++ % images.length];
        }
        // Also check for parent category
        const parentCategory = category.split('.')[0];
        if(placeImages[parentCategory]) {
            const images = placeImages[parentCategory];
            return images[imageCounter++ % images.length];
        }
    }
    const defaultImages = placeImages.default;
    return defaultImages[imageCounter++ % defaultImages.length];
}


export async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  categories: string[]
): Promise<Place[]> {
  const categoryList = categories.join(',');
  const url = `https://api.geoapify.com/v2/places?categories=${categoryList}&filter=circle:${lon},${lat},5000&bias=proximity:${lon},${lat}&limit=20&apiKey=${GEOAPIFY_API_KEY}`;

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

      const image = getPlaceholderImage(props.categories);

      return {
        id: props.place_id,
        name: props.name || props.address_line1,
        address: props.address_line2,
        categories: props.categories,
        lat: props.lat,
        lon: props.lon,
        rating: rating,
        imageUrl: `https://picsum.photos/seed/${image.seed}/${image.width}/${image.height}`,
        imageWidth: image.width,
        imageHeight: image.height,
        imageHint: image.hint,
      };
    }).filter((place: Place) => place.name);
  } catch (error) {
    console.error('Geoapify fetch error:', error);
    return [];
  }
}
