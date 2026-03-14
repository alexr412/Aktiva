const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
        source: "push", // Modul 7 Tracking Flag
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
