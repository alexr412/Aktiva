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

// Weekly Host Performance Reports (Lazy Loaded from TypeScript)
lazyExport('weeklyHostReport', './lib/reports');
lazyExport('triggerWeeklyReportManual', './lib/reports');

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

    // Nur Nutzer mit eingereichter Creator-Bewerbung ("pending") prüfen
    const pendingAppSnap = await db.collection("creator_applications")
      .where("userId", "==", userId)
      .where("status", "==", "pending")
      .get();

    if (pendingAppSnap.empty) continue;

    const usersMod = require('./lib/users');
    const activitiesCount = await usersMod.getCanonicalActivitiesCount(db, userId);
    const averageRating = Number(userData.averageRating) || 0;
    const ratingCount = Number(userData.ratingCount) || 0;

    // 2. Schwellenwert-Prüfung: Min. 20 Events, 4.4 Sterne Reputation & 10 Bewertungen
    if (activitiesCount >= 20 && averageRating >= 4.4 && ratingCount >= 10) {
      const batch = db.batch();
      batch.update(userDoc.ref, {
        isCreator: true,
        creatorApprovedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      pendingAppSnap.docs.forEach(appDoc => {
        batch.update(appDoc.ref, { status: "approved" });
      });
      await batch.commit();
      console.log(`User ${userId} creator application approved automatically based on metrics.`);
    }
  }

  return null;
});

// Helper for lazy module exports to ensure fast Functions Discovery (< 100ms)
function lazyExport(exportName, modulePath, targetName) {
  Object.defineProperty(exports, exportName, {
    get: () => require(modulePath)[targetName || exportName],
    enumerable: true,
    configurable: true,
  });
}

// Semantic Vector Search Embeddings (Lazy Loaded)
lazyExport('generateActivityEmbeddingOnCreate', './lib/embeddings', 'onActivityCreated');
lazyExport('generateActivityEmbeddingOnUpdate', './lib/embeddings', 'onActivityUpdated');
lazyExport('getSearchVector', './lib/embeddings', 'getSearchVector');

// User Profile Fan-Out Sync (Lazy Loaded)
lazyExport('syncUserProfileUpdates', './lib/users');
lazyExport('onUserCreated', './lib/users');
lazyExport('requireSocialEmailVerification', './lib/users');
lazyExport('verifyEmailStatus', './lib/users');
lazyExport('checkAndRecordVerificationEmail', './lib/users');
lazyExport('cleanupEmptyChats', './lib/users');
lazyExport('onUserDeleted', './lib/users');
lazyExport('applyReferralCode', './lib/users');
lazyExport('processReferralOnboardingCompletion', './lib/users');
lazyExport('getPublicProfile', './lib/users');
lazyExport('searchUserByUsername', './lib/users');
lazyExport('checkUsernameAvailability', './lib/users');
lazyExport('claimUsername', './lib/users');
lazyExport('earnToken', './lib/users');
lazyExport('resolveLoginIdentifier', './lib/users');
lazyExport('secureSendFriendRequest', './lib/users');
lazyExport('secureAcceptFriendRequest', './lib/users');
lazyExport('secureDeclineFriendRequest', './lib/users');
lazyExport('secureCancelFriendRequest', './lib/users');
lazyExport('submitCreatorApplication', './lib/users');

// Secure Admin User Management (Lazy Loaded)
lazyExport('adminListUsers', './lib/admin-users');
lazyExport('adminGetUserDetail', './lib/admin-users');
lazyExport('adminSetUserRole', './lib/admin-users');
lazyExport('adminSetOrganizerStatus', './lib/admin-users');
lazyExport('adminSetUserPremium', './lib/admin-users');
lazyExport('adminSuspendUser', './lib/admin-users');
lazyExport('adminUnsuspendUser', './lib/admin-users');
lazyExport('adminBanUser', './lib/admin-users');
lazyExport('adminUnbanUser', './lib/admin-users');
lazyExport('adminDeleteUser', './lib/admin-users');
lazyExport('adminBulkUpdateUsers', './lib/admin-users');
lazyExport('adminBackfillUsers', './lib/admin-users');

// Aktiva Points & Referrals Activities Triggers (Lazy Loaded)
lazyExport('onActivityCreated', './lib/activities');
lazyExport('onActivityUpdated', './lib/activities');
lazyExport('notifyNearbyUsers', './lib/activities');
lazyExport('respondToJoinRequest', './lib/activities');
lazyExport('secureRequestJoinActivity', './lib/activities');
lazyExport('kickParticipant', './lib/activities');
lazyExport('secureCreateActivity', './lib/activities');
lazyExport('secureBoostEntity', './lib/activities');

// Telemetry Aggregation & Data Retention (Lazy Loaded)
lazyExport('telemetryAggregationWorker', './lib/aggregation');

// Secure Payments & Escrow (Lazy Loaded)
lazyExport('secureJoinPaidActivity', './lib/payments');
lazyExport('secureCompleteActivity', './lib/payments');
lazyExport('secureVoteToCompleteActivity', './lib/payments');
lazyExport('secureCancelActivity', './lib/payments');
lazyExport('secureRequestPayout', './lib/payments');
lazyExport('secureLeaveActivity', './lib/payments');
lazyExport('onKycRequestCreated', './lib/payments');
lazyExport('onPayoutRequestUpdated', './lib/payments');
lazyExport('onRefundUpdated', './lib/payments');

// Secure Voting (Server-Side) (Lazy Loaded)
lazyExport('secureVotePlace', './lib/votes');
lazyExport('secureVoteActivity', './lib/votes');

// Secure Chats (Server-Side) (Lazy Loaded)
lazyExport('sendChatMessage', './lib/chats');
lazyExport('onChatUpdated', './lib/chats');

// Secure Radar (Server-Side) (Lazy Loaded)
lazyExport('setRadarSettings', './lib/radar');
lazyExport('updateRadarLocation', './lib/radar');
lazyExport('disableRadar', './lib/radar');
lazyExport('getNearbyFriends', './lib/radar');

// Secure Notifications (Server-Side) (Lazy Loaded)
lazyExport('markNotificationRead', './lib/notifications');
lazyExport('markAllNotificationsRead', './lib/notifications');
lazyExport('deleteNotification', './lib/notifications');
// RevenueCat Integration (Lazy Loaded)
lazyExport('revenueCatWebhook', './lib/revenuecat');

// Support Ticket Submission (Lazy Loaded)
lazyExport('submitSupportTicket', './lib/support');





