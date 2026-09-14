import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { canManageSystem } from './permissions';

/**
 * Kern-Logik für das Performance-Reporting (Wiederverwendbar)
 */
export async function aggregateAndSendReports(dbInstance?: admin.firestore.Firestore): Promise<{ processed: number; sent: number }> {
  const db = dbInstance || admin.firestore();
  const oneWeekAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const activitiesSnap = await db.collection('activities')
    .where('status', '==', 'completed')
    .where('createdAt', '>=', oneWeekAgo)
    .get();

  if (activitiesSnap.empty) return { processed: 0, sent: 0 };

  const hostStats: Record<string, { impressions: number; pushJoins: number; count: number }> = {};
  activitiesSnap.forEach(doc => {
    const data = doc.data();
    const hostId = data.creatorId;
    if (!hostId) return;

    if (!hostStats[hostId]) {
      hostStats[hostId] = { impressions: 0, pushJoins: 0, count: 0 };
    }
    hostStats[hostId].impressions += (data.stats?.impressions || 0);
    hostStats[hostId].pushJoins += (data.stats?.pushJoins || 0);
    hostStats[hostId].count += 1;
  });

  const messaging = admin.messaging();
  let sentCount = 0;

  for (const [hostId, stats] of Object.entries(hostStats)) {
    const userDoc = await db.collection('users').doc(hostId).get();
    const user = userDoc.data();

    if (user && user.fcmToken) {
      const message = {
        token: user.fcmToken,
        notification: {
          title: 'Dein Wochenbericht ist da 📊',
          body: `Deine ${stats.count} Aktivitäten erreichten ${stats.impressions} Aufrufe und generierten ${stats.pushJoins} direkte Push-Beitritte.`,
        },
        data: { click_action: 'FLUTTER_NOTIFICATION_CLICK' }
      };

      try {
        await messaging.send(message);
        sentCount++;
      } catch (err) {
        console.error(`Failed to send report to host ${hostId}:`, err);
      }
    }
  }

  return { processed: activitiesSnap.size, sent: sentCount };
}

/**
 * Core handler logic for triggerWeeklyReportManual (testable via injection)
 */
export async function handleTriggerWeeklyReportManual(
  request: { auth?: any },
  db?: any,
  reportAggregator: (dbInstance?: any) => Promise<{ processed: number; sent: number }> = aggregateAndSendReports
): Promise<{ processed: number; sent: number }> {
  if (!request?.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerUid = request.auth.uid;
  const firestoreDb = db || admin.firestore();
  const callerDoc = await firestoreDb.collection('users').doc(callerUid).get();

  if (!callerDoc.exists) {
    throw new HttpsError('permission-denied', 'Caller profile not found.');
  }

  const callerData = callerDoc.data();
  const callerRole = callerData?.role;

  // Strict Canonical RBAC: canManageSystem requires 'admin' or 'superadmin' role explicitly.
  // Rejects 'user', 'supporter', 'moderator', 'finance', 'creator', and ignores legacy isAdmin: true flags.
  if (!canManageSystem(callerRole)) {
    throw new HttpsError('permission-denied', 'Unauthorized access.');
  }

  return await reportAggregator(firestoreDb);
}

/**
 * Scheduled Function: Jeden Sonntag um 20:00 Uhr
 */
export const weeklyHostReport = onSchedule('every sunday 20:00', async () => {
  console.log('Starting scheduled weekly report...');
  const result = await aggregateAndSendReports();
  console.log(`Weekly report finished. Processed ${result.processed} activities, sent ${result.sent} notifications.`);
});

/**
 * HTTPS Callable: Manueller Trigger für Admin-Diagnostic
 * Strict Canonical RBAC via canManageSystem(role): Only admin & superadmin allowed.
 * NO isAdmin fallback.
 */
export const triggerWeeklyReportManual = onCall(async (request) => {
  return await handleTriggerWeeklyReportManual(request);
});
