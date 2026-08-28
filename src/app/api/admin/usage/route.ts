import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin-server';
import { getBerlinDayKey } from '@/lib/usage-tracker';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // 1. Verify Authentication
  let uid = '';
  const authHeader = req.headers.get('authorization') || '';

  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.substring(7);
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        uid = decoded.uid;
      } catch (authErr) {
        return NextResponse.json({ error: 'Invalid or expired authentication token' }, { status: 401 });
      }
    }
  } else if (process.env.NODE_ENV === 'development') {
    uid = req.headers.get('x-dev-uid') || 'dev_admin_user';
  } else {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 2. Verify Admin Privileges
  if (adminDb && process.env.NODE_ENV === 'production') {
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      const userData = userDoc.data() || {};
      const role = userData.role;
      if (role !== 'admin' && role !== 'superadmin' && userData.isAdmin !== true) {
        return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'Failed to verify admin status' }, { status: 500 });
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { search, role, sortBy = 'geoapifyCredits', limit = 50 } = body;
    const queryLimit = Math.min(Math.max(1, Number(limit) || 50), 100);

    const berlinDayKey = getBerlinDayKey();

    // 3. Fetch Daily Global Aggregates (usage_daily/YYYY-MM-DD)
    let dailyData: any = {};
    if (adminDb) {
      const dailyDoc = await adminDb.collection('usage_daily').doc(berlinDayKey).get();
      if (dailyDoc.exists) {
        dailyData = dailyDoc.data() || {};
      }
    }

    const dailyCreditLimit = Number(process.env.GEOAPIFY_DAILY_CREDIT_LIMIT) || 3000;
    const creditsToday = dailyData.credits || 0;
    const requestsToday = dailyData.requests || 0;
    const cacheHitsToday = dailyData.cacheHits || 0;
    const cacheMissesToday = dailyData.cacheMisses || 0;
    const successCountToday = dailyData.successCount || 0;
    const errorCountToday = dailyData.errorCount || 0;

    const cacheAvoidanceRate = (cacheHitsToday + cacheMissesToday) > 0
      ? Number(((cacheHitsToday / (cacheHitsToday + cacheMissesToday)) * 100).toFixed(1))
      : 0;

    const errorRate = (successCountToday + errorCountToday) > 0
      ? Number(((errorCountToday / (successCountToday + errorCountToday)) * 100).toFixed(1))
      : 0;

    // 4. Fetch User Usage Rankings
    let usageDocs: any[] = [];
    if (adminDb) {
      const usageSnap = await adminDb.collection('user_usage').limit(100).get();
      usageDocs = usageSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Development Seed Fallback
    if (usageDocs.length === 0 && process.env.NODE_ENV !== 'production' && adminDb) {
      const usersSnap = await adminDb.collection('users').limit(15).get();
      let seedIndex = 0;
      const nowYM = berlinDayKey.slice(0, 7).replace('-', '_');

      usageDocs = usersSnap.docs.map(doc => {
        const u = doc.data() || {};
        seedIndex++;
        const promptTok = Math.floor(1200 + (seedIndex * 3400) + (doc.id.length * 150));
        const compTok = Math.floor(400 + (seedIndex * 1100));
        const geoapifyReqs = Math.floor(12 + seedIndex * 9);
        const credits = Math.floor(18 + seedIndex * 14);
        const reqCount = Math.floor(5 + seedIndex * 8) + geoapifyReqs;

        return {
          id: `${nowYM}_${doc.id}`,
          uid: doc.id,
          yearMonth: nowYM,
          displayName: u.displayName || u.username || 'Activa User',
          username: u.username || null,
          email: u.email || null,
          photoURL: u.photoURL || null,
          role: u.role || (u.isAdmin ? 'admin' : (u.isSupporter ? 'supporter' : 'user')),
          isPremium: u.isPremium ?? false,
          geoapifyCredits: credits,
          geoapifyRequests: geoapifyReqs,
          cacheHits: Math.floor(45 + seedIndex * 30),
          cacheMisses: geoapifyReqs,
          promptTokens: promptTok,
          completionTokens: compTok,
          totalTokens: promptTok + compTok,
          requestCount: reqCount,
          estimatedCostUsd: Number((credits * 0.0005).toFixed(4)),
          lastUsedAt: Date.now() - (seedIndex * 3600000 * 3),
          feature: seedIndex % 3 === 0 ? 'geoapify_places' : (seedIndex % 2 === 0 ? 'intent_parsing' : 'activity_generator')
        };
      });
    }

    // Filter by Search Query
    if (search && typeof search === 'string' && search.trim()) {
      const clean = search.trim().toLowerCase();
      usageDocs = usageDocs.filter((item: any) =>
        (item.displayName && item.displayName.toLowerCase().includes(clean)) ||
        (item.username && item.username.toLowerCase().includes(clean)) ||
        (item.email && item.email.toLowerCase().includes(clean)) ||
        (item.uid && item.uid.toLowerCase().includes(clean))
      );
    }

    // Filter by Role
    if (role && role !== 'all') {
      usageDocs = usageDocs.filter((item: any) => {
        if (role === 'free') return !item.isPremium && item.role !== 'admin' && item.role !== 'superadmin';
        if (role === 'premium') return item.isPremium === true;
        if (role === 'admin') return item.role === 'admin' || item.role === 'superadmin';
        return item.role === role;
      });
    }

    // Sort Results
    usageDocs.sort((a: any, b: any) => {
      if (sortBy === 'requestCount') return (b.requestCount || 0) - (a.requestCount || 0);
      if (sortBy === 'cacheHits') return (b.cacheHits || 0) - (a.cacheHits || 0);
      if (sortBy === 'totalTokens') return (b.totalTokens || 0) - (a.totalTokens || 0);
      if (sortBy === 'recent') return (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
      return (b.geoapifyCredits || 0) - (a.geoapifyCredits || 0);
    });

    const slicedItems = usageDocs.slice(0, queryLimit);

    const totalGeoapifyCredits = usageDocs.reduce((acc: number, cur: any) => acc + (cur.geoapifyCredits || 0), 0);
    const totalTokens = usageDocs.reduce((acc: number, cur: any) => acc + (cur.totalTokens || 0), 0);
    const totalRequests = usageDocs.reduce((acc: number, cur: any) => acc + (cur.requestCount || 0), 0);
    const activeUsersCount = usageDocs.length;

    return NextResponse.json({
      items: slicedItems,
      summary: {
        berlinDayKey,
        creditsToday,
        dailyCreditLimit,
        dailyLimitPercentage: Math.min(100, Math.round((creditsToday / dailyCreditLimit) * 100)),
        requestsToday,
        cacheHitsToday,
        cacheMissesToday,
        cacheAvoidanceRate,
        errorRate,
        totalGeoapifyCredits,
        totalTokens,
        totalRequests,
        activeUsersCount,
        services: dailyData.services || {
          places: { requests: 0, credits: 0 },
          geocoding: { requests: 0, credits: 0 },
          reverse_geocoding: { requests: 0, credits: 0 },
          autocomplete: { requests: 0, credits: 0 },
          place_details: { requests: 0, credits: 0 },
        }
      }
    });
  } catch (error: any) {
    console.error('[Admin Usage API] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch usage stats' }, { status: 500 });
  }
}
