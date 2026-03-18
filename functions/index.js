const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();

const getFirestore = admin.firestore;

/**
 * Berechnet die Haversine-Entfernung in km.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Cloud Function: Informiert Nutzer im Umkreis, wenn eine geboostete Aktivität erstellt wird.
 */
exports.notifyNearbyUsers = onDocumentCreated("activities/{activityId}", async (event) => {
  const activity = event.data.data();
  
  // Nur für geboostete Aktivitäten feuern
  if (!activity.isBoosted) return null;

  const activityLat = activity.lat;
  const activityLon = activity.lon;
  
  if (!activityLat || !activityLon) {
    console.warn("Activity location missing for boost notification.");
    return null;
  }

  const radius = 2; // 2km Radius

  // Suche alle Nutzer mit FCM Token
  const usersSnap = await getFirestore().collection("users")
    .where("fcmToken", "!=", null)
    .get();
  
  const tokens = [];
  usersSnap.forEach(doc => {
    const user = doc.data();
    
    // Check Opt-In: localHighlights muss aktiv sein
    if (!user.notificationSettings?.localHighlights) return;

    if (user.lastLocation && user.uid !== activity.creatorId) {
      const dist = calculateDistance(activityLat, activityLon, user.lastLocation.lat, user.lastLocation.lng);
      if (dist <= radius) {
        tokens.push(user.fcmToken);
      }
    }
  });

  if (tokens.length > 0) {
    const message = {
      notification: {
        title: "🔥 Hot in deiner Nähe!",
        body: `${activity.creatorName} hat gerade ein Highlight gestartet: "${activity.placeName}".`,
      },
      data: {
        activityId: event.params.activityId,
        source: "push",
        click_action: "FLUTTER_NOTIFICATION_CLICK" 
      },
      tokens: tokens
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Successfully sent ${response.successCount} boost notifications.`);
    } catch (error) {
      console.error("Error sending boost notifications:", error);
    }
  }

  return null;
});

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

/**
 * HTTPS Callable: Manueller Trigger für Admin-Diagnostic
 */
exports.triggerWeeklyReportManual = onCall(async (request) => {
  // RBAC: Nur Admins dürfen manuell triggern
  const callerUid = request.auth.uid;
  const callerDoc = await getFirestore().collection("users").doc(callerUid).get();
  if (!callerDoc.exists || !callerDoc.data().isAdmin) {
    throw new Error("Unauthorized access.");
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
