import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

/**
 * MODUL 22: Secure Payment Processing & Escrow Management.
 * Verarbeitet Zahlungen serverseitig, um Manipulationen am Kontostand zu verhindern.
 * Inkludiert Idempotenz-Check zur Vermeidung von Doppel-Buchungen.
 */
export const secureJoinPaidActivity = onCall(async (request) => {
  // 1. Authentifizierungs-Check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Der Nutzer muss eingeloggt sein.");
  }

  const { activityId, transactionToken, referralId, source } = request.data;
  const uid = request.auth.uid;

  if (!activityId || !transactionToken) {
    throw new HttpsError("invalid-argument", "Pflichtfelder (activityId, transactionToken) fehlen.");
  }

  const db = admin.firestore();

  // 2. Idempotenz-Prüfung: Wurde dieser Token bereits verarbeitet?
  const paymentRef = db.collection("processed_payments").doc(transactionToken);
  const paymentSnap = await paymentRef.get();
  if (paymentSnap.exists) {
    throw new HttpsError("already-exists", "Diese Transaktion wurde bereits verarbeitet.");
  }

  try {
    return await db.runTransaction(async (transaction) => {
      const activityRef = db.collection("activities").doc(activityId);
      const activitySnap = await transaction.get(activityRef);

      if (!activitySnap.exists) {
        throw new HttpsError("not-found", "Aktivität nicht gefunden.");
      }

      const activityData = activitySnap.data();
      if (!activityData) throw new HttpsError("internal", "Datenfehler.");

      // Sicherheits-Check: Ist es wirklich ein bezahltes Event?
      if (!activityData.isPaid) {
        throw new HttpsError("failed-precondition", "Diese Aktivität erfordert keine Zahlung.");
      }

      // Check: Ist der Nutzer bereits Teilnehmer?
      if (activityData.participantIds?.includes(uid)) {
        return { success: true, message: "Bereits Teilnehmer." };
      }

      // Check: Kapazität
      if (activityData.maxParticipants && activityData.participantIds.length >= activityData.maxParticipants) {
        throw new HttpsError("resource-exhausted", "Aktivität ist bereits voll.");
      }

      const price = activityData.price || 0;
      const netAmount = price * 0.9; // 10% Plattform-Fee
      const hostId = activityData.hostId;

      // --- ATOMARE UPDATES ---

      // 3. Teilnehmer zur Aktivität hinzufügen
      const userDoc = await transaction.get(db.collection("users").doc(uid));
      const userData = userDoc.data();
      const hostRef = db.collection("users").doc(hostId);

      transaction.update(activityRef, {
        participantIds: admin.firestore.FieldValue.arrayUnion(uid),
        [`participantDetails.${uid}`]: {
          displayName: userData?.displayName || "Teilnehmer",
          photoURL: userData?.photoURL || null,
          isPremium: userData?.isPremium || false,
          checkInStatus: "pending",
          hasReviewed: false
        },
        lastInteractionAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. Saldo des Hosts erhöhen (Escrow)
      transaction.update(hostRef, {
        escrowBalance: admin.firestore.FieldValue.increment(netAmount)
      });

      // 5. Idempotenz-Doc erstellen
      transaction.set(paymentRef, {
        uid,
        activityId,
        amount: price,
        status: "completed",
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 6. Chat-Teilnahme & unreadCount (Sync mit client logic)
      const chatRef = db.collection("chats").doc(activityId);
      transaction.update(chatRef, {
        participantIds: admin.firestore.FieldValue.arrayUnion(uid),
        [`participantDetails.${uid}`]: {
          displayName: userData?.displayName || "Teilnehmer",
          photoURL: userData?.photoURL || null,
          checkInStatus: "pending"
        },
        [`unreadCount.${uid}`]: 0
      });

      // Optional: Referral Logik
      if (referralId && referralId !== uid) {
        const referrerRef = db.collection("users").doc(referralId);
        transaction.update(referrerRef, {
          successfulReferrals: admin.firestore.FieldValue.increment(1)
        });
      }

      return { success: true };
    });
  } catch (error) {
    console.error("Secure Join Transaction failed:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Transaktionsfehler beim Beitritt.");
  }
});
