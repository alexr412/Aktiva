'use server';
import { z } from 'zod';
import { searchCategoryLabel } from '@/lib/search-intent';
const Input = z.object({
  name: z.string().min(1).max(200), address: z.string().max(500),
  categories: z.array(z.string().max(100)).max(30),
  rating: z.number().optional(), userPreferences: z.string().max(500).optional(),
});
export type PlaceRecommendationInput = z.infer<typeof Input>;
export type PlaceRecommendationOutput = { recommendation: string };
/** A factual summary needs no model call and invents no suitability or venue details. */
export async function recommendPlace(input: PlaceRecommendationInput): Promise<PlaceRecommendationOutput> {
  const place = Input.parse(input);
  const category = place.categories.map(tag => searchCategoryLabel(tag, 'de')).find(label => !label.includes('.'));
  return { recommendation: `${place.name}${category ? ` · ${category}` : ''}${place.address ? `. ${place.address}` : ''}.` };
}
