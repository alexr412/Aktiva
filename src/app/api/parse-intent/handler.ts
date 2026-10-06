import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateSearchIntent, GROQ_MODEL, type IntentGeneration } from '@/ai/groq';
import { parseLocalSearchIntent, normalizeSearchQuery, VALID_SEARCH_TAGS, type SearchIntent } from '@/lib/search-intent';
import { rateLimit } from '@/lib/rate-limit';
import { verifyNextRequestAppCheck } from '@/lib/firebase/admin-app-check';
import { adminAuth } from '@/lib/firebase/admin-server';
import { sharedApiCache } from '@/lib/shared-api-cache';
import { ServerResponseCache, responseCacheKey } from '@/lib/server-response-cache';

export interface ParseIntentDependencies {
  verifyAppCheck?: typeof verifyNextRequestAppCheck;
  adminAuth?: typeof adminAuth;
  rateLimit?: typeof rateLimit;
  aiGenerate?: (options: { prompt: string; signal?: AbortSignal }) => Promise<IntentGeneration>;
  cache?: ServerResponseCache;
  recordUserTokenUsage?: (data: { uid: string; promptTokens: number; completionTokens: number; feature: string }) => Promise<void>;
  loadUsageTracker?: () => Promise<{ recordUserTokenUsage: NonNullable<ParseIntentDependencies['recordUserTokenUsage']> }>;
}

const Output = z.object({
  categories: z.array(z.string()).max(5), filterByName: z.boolean(),
  nameQuery: z.string().max(200).optional(), radiusKm: z.number().min(0.1).max(100).nullable().optional(),
});
export function createParseIntentHandler(deps: ParseIntentDependencies = {}) {
  const verifier = deps.verifyAppCheck || verifyNextRequestAppCheck;
  const auth = deps.adminAuth !== undefined ? deps.adminAuth : adminAuth;
  const limiter = deps.rateLimit || rateLimit;
  const cache = deps.cache ?? (deps.aiGenerate ? new ServerResponseCache() : sharedApiCache);
  const loadTracker = deps.loadUsageTracker || (async () => import('@/lib/usage-tracker'));
  return async function POST(req: NextRequest) {
    const appCheckRes = await verifier(req, { routeId: 'API_PARSE_INTENT' });
    if (!appCheckRes.valid) return appCheckRes.errorResponse ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    let userId = 'anonymous';
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader) {
      if (!authHeader.startsWith('Bearer ') || !authHeader.substring(7).trim()) {
        return NextResponse.json({ error: 'Unauthorized: Invalid Authorization header' }, { status: 401 });
      }
      if (!auth) return NextResponse.json({ error: 'Authentication unavailable' }, { status: 503 });
      try { userId = (await auth.verifyIdToken(authHeader.substring(7).trim(), true)).uid; }
      catch { return NextResponse.json({ error: 'Unauthorized: Invalid or revoked token' }, { status: 401 }); }
    }
    const limitCheck = limiter(req, 30, 60000);
    if (!limitCheck.success) return new Response('Too Many Requests', { status: 429, headers: limitCheck.headers });
    let query: string;
    try { query = z.object({ query: z.string().trim().max(200) }).parse(await req.json()).query; }
    catch { return NextResponse.json({ error: 'Query must be a string of at most 200 characters' }, { status: 400 }); }
    const local = parseLocalSearchIntent(query);
    if (local) return NextResponse.json(local);
    const fallback: SearchIntent = { categories: [], filterByName: true, nameQuery: query, radiusKm: null, source: 'fallback' };
    // Missing key: no cache/database or model work, ordinary name search still works.
    if (!deps.aiGenerate && !process.env.GROQ_API_KEY) return NextResponse.json(fallback);
    const key = responseCacheKey('search-intent-v1', { query: normalizeSearchQuery(query), model: GROQ_MODEL });
    const cached = await cache.get<SearchIntent>(key);
    if (cached) return NextResponse.json({ ...cached, source: 'cache' });
    try {
      // Do not coalesce AI requests: a caller's cancellation must not cancel another user's request.
      const result = deps.aiGenerate
        ? await deps.aiGenerate({ prompt: query, signal: req.signal })
        : await generateSearchIntent(query, req.signal);
      // Only actual provider usage; include invalid/truncated outputs in accounting.
      if (userId !== 'anonymous' && result.usage) {
        try {
          const record = deps.recordUserTokenUsage ?? (await loadTracker()).recordUserTokenUsage;
          await record({ uid: userId, promptTokens: result.usage.inputTokens, completionTokens: result.usage.outputTokens, feature: 'intent_parsing' });
        } catch { console.error('[parse-intent] Token accounting failed'); }
      }
      const parsed = Output.safeParse(result.output);
      if (!parsed.success) return NextResponse.json(fallback);
      const categories = parsed.data.filterByName ? [] : [...new Set(parsed.data.categories.filter(tag => VALID_SEARCH_TAGS.includes(tag)))];
      if (parsed.data.filterByName && !parsed.data.nameQuery?.trim()) return NextResponse.json(fallback);
      if (!parsed.data.filterByName && categories.length === 0) return NextResponse.json(fallback);
      const intent: SearchIntent = { ...parsed.data, categories, nameQuery: parsed.data.nameQuery || query, source: 'ai' };
      await cache.set(key, intent, 24 * 60 * 60 * 1000);
      return NextResponse.json(intent);
    } catch {
      return NextResponse.json(fallback);
    }
  };
}
