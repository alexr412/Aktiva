import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminAppCheck } from '@/lib/firebase/admin-server';
import { GEOAPIFY_API_KEY } from '@/lib/config';
import { checkDualDistributedRateLimit } from '@/lib/rate-limiter';
import {
  recordGeoapifyServerTransaction,
  IdempotencyConflictError,
  type GeoapifyService
} from '@/lib/usage-tracker';

export const dynamic = 'force-dynamic';

const ALLOWED_SERVICES: GeoapifyService[] = [
  'places',
  'geocoding',
  'reverse_geocoding',
  'autocomplete',
  'place_details',
];

const ALLOWED_PLACES_PARAMS = new Set(['categories', 'filter', 'bias', 'limit', 'offset', 'lang', 'conditions']);
const ALLOWED_GEOCODING_PARAMS = new Set(['text', 'street', 'city', 'postcode', 'country', 'format', 'limit']);
const ALLOWED_REVERSE_PARAMS = new Set(['lat', 'lon', 'limit']);
const ALLOWED_AUTOCOMPLETE_PARAMS = new Set(['text', 'limit', 'lang', 'filter', 'bias']);
const ALLOWED_DETAILS_PARAMS = new Set(['id', 'features', 'details']);

export const ALLOWED_PLACE_DETAIL_FEATURES = new Set([
  'details',
  'building',
  'details.names',
  'details.population',
  'details.full_geometry',
]);

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

export async function POST(req: NextRequest) {
  // 1. App Check Verification Header (Production Fail-Closed)
  const appCheckHeader = req.headers.get('x-firebase-appcheck');

  if (process.env.NODE_ENV === 'production') {
    if (!appCheckHeader) {
      return NextResponse.json({ error: 'X-Firebase-AppCheck header missing' }, { status: 403 });
    }
    if (adminAppCheck) {
      try {
        await adminAppCheck.verifyToken(appCheckHeader);
      } catch (appCheckErr) {
        return NextResponse.json({ error: 'App Check verification failed' }, { status: 403 });
      }
    }
  } else if (adminAppCheck && appCheckHeader) {
    try {
      await adminAppCheck.verifyToken(appCheckHeader);
    } catch (e) {
      // Dev mode log
    }
  }

  // 2. Verify Authentication & Extract Server-Side UID
  let uid = 'anonymous';
  const authHeader = req.headers.get('authorization') || '';

  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7);
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
      } catch (authErr) {
        return NextResponse.json({ error: 'Invalid or expired Firebase ID token' }, { status: 401 });
      }
    }
  } else if (process.env.NODE_ENV === 'development') {
    uid = req.headers.get('x-dev-uid') || 'dev_admin_user';
  } else {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 3. Distributed Dual Rate Limiting (UID: 60 req/min, Hashed IP: 120 req/min)
  const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimitResult = await checkDualDistributedRateLimit(uid, clientIp, 60, 120);

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

    const url = new URL(targetEndpoint);
    for (const [k, v] of Object.entries(sanitizedParams)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set('apiKey', GEOAPIFY_API_KEY || '');

    // 8. Execute Geoapify Fetch
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      // Record Error Transaction
      await recordGeoapifyServerTransaction({
        uid,
        service,
        params: sanitizedParams,
        responseData: {},
        usageEventId,
        statusCode: res.status,
        isError: true,
      }).catch(err => console.error('[Geoapify Gateway] Error log failed:', err));

      return NextResponse.json(
        { error: `Geoapify API returned ${res.status}`, details: errorText },
        { status: res.status }
      );
    }

    const responseData = await res.json();

    // 9. Record Transactional Usage & Calculate Credits Atomically
    try {
      await recordGeoapifyServerTransaction({
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
        return NextResponse.json({ error: txErr.message }, { status: 409 });
      }
      console.error('[Geoapify Gateway] Transaction error:', txErr);
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('[Geoapify Gateway] Exception:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
