import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin-server';
import { GEOAPIFY_API_KEY } from '@/lib/config';
import { checkDualDistributedRateLimit } from '@/lib/rate-limiter';
import { buildGeoapifyRequestUrl } from './request-url';
import {
  recordGeoapifyServerTransaction,
  IdempotencyConflictError,
  type GeoapifyService
} from '@/lib/usage-tracker';

import { sharedApiCache } from '@/lib/shared-api-cache';
import { ServerResponseCache, responseCacheKey } from '@/lib/server-response-cache';
export interface GeoapifyDependencies {
  verifyAppCheck?: typeof verifyNextRequestAppCheck;
  auth?: typeof adminAuth;
  limiter?: typeof checkDualDistributedRateLimit;
  fetch?: typeof fetch;
  cache?: ServerResponseCache;
  recordTransaction?: typeof recordGeoapifyServerTransaction;
}

const ALLOWED_SERVICES: GeoapifyService[] = [
  'places',
  'geocoding',
  'reverse_geocoding',
  'autocomplete',
  'place_details',
];

const ALLOWED_PLACES_PARAMS = new Set(['categories', 'filter', 'bias', 'limit', 'offset', 'lang', 'conditions']);
const ALLOWED_GEOCODING_PARAMS = new Set(['text', 'street', 'city', 'postcode', 'country', 'format', 'limit', 'filter', 'bias', 'lang']);
const ALLOWED_REVERSE_PARAMS = new Set(['lat', 'lon', 'limit']);
const ALLOWED_AUTOCOMPLETE_PARAMS = new Set(['text', 'limit', 'lang', 'filter', 'bias']);
const ALLOWED_DETAILS_PARAMS = new Set(['id', 'features', 'details']);

import { ALLOWED_PLACE_DETAIL_FEATURES } from '@/lib/geoapify';

function validateAndSanitizeParams(service: GeoapifyService, rawParams: Record<string, any>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  if (!rawParams || typeof rawParams !== 'object') return sanitized;

  let allowedSet: Set<string>;
  switch (service) {
    case 'places': allowedSet = ALLOWED_PLACES_PARAMS; break;
    case 'geocoding': allowedSet = ALLOWED_GEOCODING_PARAMS; break;
    case 'reverse_geocoding': allowedSet = ALLOWED_REVERSE_PARAMS; break;
    case 'autocomplete': allowedSet = ALLOWED_AUTOCOMPLETE_PARAMS; break;
    case 'place_details': allowedSet = ALLOWED_DETAILS_PARAMS; break;
    default: allowedSet = new Set();
  }

  for (const [key, val] of Object.entries(rawParams)) {
    if (allowedSet.has(key) && val !== undefined && val !== null) {
      sanitized[key] = String(val);
    }
  }

  // Enforce Max Limit Safety
  if (sanitized.limit) {
    const lim = parseInt(sanitized.limit, 10);
    if (!isNaN(lim)) {
      sanitized.limit = String(Math.min(Math.max(1, lim), 60));
    }
  }

  return sanitized;
}

import { verifyNextRequestAppCheck } from '@/lib/firebase/admin-app-check';

