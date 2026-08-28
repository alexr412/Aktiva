import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminAppCheck } from '@/lib/firebase/admin-server';
import { recordCacheTelemetryServer } from '@/lib/usage-tracker';
import { checkDualDistributedRateLimit } from '@/lib/rate-limiter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. App Check Verification Header (Verify token if present)
  const appCheckHeader = req.headers.get('x-firebase-appcheck');

  if (appCheckHeader && adminAppCheck) {
    try {
      await adminAppCheck.verifyToken(appCheckHeader);
    } catch (appCheckErr) {
      return NextResponse.json({ error: 'App Check verification failed' }, { status: 403 });
    }
  }

  // 2. Authentication
  let uid = 'anonymous';
  const authHeader = req.headers.get('authorization') || '';

  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7);
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
      } catch (authErr) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
      }
    }
  } else if (process.env.NODE_ENV === 'development') {
    uid = req.headers.get('x-dev-uid') || 'dev_admin_user';
  } else {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 3. Distributed Telemetry Rate Limiting (UID: 20 req/min, Hashed IP: 40 req/min)
  const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const rateLimitResult = await checkDualDistributedRateLimit(`telemetry_${uid}`, clientIp, 20, 40);

  if (!rateLimitResult.success) {
    return NextResponse.json({ error: rateLimitResult.reason || 'Too many telemetry reports' }, { status: 429 });
  }

  try {
    const body = await req.json();

    // 4. Strict Telemetry Batch Maximum Hardening
    const rawHits = Number(body?.cacheHits) || 0;
    const rawMisses = Number(body?.cacheMisses) || 0;

    // Cap client telemetry between 0 and 100 hits/misses per batch
    const cacheHits = Math.min(Math.max(0, rawHits), 100);
    const cacheMisses = Math.min(Math.max(0, rawMisses), 100);

    if (cacheHits > 0 || cacheMisses > 0) {
      await recordCacheTelemetryServer(uid, cacheHits, cacheMisses);
    }

    return NextResponse.json({ success: true, processedHits: cacheHits, processedMisses: cacheMisses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Telemetry error' }, { status: 500 });
  }
}
