import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin-server';
import { canViewUsageMetrics } from '@/lib/permissions';
import { verifyNextRequestAppCheck } from '@/lib/firebase/admin-app-check';

export async function authenticateAndAuthorizeAdminRequest(
  req: NextRequest,
  deps: {
    adminAuth: typeof adminAuth;
    adminDb: typeof adminDb;
  } = { adminAuth, adminDb }
): Promise<{ errorResponse?: NextResponse; uid?: string; role?: string; idToken?: string }> {
  // 0. Verify App Check Token
  const appCheckRes = await verifyNextRequestAppCheck(req, { routeId: 'API_ADMIN_USAGE' });
  if (!appCheckRes.valid && appCheckRes.errorResponse) {
    return { errorResponse: appCheckRes.errorResponse };
  }
  // 1. Verify Configuration Availability (Fail-Closed Configuration Check)
  if (!deps.adminAuth || !deps.adminDb) {
    console.error('[Admin Usage API] Firebase Admin SDK services not available.');
    return {
      errorResponse: NextResponse.json(
        { error: 'Service temporarily unavailable due to administrative configuration error.' },
        { status: 503 }
      )
    };
  }

  // 2. Extract Authorization Header
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { errorResponse: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }

  const idToken = authHeader.substring(7).trim();
  if (!idToken) {
    return { errorResponse: NextResponse.json({ error: 'Authentication token required' }, { status: 401 }) };
  }

  // 3. Verify Firebase ID Token (Check Revoked = true)
  let uid = '';
  try {
    const decodedToken = await deps.adminAuth.verifyIdToken(idToken, true);
    uid = decodedToken.uid;
  } catch (authErr) {
    return { errorResponse: NextResponse.json({ error: 'Invalid or revoked authentication token' }, { status: 401 }) };
  }

  if (!uid) {
    return { errorResponse: NextResponse.json({ error: 'Authentication token invalid' }, { status: 401 }) };
  }

  // 4. Server-Side Firestore User Document Lookup (Authoritative Source of Truth)
  let userRole = 'user';
  try {
    const userDoc = await deps.adminDb.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return { errorResponse: NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 }) };
    }
    const userData = userDoc.data() || {};
    userRole = userData.role || 'user';
  } catch (dbErr) {
    console.error('[Admin Usage API] Failed to fetch user profile:', dbErr);
    return {
      errorResponse: NextResponse.json(
        { error: 'Service temporarily unavailable due to administrative configuration error.' },
        { status: 503 }
      )
    };
  }

  // 5. Authorize User Role
  if (!canViewUsageMetrics(userRole)) {
    return { errorResponse: NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 }) };
  }

  return { uid, role: userRole, idToken };
}
