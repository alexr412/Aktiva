// Stub functions.config() for compatibility with older dependencies in firebase-functions v7+
const functionsPkg = require("firebase-functions");
if (typeof functionsPkg.config !== 'function') {
  functionsPkg.config = () => ({});
}

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

const getFirestore = admin.firestore;

// Cloud Function trigger for nearby/friend notifications is now exported below from TypeScript.

/**
 * Kern-Logik für das Performance-Reporting (Wiederverwendbar)
 */
async function aggregateAndSendReports() {
  const db = getFirestore();
  const oneWeekAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const activitiesSnap = await db.collection("activities")
    .where("status", "==", "completed")
    .where("createdAt", ">=", oneWeekAgo)
    .get();

  if (activitiesSnap.empty) return { processed: 0 };

  const hostStats = {};
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
    const userDoc = await db.collection("users").doc(hostId).get();
    const user = userDoc.data();

    if (user && user.fcmToken) {
      const message = {
        token: user.fcmToken,
        notification: {
          title: "Dein Wochenbericht ist da 📊",
          body: `Deine ${stats.count} Aktivitäten erreichten ${stats.impressions} Aufrufe und generierten ${stats.pushJoins} direkte Push-Beitritte.`,
        },
        data: { click_action: "FLUTTER_NOTIFICATION_CLICK" }
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
 * Scheduled Function: Jeden Sonntag um 20:00 Uhr
 */
exports.weeklyHostReport = onSchedule("every sunday 20:00", async (event) => {
  console.log("Starting scheduled weekly report...");
  const result = await aggregateAndSendReports();
  console.log(`Weekly report finished. Processed ${result.processed} activities, sent ${result.sent} notifications.`);
});

function hasAdminAccess(data) {
  return data?.role === "admin" || data?.isAdmin === true;
}

/**
 * HTTPS Callable: Manueller Trigger für Admin-Diagnostic
 */
exports.triggerWeeklyReportManual = onCall(async (request) => {
  // RBAC: Nur Admins dürfen manuell triggern
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  const callerUid = request.auth.uid;
  const callerDoc = await getFirestore().collection("users").doc(callerUid).get();
  if (!callerDoc.exists) {
    throw new HttpsError("permission-denied", "Caller profile not found.");
  }
  if (!hasAdminAccess(callerDoc.data())) {
    throw new HttpsError("permission-denied", "Unauthorized access.");
  }

  return await aggregateAndSendReports();
});

/**
 * MODUL 20: Automatisiertes Hygiene-System.
 * Löscht inaktive Chats (> 365 Tage) inklusive Nachrichten.
 */
exports.chatRetentionPolicy = onSchedule("every 24 hours", async (event) => {
  const db = getFirestore();
  const thresholdDate = new Date();
  thresholdDate.setFullYear(thresholdDate.getFullYear() - 1);
  const thresholdTimestamp = admin.firestore.Timestamp.fromDate(thresholdDate);

  const chatsSnap = await db.collection("chats")
    .where("lastActivityAt", "<", thresholdTimestamp)
    .get();

  if (chatsSnap.empty) return null;

  for (const chatDoc of chatsSnap.docs) {
    const batch = db.batch();

    // Nachrichten löschen
    const messagesSnap = await chatDoc.ref.collection("messages").get();
    messagesSnap.forEach(m => batch.delete(m.ref));

    // Chat-Dokument löschen
    batch.delete(chatDoc.ref);

    try {
      await batch.commit();
      console.log(`Chat ${chatDoc.id} deleted due to inactivity.`);
    } catch (err) {
      console.error(`Failed to delete chat ${chatDoc.id}:`, err);
    }
  }

  return null;
});

/**
 * MODUL 19: Automatisierte Creator-Status Validierung.
 * Prüft Reputations-Metriken und setzt den Status atomar.
 */
exports.validateCreatorStatus = onSchedule("every 12 hours", async (event) => {
  const db = getFirestore();
  // Suche nach Nutzern, die noch keine Creator sind
  const usersSnap = await db.collection("users").where("isCreator", "==", false).get();

  if (usersSnap.empty) return null;

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;

    // 1. Abgeschlossene Aktivitäten zählen
    const activitiesSnap = await db.collection("activities")
      .where("hostId", "==", userId)
      .where("status", "==", "completed")
      .get();

    const activitiesCount = activitiesSnap.size;
    const avgRating = userData.averageRating || 0;

    // 2. Schwellenwert-Prüfung: Min. 20 Events & 4.4 Sterne Reputation
    if (activitiesCount >= 20 && avgRating >= 4.4) {
      await userDoc.ref.update({
        isCreator: true,
        creatorApprovedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`User ${userId} promoted to Creator status automatically based on metrics.`);
    }
  }

  return null;
});

// Semantic Vector Search Embeddings
const embeddings = require('./lib/embeddings');
exports.generateActivityEmbeddingOnCreate = embeddings.onActivityCreated;
exports.generateActivityEmbeddingOnUpdate = embeddings.onActivityUpdated;
exports.getSearchVector = embeddings.getSearchVector;

// User Profile Fan-Out Sync
const users = require('./lib/users');
exports.syncUserProfileUpdates = users.syncUserProfileUpdates;
exports.onUserCreated = users.onUserCreated;
exports.requireSocialEmailVerification = users.requireSocialEmailVerification;
exports.verifyEmailStatus = users.verifyEmailStatus;
exports.checkAndRecordVerificationEmail = users.checkAndRecordVerificationEmail;
exports.cleanupEmptyChats = users.cleanupEmptyChats;
exports.onUserDeleted = users.onUserDeleted;
exports.applyReferralCode = users.applyReferralCode;
exports.processReferralOnboardingCompletion = users.processReferralOnboardingCompletion;
exports.getPublicProfile = users.getPublicProfile;
exports.searchUserByUsername = users.searchUserByUsername;
exports.checkUsernameAvailability = users.checkUsernameAvailability;
exports.claimUsername = users.claimUsername;
exports.earnToken = users.earnToken;
exports.resolveLoginIdentifier = users.resolveLoginIdentifier;
exports.secureSendFriendRequest = users.secureSendFriendRequest;
exports.secureAcceptFriendRequest = users.secureAcceptFriendRequest;

// Aktiva Points & Referrals Activities Triggers
const activities = require('./lib/activities');
exports.onActivityCreated = activities.onActivityCreated;
exports.onActivityUpdated = activities.onActivityUpdated;
exports.notifyNearbyUsers = activities.notifyNearbyUsers;
exports.respondToJoinRequest = activities.respondToJoinRequest;
exports.secureRequestJoinActivity = activities.secureRequestJoinActivity;

// Telemetry Aggregation & Data Retention
const aggregation = require('./lib/aggregation');
exports.telemetryAggregationWorker = aggregation.telemetryAggregationWorker;

// Secure Payments & Escrow
const payments = require('./lib/payments');
exports.secureJoinPaidActivity = payments.secureJoinPaidActivity;
exports.secureCompleteActivity = payments.secureCompleteActivity;
exports.secureVoteToCompleteActivity = payments.secureVoteToCompleteActivity;
exports.secureCancelActivity = payments.secureCancelActivity;
exports.secureRequestPayout = payments.secureRequestPayout;
exports.secureLeaveActivity = payments.secureLeaveActivity;
exports.onKycRequestCreated = payments.onKycRequestCreated;
exports.onPayoutRequestUpdated = payments.onPayoutRequestUpdated;
exports.onRefundUpdated = payments.onRefundUpdated;

// Secure Voting (Server-Side)
const votes = require('./lib/votes');
exports.secureVotePlace = votes.secureVotePlace;
exports.secureVoteActivity = votes.secureVoteActivity;

// Secure Chats (Server-Side)
const chats = require('./lib/chats');
exports.sendChatMessage = chats.sendChatMessage;
exports.onChatUpdated = chats.onChatUpdated;

