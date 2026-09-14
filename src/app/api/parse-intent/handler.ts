import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { verifyNextRequestAppCheck } from '@/lib/firebase/admin-app-check';
import { adminAuth } from '@/lib/firebase/admin-server';

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

export interface ParseIntentDependencies {
  verifyAppCheck?: typeof verifyNextRequestAppCheck;
  adminAuth?: typeof adminAuth;
  rateLimit?: typeof rateLimit;
  aiGenerate?: typeof ai.generate;
  recordUserTokenUsage?: (data: { uid: string; promptTokens: number; completionTokens: number; feature: string }) => Promise<void>;
  loadUsageTracker?: () => Promise<{ recordUserTokenUsage: (data: { uid: string; promptTokens: number; completionTokens: number; feature: string }) => Promise<void> }>;
}

export function createParseIntentHandler(deps: ParseIntentDependencies = {}) {
  const verifier = deps.verifyAppCheck || verifyNextRequestAppCheck;
  const auth = deps.adminAuth !== undefined ? deps.adminAuth : adminAuth;
  const limiter = deps.rateLimit || rateLimit;
  const loadTracker = deps.loadUsageTracker || (async () => import('@/lib/usage-tracker'));

  return async function POST(req: NextRequest) {
    // 1. App Check Verification (Must run prior to any AI execution, rate limit, or body json parsing)
    const appCheckRes = await verifier(req, { routeId: 'API_PARSE_INTENT' });
    if (!appCheckRes.valid && appCheckRes.errorResponse) {
      return appCheckRes.errorResponse;
    }

    // 2. Identity Verification (Bearer Token if present)
    let userId = 'anonymous';
    const authHeader = req.headers.get('authorization') || '';

    if (authHeader) {
      if (!authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized: Malformed Authorization header' }, { status: 401 });
      }
      const idToken = authHeader.substring(7).trim();
      if (!idToken) {
        return NextResponse.json({ error: 'Unauthorized: Missing Bearer token' }, { status: 401 });
      }
      if (!auth) {
        return NextResponse.json({ error: 'Service Unavailable: Authentication service uninitialized' }, { status: 503 });
      }
      try {
        const decoded = await auth.verifyIdToken(idToken, true);
        userId = decoded.uid;
      } catch {
        return NextResponse.json({ error: 'Unauthorized: Invalid or revoked Bearer token' }, { status: 401 });
      }
    }

    // 3. Rate Limiting
    const limitCheck = limiter(req, 30, 60000); // 30 requests per minute
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
      const generator = deps.aiGenerate || ((opts: any) => ai.generate(opts));
      const parsePromise = generator({
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

      const promptTokens = (result as any).usage?.inputTokens || Math.ceil((SYSTEM_PROMPT.length + query.length) / 4);
      const completionTokens = (result as any).usage?.outputTokens || Math.ceil(JSON.stringify(result.output).length / 4);

      if (userId !== 'anonymous') {
        try {
          if (deps.recordUserTokenUsage) {
            await deps.recordUserTokenUsage({
              uid: userId,
              promptTokens,
              completionTokens,
              feature: 'intent_parsing',
            });
          } else {
            const { recordUserTokenUsage } = await loadTracker();
            await recordUserTokenUsage({
              uid: userId,
              promptTokens,
              completionTokens,
              feature: 'intent_parsing',
            });
          }
        } catch (err) {
          console.error('[parse-intent] Token log error:', err);
        }
      }

      return NextResponse.json({ categories: validatedCategories, filterByName });
    } catch (error) {
      console.error('[parse-intent] Error:', error);
      return NextResponse.json({ categories: [], filterByName: true });
    }
  };
}
