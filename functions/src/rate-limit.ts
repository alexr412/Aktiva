import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Shared Firestore-backed rate limiter helper.
 */
export async function enforceRateLimit(
  userId: string,
  action: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<void> {
  const db = admin.firestore();
  const now = Date.now();
  const rateLimitRef = db.collection('rate_limits').doc(`${userId}_${action}`);
  const snap = await rateLimitRef.get();

  if (snap.exists) {
    const data = snap.data();
    const attempts: number[] = (data?.attempts || []).filter(
      (ts: number) => now - ts < windowSeconds * 1000
    );

    if (attempts.length >= maxAttempts) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded for ${action}. Please try again later.`
      );
    }

    attempts.push(now);
    await rateLimitRef.set({ attempts, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  } else {
    await rateLimitRef.set({
      attempts: [now],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}
