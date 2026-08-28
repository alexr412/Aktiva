import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin-server';
import { db as serverDb } from '@/lib/firebase/server';
import { collection, doc, getDoc, getDocs, limit as limitConstraint, query } from 'firebase/firestore';
import { getBerlinDayKey } from '@/lib/usage-tracker';

export const dynamic = 'force-dynamic';

function parseRestValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('mapValue' in val) return parseFirestoreRestFields(val.mapValue?.fields || {});
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(parseRestValue);
  return val;
}

function parseFirestoreRestFields(fields: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!fields || typeof fields !== 'object') return result;
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseRestValue(val);
  }
  return result;
}

async function checkIsAdmin(uid: string, decodedToken?: any, idToken?: string): Promise<boolean> {
  if (!uid) return false;

  // 1. Check JWT Claims
  if (decodedToken) {
    const role = decodedToken.role || decodedToken.user_role;
    if (
      role === 'admin' ||
      role === 'superadmin' ||
      role === 'supporter' ||
      decodedToken.isAdmin === true ||
      decodedToken.admin === true ||
      decodedToken.superadmin === true
    ) {
      return true;
    }
  }

  // 2. Try Admin SDK
  if (adminDb) {
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const u = userDoc.data() || {};
        if (u.role === 'admin' || u.role === 'superadmin' || u.role === 'supporter' || u.isAdmin === true) return true;
      }
    } catch (e) {
      console.warn('[Admin Usage API] Admin SDK user check failed, trying REST API/Web SDK fallback:', e);
    }
  }

  // 3. Fallback: Firestore REST API using the user's ID Token (authenticated request)
  if (idToken) {
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'activa-444220';
      const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`;
      const restRes = await fetch(restUrl, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (restRes.ok) {
        const docData = await restRes.json();
        const fields = parseFirestoreRestFields(docData.fields);
        if (fields.role === 'admin' || fields.role === 'superadmin' || fields.role === 'supporter' || fields.isAdmin === true) {
          return true;
        }
      }
    } catch (e) {
      console.warn('[Admin Usage API] Firestore REST API user check failed:', e);
    }
  }

  // 4. Fallback to Web SDK
  if (serverDb) {
    try {
      const docRef = doc(serverDb, 'users', uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const u = snap.data() || {};
        if (u.role === 'admin' || u.role === 'superadmin' || u.role === 'supporter' || u.isAdmin === true) return true;
      }
    } catch (e) {
      console.warn('[Admin Usage API] Web SDK user check failed:', e);
    }
  }

  return false;
}

async function fetchDailyStats(berlinDayKey: string, idToken?: string): Promise<any> {
  if (adminDb) {
    try {
      const dailyDoc = await adminDb.collection('usage_daily').doc(berlinDayKey).get();
      if (dailyDoc.exists) return dailyDoc.data() || {};
    } catch (e) {
      console.warn('[Admin Usage API] Admin SDK daily fetch failed:', e);
    }
  }

  if (idToken) {
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'activa-444220';
      const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/usage_daily/${berlinDayKey}`;
      const restRes = await fetch(restUrl, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (restRes.ok) {
        const docData = await restRes.json();
        return parseFirestoreRestFields(docData.fields);
      }
    } catch (e) {
      console.warn('[Admin Usage API] REST API daily fetch failed:', e);
    }
  }

  if (serverDb) {
    try {
      const docRef = doc(serverDb, 'usage_daily', berlinDayKey);
      const snap = await getDoc(docRef);
      if (snap.exists()) return snap.data() || {};
    } catch (e) {
      console.warn('[Admin Usage API] Web SDK daily fetch failed:', e);
    }
  }

  return {};
}

async function fetchUserUsageRecords(idToken?: string): Promise<any[]> {
  if (adminDb) {
    try {
      const usageSnap = await adminDb.collection('user_usage').limit(100).get();
      if (!usageSnap.empty) {
        return usageSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn('[Admin Usage API] Admin SDK user_usage fetch failed:', e);
    }
  }

  if (idToken) {
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || 'activa-444220';
      const restUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/user_usage?pageSize=100`;
      const restRes = await fetch(restUrl, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (restRes.ok) {
        const data = await restRes.json();
        const docs = data.documents || [];
        return docs.map((d: any) => {
          const nameParts = (d.name || '').split('/');
          const id = nameParts[nameParts.length - 1];
          return { id, ...parseFirestoreRestFields(d.fields) };
        });
      }
    } catch (e) {
      console.warn('[Admin Usage API] REST API user_usage fetch failed:', e);
    }
  }

  if (serverDb) {
    try {
      const q = query(collection(serverDb, 'user_usage'), limitConstraint(100));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      console.warn('[Admin Usage API] Web SDK user_usage fetch failed:', e);
    }
  }

  return [];
}

export async function POST(req: NextRequest) {
  // 1. Verify Authentication & Extract UID
  let uid = '';
  let idToken = '';
  let decodedToken: any = null;
  const authHeader = req.headers.get('authorization') || '';

  if (authHeader.startsWith('Bearer ')) {
    idToken = authHeader.substring(7);
    if (adminAuth) {
      try {
        decodedToken = await adminAuth.verifyIdToken(idToken);
        uid = decodedToken.uid;
      } catch (authErr) {
        try {
          const parts = idToken.split('.');
          if (parts.length === 3) {
            decodedToken = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            uid = decodedToken.user_id || decodedToken.sub || decodedToken.uid || '';
          }
        } catch (e) {}
      }
    } else {
      // Decode JWT payload safely if adminAuth instance failed
      try {
        const parts = idToken.split('.');
        if (parts.length === 3) {
          decodedToken = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
          uid = decodedToken.user_id || decodedToken.sub || decodedToken.uid || '';
        }
      } catch (e) {}
    }
  } else if (process.env.NODE_ENV === 'development') {
    uid = req.headers.get('x-dev-uid') || 'dev_admin_user';
  }

  if (!uid && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // 2. Verify Admin Privileges (Fail-Safe)
  if (process.env.NODE_ENV === 'production') {
    const isAdmin = await checkIsAdmin(uid, decodedToken, idToken);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { search, role, sortBy = 'geoapifyCredits', limit = 50 } = body;
    const queryLimit = Math.min(Math.max(1, Number(limit) || 50), 100);

    const berlinDayKey = getBerlinDayKey();

    // 3. Fetch Daily Global Aggregates (usage_daily/YYYY-MM-DD)
    const dailyData = await fetchDailyStats(berlinDayKey, idToken);

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
    let usageDocs = await fetchUserUsageRecords(idToken);

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
    console.error('[Admin Usage API] Unexpected exception:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch usage stats' }, { status: 500 });
  }
}
