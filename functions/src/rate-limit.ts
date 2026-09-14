import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

/**
 * Shared Firestore-backed atomic rate limiter helper using transactions.
 */
export async function enforceRateLimit(
  userId: string,
  action: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<void> {
  const db = admin.firestore();
  const rateLimitRef = db.collection('rate_limits').doc(`${userId}_${action}`);

  await db.runTransaction(async (transaction) => {
    const now = Date.now();
    const snap = await transaction.get(rateLimitRef);

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
      transaction.set(rateLimitRef, {
        attempts,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      transaction.set(rateLimitRef, {
        attempts: [now],
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });
}
