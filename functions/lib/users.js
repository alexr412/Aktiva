"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncUserProfileUpdates = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
/**
 * Cloud Function to fan-out user profile updates (displayName, photoURL)
 * to all activities and chats where the user is a participant or host.
 */
exports.syncUserProfileUpdates = (0, firestore_1.onDocumentUpdated)('users/{userId}', async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return null;
    // Check if relevant fields changed
    if (before.displayName === after.displayName && before.photoURL === after.photoURL) {
        return null;
    }
    const userId = event.params.userId;
    const newName = after.displayName;
    const newPhotoURL = after.photoURL;
    // Use the pre-initialized admin instance (initialized in index.js)
    const db = admin.firestore();
    const batch = db.batch();
    let updatesCount = 0;
    try {
        // 1. Update Activities
        // Querying by participantIds ensures we find all relevant activities.
        // In Firestore, there is a limit of 500 writes per batch. If a user is in >500 activities,
        // this will fail, but realistically users won't be in 500 active activities.
        const activitiesSnap = await db.collection('activities')
            .where('participantIds', 'array-contains', userId)
            .get();
        activitiesSnap.forEach(doc => {
            const data = doc.data();
            const updates = {};
            let needsUpdate = false;
            // Update Host Info if they are the host
            if (data.hostId === userId) {
                if (data.hostName !== newName) {
                    updates.hostName = newName;
                    needsUpdate = true;
                }
                if (data.hostPhotoURL !== newPhotoURL) {
                    updates.hostPhotoURL = newPhotoURL;
                    needsUpdate = true;
                }
            }
            // Update Participant Details Map
            if (data.participantDetails && data.participantDetails[userId]) {
                updates[`participantDetails.${userId}.displayName`] = newName;
                updates[`participantDetails.${userId}.photoURL`] = newPhotoURL;
                needsUpdate = true;
            }
            // Update participantsPreview array completely
            if (Array.isArray(data.participantsPreview)) {
                const previewIndex = data.participantsPreview.findIndex((p) => p.uid === userId);
                if (previewIndex !== -1) {
                    const newPreview = [...data.participantsPreview];
                    newPreview[previewIndex] = { ...newPreview[previewIndex], displayName: newName, photoURL: newPhotoURL };
                    updates.participantsPreview = newPreview;
                    needsUpdate = true;
                }
            }
            if (needsUpdate) {
                batch.update(doc.ref, updates);
                updatesCount++;
            }
        });
        // 2. Update Chats
        const chatsSnap = await db.collection('chats')
            .where('participantIds', 'array-contains', userId)
            .get();
        chatsSnap.forEach(doc => {
            // Chat participantDetails is typically a map like participantDetails[userId].displayName
            const data = doc.data();
            if (data.participantDetails && data.participantDetails[userId]) {
                batch.update(doc.ref, {
                    [`participantDetails.${userId}.displayName`]: newName,
                    [`participantDetails.${userId}.photoURL`]: newPhotoURL,
                });
                updatesCount++;
            }
        });
        if (updatesCount > 0) {
            // Chunk batches if over 500? For now, standard commit (assuming < 500 active references)
            await batch.commit();
            console.log(`Successfully synced profile updates for ${userId} across ${updatesCount} documents.`);
        }
    }
    catch (err) {
        console.error(`Error syncing user profile update for ${userId}:`, err);
    }
    return null;
});
//# sourceMappingURL=users.js.map