export function createGeoapifyHandler(deps: GeoapifyDependencies = {}) {
const cache = deps.cache ?? sharedApiCache;
const auth = deps.auth !== undefined ? deps.auth : adminAuth;
return async function POST(req: NextRequest) {
  // 1. App Check Verification (Must run prior to any rate limit processing or Geoapify API proxying)
  const appCheckRes = await (deps.verifyAppCheck ?? verifyNextRequestAppCheck)(req, { routeId: 'API_GEOAPIFY' });
  if (!appCheckRes.valid) return appCheckRes.errorResponse ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Verify Authentication & Extract Server-Side UID
  let uid = 'anonymous';
  const authHeader = req.headers.get('authorization') || '';

  if (authHeader) {
    if (!authHeader.startsWith('Bearer ') || !authHeader.substring(7).trim()) return NextResponse.json({ error: 'Invalid Authorization header' }, { status: 401 });
    if (!auth) return NextResponse.json({ error: 'Authentication unavailable' }, { status: 503 });
    const idToken = authHeader.substring(7);
    if (auth) {
      try {
        const decoded = await auth.verifyIdToken(idToken.trim(), true);
        uid = decoded.uid;
      } catch (authErr) {
        return NextResponse.json({ error: 'Invalid or expired Firebase ID token' }, { status: 401 });
      }
    }
  }

  // 3. Distributed Dual Rate Limiting (UID: 60 req/min, Hashed IP: 120 req/min)
  const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimitResult = await (deps.limiter ?? checkDualDistributedRateLimit)(uid, clientIp, 60, 120);

  if (!rateLimitResult.success) {
    return NextResponse.json({
      error: rateLimitResult.reason || 'Too many requests. Rate limit exceeded.',
      retryAfterMs: rateLimitResult.resetTimeMs - Date.now(),
    }, { status: 429 });
  }

  try {
    const body = await req.json();
    const service: GeoapifyService = body?.service;
    const rawParams = body?.params || {};
    const usageEventId: string = body?.usageEventId || crypto.randomUUID();

    // 4. Validate Service Whitelist
    if (!service || !ALLOWED_SERVICES.includes(service)) {
      return NextResponse.json({ error: `Service '${service}' is not allowed.` }, { status: 400 });
    }

    // 5. Validate & Sanitize Parameters Allowlist
    const sanitizedParams = validateAndSanitizeParams(service, rawParams);

    // 6. Enforce Strict Place Details Feature Whitelist
    if (service === 'place_details') {
      const requestedFeatStr = sanitizedParams.features || sanitizedParams.details || '';
      if (requestedFeatStr) {
        const requestedFeatures = requestedFeatStr.split(',').map(f => f.trim()).filter(Boolean);
        for (const feat of requestedFeatures) {
          if (!ALLOWED_PLACE_DETAIL_FEATURES.has(feat as any)) {
            return NextResponse.json({
              error: `Unsupported Place Details feature: '${feat}'. Feature must be explicitly allowed before activation.`
            }, { status: 400 });
          }
        }
      }
    }

    // 7. Construct Target Geoapify URL
    let targetEndpoint = 'https://api.geoapify.com/v2/places';
    if (service === 'geocoding') targetEndpoint = 'https://api.geoapify.com/v1/geocode/search';
    else if (service === 'reverse_geocoding') targetEndpoint = 'https://api.geoapify.com/v1/geocode/reverse';
    else if (service === 'autocomplete') targetEndpoint = 'https://api.geoapify.com/v1/geocode/autocomplete';
    else if (service === 'place_details') targetEndpoint = 'https://api.geoapify.com/v2/place-details';

    const url = buildGeoapifyRequestUrl(targetEndpoint, sanitizedParams, GEOAPIFY_API_KEY || '');

    const cacheKey = responseCacheKey('geoapify-v1-' + service, sanitizedParams);
    const cached = await cache.get<unknown>(cacheKey);
    if (cached !== null) return NextResponse.json(cached, { headers: { 'X-Aktiva-Cache': 'hit' } });
    const { value, shared } = await cache.coalesce(cacheKey, async () => {
    // Only the owner performs the provider request and records actual credits.
    // 8. Execute Geoapify Fetch
    const res = await (deps.fetch ?? fetch)(url.toString(), {
      method: 'GET', signal: AbortSignal.timeout(15000), cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      // Record Error Transaction
      await (deps.recordTransaction ?? recordGeoapifyServerTransaction)({
        uid,
        service,
        params: sanitizedParams,
        responseData: {},
        usageEventId,
        statusCode: res.status,
        isError: true,
      }).catch(err => console.error('[Geoapify Gateway] Error log failed:', err));

      return { error: `Geoapify API returned ${res.status}`, details: errorText, status: res.status };
    }

    const responseData = await res.json();

    // 9. Record Transactional Usage & Calculate Credits Atomically
    try {
      await (deps.recordTransaction ?? recordGeoapifyServerTransaction)({
        uid,
        service,
        params: sanitizedParams,
        responseData,
        usageEventId,
        statusCode: 200,
        isError: false,
      });
    } catch (txErr) {
      if (txErr instanceof IdempotencyConflictError) {
        return { error: txErr.message, status: 409, details: undefined };
      }
      console.error('[Geoapify Gateway] Transaction error:', txErr);
    }

    const empty = (Array.isArray(responseData.features) && responseData.features.length === 0) || (Array.isArray(responseData.results) && responseData.results.length === 0);
    const ttl = empty ? 5 * 60 * 1000 : service === 'place_details' ? 6 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    await cache.set(cacheKey, responseData, ttl);
    return { responseData };
    });
    if ('error' in value) return NextResponse.json({ error: value.error, details: value.details }, { status: value.status });
    return NextResponse.json(value.responseData, { headers: { 'X-Aktiva-Cache': shared ? 'shared' : 'miss' } });
  } catch (error: any) {
    console.error('[Geoapify Gateway] Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
};
}
