import * as admin from 'firebase-admin';

export interface NotificationPushPayload {
  notificationId: string;
  eventId?: string;
  type: string;
  title: string;
  body: string;
  targetUrl?: string;
  entityId?: string;
}

/**
 * Sends a background FCM push notification to all active devices of a user.
 * Automatically cleans up invalid / expired tokens.
 */
export async function sendPushToUser(
  userId: string,
  payload: NotificationPushPayload
): Promise<{ successCount: number; failureCount: number; removedTokensCount: number }> {
  if (!userId) {
    return { successCount: 0, failureCount: 0, removedTokensCount: 0 };
  }

  const db = admin.firestore();
  let tokensSnap: any = { empty: true, docs: [] };
  try {
    const userDocRef = db.collection('users').doc(userId);
    if (typeof userDocRef.collection === 'function') {
      const colRef = userDocRef.collection('push_tokens');
      if (colRef && typeof colRef.get === 'function') {
        tokensSnap = await colRef.get();
      }
    }
  } catch (e) {}

  if (!tokensSnap || tokensSnap.empty) {
    return { successCount: 0, failureCount: 0, removedTokensCount: 0 };
  }

  const tokenDocs = tokensSnap.docs.map((d: any) => ({
    id: d.id,
    ref: d.ref,
    token: d.data().token as string,
  }));

  const tokens: string[] = tokenDocs.map((td: any) => td.token).filter(Boolean);
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, removedTokensCount: 0 };
  }

  const message: admin.messaging.MulticastMessage = {
    tokens,
    data: {
      notificationId: String(payload.notificationId || ''),
      eventId: String(payload.eventId || payload.notificationId || ''),
      type: String(payload.type || ''),
      title: String(payload.title || ''),
      body: String(payload.body || ''),
      targetUrl: String(payload.targetUrl || '/'),
      entityId: String(payload.entityId || ''),
    },
    // Omit notification payload so custom Service Worker push handler handles display cleanly
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    let removedTokensCount = 0;

    const cleanupPromises: Promise<any>[] = [];

    response.responses.forEach((res: any, index: number) => {
      if (!res.success && res.error) {
        const errorCode = res.error.code;
        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          // Token is no longer valid -> delete token doc
          cleanupPromises.push(tokenDocs[index].ref.delete());
          removedTokensCount++;
        }
      }
    });

    if (cleanupPromises.length > 0) {
      await Promise.all(cleanupPromises).catch((err) => {
        console.error('[Push] Error cleaning up invalid tokens:', err);
      });
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      removedTokensCount,
    };
  } catch (err) {
    console.error(`[Push] Error sending multicast push to user ${userId}:`, err);
    return { successCount: 0, failureCount: tokens.length, removedTokensCount: 0 };
  }
}
