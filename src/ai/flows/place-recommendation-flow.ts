'use server';
/**
 * @fileOverview Provides a Genkit flow for generating personalized recommendations or descriptions for nearby places.
 *
 * - recommendPlace - A function that generates a recommendation for a given place.
 * - PlaceRecommendationInput - The input type for the recommendPlace function.
 * - PlaceRecommendationOutput - The return type for the recommendPlace function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Input schema for generating a place recommendation.
 * Includes details about the place and optional user preferences.
 */
const PlaceRecommendationInputSchema = z.object({
  name: z.string().describe('The name of the place.'),
  address: z.string().describe('The address of the place.'),
  categories: z
    .array(z.string())
    .describe('A list of categories for the place (e.g., restaurant, cafe, park).'),
  rating: z.number().optional().describe('The rating of the place, if available (e.g., 4.5).'),
  userPreferences: z
    .string()
    .optional()
    .describe('Optional user preferences or interests to tailor the recommendation.'),
});
export type PlaceRecommendationInput = z.infer<typeof PlaceRecommendationInputSchema>;

/**
 * Output schema for a place recommendation.
 * Contains the generated recommendation text.
 */
const PlaceRecommendationOutputSchema = z.object({
  recommendation: z
    .string()
    .describe('A brief, engaging, and personalized recommendation or description for the place.'),
});
export type PlaceRecommendationOutput = z.infer<typeof PlaceRecommendationOutputSchema>;

/**
 * Generates a brief, personalized recommendation or description for a selected nearby place.
 * @param input - The place details and optional user preferences.
 * @returns A promise that resolves to an object containing the recommendation text.
 */
export async function recommendPlace(input: PlaceRecommendationInput): Promise<PlaceRecommendationOutput> {
  return placeRecommendationFlow(input);
}

/**
 * Defines the Genkit prompt for generating place recommendations.
 * It uses the input place details and user preferences to craft a concise recommendation.
 */
const placeRecommendationPrompt = ai.definePrompt({
  name: 'placeRecommendationPrompt',
  input: {schema: PlaceRecommendationInputSchema},
  output: {schema: PlaceRecommendationOutputSchema},
  prompt: `You are an AI assistant for the Aktvia app, helping users discover nearby places.
Generate a brief, engaging, and personalized recommendation or description for the following place.
Consider its characteristics and user preferences if provided. Keep it concise, about 1-2 sentences.

Place Name: {{{name}}}
Address: {{{address}}}
Categories: {{#each categories}}{{#if @first}}{{{this}}}{{else}}, {{{this}}}{{/if}}{{/each}}
{{#if rating}}Rating: {{{rating}}} out of 5 stars.{{/if}}
{{#if userPreferences}}User Preferences: {{{userPreferences}}}{{/if}}

Recommendation:`,
});

/**
 * Defines the Genkit flow for place recommendation.
 * It orchestrates the call to the recommendation prompt.
 */
const placeRecommendationFlow = ai.defineFlow(
  {
    name: 'placeRecommendationFlow',
    inputSchema: PlaceRecommendationInputSchema,
    outputSchema: PlaceRecommendationOutputSchema,
  },
  async input => {
    const {output} = await placeRecommendationPrompt(input);
    return output!;
  }
);
