import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/parse-intent
// Body: { query: string }
// Response: { categories: string[] }
//
// Returns an array of valid Geoapify category tags for intent-based queries.
// Uses Genkit Structured Outputs (JSON Schema) for guaranteed type safety.
// ---------------------------------------------------------------------------

const VALID_GEOAPIFY_TAGS = [
  'entertainment.cinema',
  'entertainment.culture',
  'entertainment.museum',
  'entertainment.zoo',
  'entertainment.aquarium',
  'entertainment.theme_park',
  'entertainment.activity_park',
  'entertainment.miniature_golf',
  'entertainment.water_park',
  'entertainment.escape_game',
  'entertainment.bowling_alley',
  'entertainment.amusement_arcade',
  'leisure.park',
  'leisure.garden',
  'leisure.nature_reserve',
  'leisure.beach',
  'leisure.playground',
  'sport',
  'sport.sports_centre',
  'sport.swimming_pool',
  'sport.stadium',
  'catering.restaurant',
  'catering.cafe',
  'catering.bar',
  'catering.pub',
  'catering.fast_food',
  'catering.ice_cream',
  'adult.nightclub',
  'tourism.sights',
  'tourism.attraction',
  'building.historic',
  'natural.water',
  'beach',
  'religion',
  'education',
  'building.commercial',
  'commercial.shopping_mall'
];

const IntentSchema = z.object({
  categories: z.array(z.string()),
  filterByName: z.boolean(),
});

const SYSTEM_PROMPT = `Du bist ein Taxonomie-Router für Geoapify-Tags. 
Deine Aufgabe ist es, die Nutzereingabe so präzise wie möglich in Kategorien zu übersetzen, um den "Daten-Eimer" der API-Response klein zu halten (Limit: 300 Items).

REGELN:
1. Nutze AUSSCHLIESSLICH Tags aus dieser Liste: ${VALID_GEOAPIFY_TAGS.join(', ')}.
2. Fasse die Kategorien so ENG wie möglich. Wähle lieber einen spezifischen Tag als einen breiten.
3. Setze 'filterByName' auf TRUE, wenn die Eingabe ein spezifischer Eigenname ist (z.B. 'Sprungwerk', 'Cinestar'). Rate in diesem Fall die passenden Kategorien, um den Fetch einzugrenzen.
4. Setze 'filterByName' auf FALSE, wenn die Eingabe ein allgemeiner Intent ist (z.B. 'sport', 'minigolf').

BEISPIELE FÜR DEIN VERHALTEN:
Eingabe: 'Ich mag Minigolf' → { "categories": ["entertainment.miniature_golf"], "filterByName": false }
Eingabe: 'Sprungwerk' → { "categories": ["entertainment.activity_park", "sport"], "filterByName": true }
Eingabe: 'Action' → { "categories": ["entertainment.activity_park", "sport"], "filterByName": false }
Eingabe: 'kino' → { "categories": ["entertainment.cinema"], "filterByName": false }
Eingabe: 'Cinestar' → { "categories": ["entertainment.cinema"], "filterByName": true }
Eingabe: 'essen' → { "categories": ["catering.restaurant", "catering.cafe"], "filterByName": false }`;

export async function POST(req: NextRequest) {
  // Rate Limiting
  const limitCheck = rateLimit(req, 30, 60000); // 30 requests per minute
  if (!limitCheck.success) {
    return new Response('Too Many Requests', { status: 429, headers: limitCheck.headers });
  }

  try {
    const body = await req.json();
    const query: string = (body?.query ?? '').trim();

    if (!query) {
      return NextResponse.json({ categories: [], filterByName: false });
    }

    // Eingabevalidierung (max. 200 Zeichen)
    if (query.length > 200) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 });
    }

    // 3-second timeout via Promise.race
    const parsePromise = ai.generate({
      model: 'googleai/gemini-1.5-flash',
      system: SYSTEM_PROMPT,
      prompt: `Nutzereingabe: "${query}"`,
      output: { schema: IntentSchema },
      config: {
        temperature: 0,
      },
    });

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 3000)
    );

    const result = await Promise.race([parsePromise, timeoutPromise]);

    // Timeout or failure to generate output
    if (!result || !result.output) {
      return NextResponse.json({ categories: [], filterByName: true });
    }

    const { categories, filterByName } = result.output;

    // Final safety check: ensure all tags are in our whitelist
    const validatedCategories = categories.filter(tag => VALID_GEOAPIFY_TAGS.includes(tag));

    return NextResponse.json({ categories: validatedCategories, filterByName });
  } catch (error) {
    console.error('[parse-intent] Error:', error);
    return NextResponse.json({ categories: [], filterByName: true });
  }
}
