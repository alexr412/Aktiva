import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

/**
 * MODUL 23: Production-Grade Fan-Out System.
 * Synchronisiert Profiländerungen (Name, Photo) sicher über alle Aktivitäten und Chats.
 * Nutze atomare Chunks zur Vermeidung von Batch-Limit-Fehlern (> 500 Docs).
 */
export const syncUserProfileUpdates = onDocumentUpdated({
  document: 'users/{userId}',
  retry: true // Retry bei transienten Fehlern (z.B. Transaction Contention)
}, async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return null;

  // Nur triggern wenn Name oder Foto sich ändern
  if (before.displayName === after.displayName && before.photoURL === after.photoURL) {
    return null;
  }

  const userId = event.params.userId;
  const newName = after.displayName;
  const newPhotoURL = after.photoURL;
  const db = admin.firestore();

  // Liste aller Dokument-Referenzen sammeln, die geupdatet werden müssen
  const targets: { ref: admin.firestore.DocumentReference, updates: any }[] = [];

  // 1. Aktivitäten suchen (als Teilnehmer oder Host)
  const activitiesSnap = await db.collection('activities')
    .where('participantIds', 'array-contains', userId)
    .get();

  activitiesSnap.forEach(doc => {
    const data = doc.data();
    const updates: any = {};
    let needsUpdate = false;

    if (data.hostId === userId) {
      if (data.hostName !== newName) { updates.hostName = newName; needsUpdate = true; }
      if (data.hostPhotoURL !== newPhotoURL) { updates.hostPhotoURL = newPhotoURL; needsUpdate = true; }
    }

    if (data.participantDetails?.[userId]) {
      updates[`participantDetails.${userId}.displayName`] = newName;
      updates[`participantDetails.${userId}.photoURL`] = newPhotoURL;
      needsUpdate = true;
    }

    if (Array.isArray(data.participantsPreview)) {
      const idx = data.participantsPreview.findIndex((p: any) => p.uid === userId);
      if (idx !== -1) {
        const newPreview = [...data.participantsPreview];
        newPreview[idx] = { ...newPreview[idx], displayName: newName, photoURL: newPhotoURL };
        updates.participantsPreview = newPreview;
        needsUpdate = true;
      }
    }

    if (needsUpdate) targets.push({ ref: doc.ref, updates });
  });

  // 2. Chats suchen
  const chatsSnap = await db.collection('chats')
    .where('participantIds', 'array-contains', userId)
    .get();

  chatsSnap.forEach(doc => {
    const data = doc.data();
    if (data.participantDetails?.[userId]) {
      targets.push({
        ref: doc.ref,
        updates: {
          [`participantDetails.${userId}.displayName`]: newName,
          [`participantDetails.${userId}.photoURL`]: newPhotoURL,
        }
      });
    }
  });

  // 3. CHUNKED EXECUTION: Max 400 Writes pro Batch (Sicherheitsmarge)
  if (targets.length > 0) {
    for (let i = 0; i < targets.length; i += 400) {
      const batch = db.batch();
      const chunk = targets.slice(i, i + 400);
      chunk.forEach(t => batch.update(t.ref, t.updates));
      await batch.commit();
    }
    console.log(`Successfully fan-out profile updates for ${userId} to ${targets.length} documents.`);
  }

  return null;
});
