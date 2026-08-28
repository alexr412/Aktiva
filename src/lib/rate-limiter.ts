import { adminDb } from '@/lib/firebase/admin-server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createHash } from 'crypto';

export interface DualRateLimitResult {
  success: boolean;
  reason?: string;
  uidRemaining: number;
  ipRemaining: number;
  resetTimeMs: number;
}

function hashIpAddress(ip: string): string {
  return createHash('sha256').update(ip || '127.0.0.1').digest('hex').substring(0, 16);
}

/**
 * Serverless Distributed Dual Rate Limiter backed by Firestore
 * Enforces BOTH per-UID (max 60 req/min) AND Hashed IP (max 120 req/min) limits.
 * Protects against IP rotation attacks for a single UID and account-creation abuse from a single IP.
 */
export async function checkDualDistributedRateLimit(
  uid: string,
  clientIp: string,
  uidLimit: number = 60,
  ipLimit: number = 120
): Promise<DualRateLimitResult> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minute = String(now.getUTCMinutes()).padStart(2, '0');

  const minuteBucketKey = `${year}${month}${day}_${hour}${minute}`;
  const resetTimeMs = new Date(Date.now() + 60 * 1000).getTime();
  const hashedIp = hashIpAddress(clientIp);

  const uidDocId = `uid_${uid}_${minuteBucketKey}`;
  const ipDocId = `ip_${hashedIp}_${minuteBucketKey}`;

  if (!adminDb) {
    return { success: true, uidRemaining: uidLimit, ipRemaining: ipLimit, resetTimeMs };
  }

  const uidRef = adminDb.collection('rate_limit').doc(uidDocId);
  const ipRef = adminDb.collection('rate_limit').doc(ipDocId);
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 60 * 1000)); // 2 hours TTL

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const [uidSnap, ipSnap] = await Promise.all([
        transaction.get(uidRef),
        transaction.get(ipRef),
      ]);

      const currentUidCount = (uidSnap.exists ? uidSnap.data()?.requests || 0 : 0) + 1;
      const currentIpCount = (ipSnap.exists ? ipSnap.data()?.requests || 0 : 0) + 1;

      if (currentUidCount > uidLimit) {
        return {
          success: false,
          reason: 'User rate limit exceeded (60 requests/min)',
          uidRemaining: 0,
          ipRemaining: Math.max(0, ipLimit - currentIpCount),
          resetTimeMs,
        };
      }

      if (currentIpCount > ipLimit) {
        return {
          success: false,
          reason: 'IP rate limit exceeded (120 requests/min)',
          uidRemaining: Math.max(0, uidLimit - currentUidCount),
          ipRemaining: 0,
          resetTimeMs,
        };
      }

      // Update UID Bucket
      if (!uidSnap.exists) {
        transaction.set(uidRef, {
          type: 'uid',
          target: uid,
          requests: 1,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt,
        });
      } else {
        transaction.update(uidRef, {
          requests: FieldValue.increment(1),
          lastRequestedAt: FieldValue.serverTimestamp(),
        });
      }

      // Update IP Bucket
      if (!ipSnap.exists) {
        transaction.set(ipRef, {
          type: 'ip',
          hashedIp,
          requests: 1,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt,
        });
      } else {
        transaction.update(ipRef, {
          requests: FieldValue.increment(1),
          lastRequestedAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        success: true,
        uidRemaining: Math.max(0, uidLimit - currentUidCount),
        ipRemaining: Math.max(0, ipLimit - currentIpCount),
        resetTimeMs,
      };
    });
  } catch (error) {
    console.error('[Dual Rate Limiter] Transaction error:', error);
    return { success: true, uidRemaining: uidLimit, ipRemaining: ipLimit, resetTimeMs };
  }
}
