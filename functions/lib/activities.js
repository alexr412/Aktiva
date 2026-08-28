"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kickParticipant = exports.secureRequestJoinActivity = exports.respondToJoinRequest = exports.ALLOWED_GENDERS = exports.notifyNearbyUsers = exports.onActivityUpdated = exports.onActivityCreated = void 0;
exports.normalizeAndValidateGenderRequirements = normalizeAndValidateGenderRequirements;
exports.validateActivityEligibility = validateActivityEligibility;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const firestore_2 = require("firebase-admin/firestore");
const notifications_1 = require("./notifications");
const users_1 = require("./users");
/**
 * Triggers when an activity is created. Awards +10 points to the host (daily cap of 2).
 */
exports.onActivityCreated = (0, firestore_1.onDocumentCreated)({
    document: 'activities/{activityId}',
    retry: true
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return null;
    const activity = snapshot.data();
    const activityId = event.params.activityId;
    const hostId = activity.hostId;
    if (!hostId) {
        console.warn(`Activity ${activityId} has no hostId.`);
        return null;
    }
    const db = admin.firestore();
    try {
        await db.runTransaction(async (transaction) => {
            // 1. Idempotency check
            const ledgerRef = db.collection('users').doc(hostId).collection('pointsLedger').doc(`event_created_${activityId}`);
            const ledgerSnap = await transaction.get(ledgerRef);
            if (ledgerSnap.exists) {
                console.log(`Event created points already awarded for activity ${activityId}`);
                return;
            }
            // 2. Query for event_created entries in the last 24 hours to enforce daily cap (max 2)
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const query = db.collection('users').doc(hostId).collection('pointsLedger')
                .where('type', '==', 'event_created')
                .where('createdAt', '>=', oneDayAgo);
            const querySnap = await transaction.get(query);
            if (querySnap.size >= 2) {
                console.log(`Host ${hostId} has reached the daily limit of 2 event creation bonuses.`);
                return;
            }
            // 3. Retrieve host profile to update points and level
            const hostRef = db.collection('users').doc(hostId);
            const hostSnap = await transaction.get(hostRef);
            if (!hostSnap.exists) {
                console.warn(`Host profile for ${hostId} not found.`);
                return;
            }
            const hostData = hostSnap.data();
            const hostLifetime = (hostData.pointsLifetime || 0) + 10;
            const hostBalance = (hostData.pointsBalance || 0) + 10;
            const hostNewLevel = (0, users_1.calculateLevel)(hostLifetime);
            // 4. Award +10 points to host ledger
            transaction.set(ledgerRef, {
                type: 'event_created',
                points: 10,
                createdAt: firestore_2.FieldValue.serverTimestamp(),
                sourceId: activityId,
                metadata: {
                    message: `Event erstellt: ${activity.title || 'Aktivität'}`
                }
            });
            // 5. Update host user profile
            transaction.update(hostRef, {
                pointsBalance: hostBalance,
                pointsLifetime: hostLifetime,
                level: hostNewLevel
            });
            console.log(`Awarded +10 event creation points to host ${hostId}. New balance: ${hostBalance}, level: ${hostNewLevel}`);
        });
        // Trigger referral activation on successful activity creation
        await (0, users_1.maybeActivateReferral)(hostId, 'first_activity_created');
    }
    catch (error) {
        console.error(`Error processing event creation bonus for activity ${activityId}:`, error);
    }
    // Dispatch nearby & friends push notifications for newly created activity
    (0, notifications_1.dispatchNearbyActivityNotifications)(activityId).catch((err) => {
        console.error(`Error dispatching nearby notifications for activity ${activityId}:`, err);
    });
    return null;
});
/**
 * Triggers when an activity document is updated. Handles:
 * 1. First participant joining the event (+20 host points).
 * 2. Host and joiner First Activity Bonus (+50 points, once-in-a-lifetime).
 */
exports.onActivityUpdated = (0, firestore_1.onDocumentUpdated)({
    document: 'activities/{activityId}',
    retry: true
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return null;
    const beforeParticipants = before.participantIds || [];
    const afterParticipants = after.participantIds || [];
    const hostId = after.hostId;
    const activityId = event.params.activityId;
    if (!hostId)
        return null;
    const db = admin.firestore();
    // A. Detect transition of first participant joining (length goes from 1 to 2)
    const justJoinedFirst = (beforeParticipants.length === 1 && afterParticipants.length === 2);
    if (justJoinedFirst) {
        try {
            await db.runTransaction(async (transaction) => {
                // Idempotency check for first join bonus
                const ledgerRef = db.collection('users').doc(hostId).collection('pointsLedger').doc(`event_first_join_${activityId}`);
                const ledgerSnap = await transaction.get(ledgerRef);
                if (ledgerSnap.exists) {
                    console.log(`First participant joined bonus already awarded to host ${hostId} for activity ${activityId}`);
                    return;
                }
                // Retrieve host profile
                const hostRef = db.collection('users').doc(hostId);
                const hostSnap = await transaction.get(hostRef);
                if (!hostSnap.exists)
                    return;
                const hostData = hostSnap.data();
                const hostLifetime = (hostData.pointsLifetime || 0) + 20;
                const hostBalance = (hostData.pointsBalance || 0) + 20;
                const hostNewLevel = (0, users_1.calculateLevel)(hostLifetime);
                // Award +20 points to host ledger
                transaction.set(ledgerRef, {
                    type: 'event_joined_first',
                    points: 20,
                    createdAt: firestore_2.FieldValue.serverTimestamp(),
                    sourceId: activityId,
                    metadata: {
                        message: `Erster Teilnehmer beigetreten: ${after.title || 'Aktivität'}`
                    }
                });
                // Update host user profile
                transaction.update(hostRef, {
                    pointsBalance: hostBalance,
                    pointsLifetime: hostLifetime,
                    level: hostNewLevel
                });
                console.log(`Awarded +20 points to host ${hostId} for first participant joining.`);
            });
        }
        catch (error) {
            console.error(`Error awarding first join points to host:`, error);
        }
    }
    // B. Detect First Activity Bonus (+50)
    // 1. Host first activity bonus when event gets first joiner
    if (justJoinedFirst) {
        try {
            await db.runTransaction(async (transaction) => {
                const hostLedgerRef = db.collection('users').doc(hostId).collection('pointsLedger').doc(`first_activity_bonus_${hostId}`);
                const hostLedgerSnap = await transaction.get(hostLedgerRef);
                if (hostLedgerSnap.exists) {
                    // Already received
                    return;
                }
                const hostRef = db.collection('users').doc(hostId);
                const hostSnap = await transaction.get(hostRef);
                if (!hostSnap.exists)
                    return;
                const hostData = hostSnap.data();
                const hostLifetime = (hostData.pointsLifetime || 0) + 50;
                const hostBalance = (hostData.pointsBalance || 0) + 50;
                const hostNewLevel = (0, users_1.calculateLevel)(hostLifetime);
                transaction.set(hostLedgerRef, {
                    type: 'first_activity_bonus',
                    points: 50,
                    createdAt: firestore_2.FieldValue.serverTimestamp(),
                    sourceId: activityId,
                    metadata: {
                        message: 'Erste Aktivität (Erstes eigenes Event mit Teilnehmern)'
                    }
                });
                transaction.update(hostRef, {
                    pointsBalance: hostBalance,
                    pointsLifetime: hostLifetime,
                    level: hostNewLevel
                });
                console.log(`First Activity Bonus (+50) awarded to host ${hostId}`);
            });
        }
        catch (error) {
            console.error(`Error awarding First Activity Bonus to host:`, error);
        }
    }
    // 2. Joiner(s) first activity bonus on joining any event
    const newParticipants = afterParticipants.filter((id) => !beforeParticipants.includes(id));
    for (const joinerId of newParticipants) {
        // Don't award to host (already handled by host condition, plus host is in beforeParticipants anyway)
        if (joinerId === hostId)
            continue;
        try {
            await db.runTransaction(async (transaction) => {
                const joinerLedgerRef = db.collection('users').doc(joinerId).collection('pointsLedger').doc(`first_activity_bonus_${joinerId}`);
                const joinerLedgerSnap = await transaction.get(joinerLedgerRef);
                if (joinerLedgerSnap.exists) {
                    // Already received
                    return;
                }
                const joinerRef = db.collection('users').doc(joinerId);
                const joinerSnap = await transaction.get(joinerRef);
                if (!joinerSnap.exists)
                    return;
                const joinerData = joinerSnap.data();
                const joinerLifetime = (joinerData.pointsLifetime || 0) + 50;
                const joinerBalance = (joinerData.pointsBalance || 0) + 50;
                const joinerNewLevel = (0, users_1.calculateLevel)(joinerLifetime);
                transaction.set(joinerLedgerRef, {
                    type: 'first_activity_bonus',
                    points: 50,
                    createdAt: firestore_2.FieldValue.serverTimestamp(),
                    sourceId: activityId,
                    metadata: {
                        message: 'Erste Aktivität (Teilnahme an einem Event)'
                    }
                });
                transaction.update(joinerRef, {
                    pointsBalance: joinerBalance,
                    pointsLifetime: joinerLifetime,
                    level: joinerNewLevel
                });
                console.log(`First Activity Bonus (+50) awarded to joiner ${joinerId}`);
            });
            // Fallback: Trigger referral activation on join
            await (0, users_1.maybeActivateReferral)(joinerId, 'first_activity_joined');
        }
        catch (error) {
            console.error(`Error awarding First Activity Bonus to joiner ${joinerId}:`, error);
        }
    }
    return null;
});
/**
 * Berechnet die Haversine-Entfernung in km.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
/**
 * Extrahiert den Vornamen.
 */
function formatFirstName(displayName) {
    if (!displayName)
        return "Ein Freund";
    const parts = displayName.trim().split(/\s+/);
    return parts[0];
}
/**
 * Cloud Function: Informiert Nutzer im Umkreis bei geboosteten Aktivitäten oder Aktivitäten von Freunden.
 */
exports.notifyNearbyUsers = (0, firestore_1.onDocumentCreated)({
    document: 'activities/{activityId}',
    retry: true
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return null;
    const activity = snapshot.data();
    const activityId = event.params.activityId;
    const activityLat = activity.lat;
    const activityLon = activity.lon;
    if (activityLat === undefined || activityLat === null || activityLon === undefined || activityLon === null) {
        console.warn(`Activity ${activityId} location coordinates (lat/lon) missing. Skipping notification.`);
        return null;
    }
    const hostId = activity.hostId || activity.creatorId;
    if (!hostId) {
        console.warn(`Activity ${activityId} has no hostId/creatorId. Skipping notification.`);
        return null;
    }
    const db = admin.firestore();
    // --- PATH A: Boosted Activity Notification (Public) ---
    if (activity.isBoosted) {
        const radius = 2; // 2km Radius
        try {
            // Suche alle Nutzer mit FCM Token
            const usersSnap = await db.collection("users")
                .where("fcmToken", "!=", null)
                .get();
            const tokens = [];
            usersSnap.forEach(doc => {
                const user = doc.data();
                // Check Opt-In: localHighlights muss aktiv sein
                if (!user.notificationSettings?.localHighlights)
                    return;
                if (user.lastLocation && user.lastLocation.lat && user.lastLocation.lng && doc.id !== hostId) {
                    const dist = calculateDistance(activityLat, activityLon, user.lastLocation.lat, user.lastLocation.lng);
                    if (dist <= radius) {
                        tokens.push(user.fcmToken);
                    }
                }
            });
            if (tokens.length > 0) {
                const hostUsernameRaw = activity.hostUsername || null;
                const hostUsernameFormatted = hostUsernameRaw ? `@${hostUsernameRaw.replace(/^@/, '')}` : "Ein Nutzer";
                const placeName = activity.placeName || activity.title || "ein Highlight";
                const message = {
                    notification: {
                        title: "🔥 Hot in deiner Nähe!",
                        body: `${hostUsernameFormatted} hat gerade ein Highlight gestartet: "${placeName}".`,
                    },
                    data: {
                        activityId: activityId,
                        source: "push",
                        click_action: "FLUTTER_NOTIFICATION_CLICK"
                    },
                    tokens: tokens
                };
                const response = await admin.messaging().sendEachForMulticast(message);
                console.log(`Successfully sent ${response.successCount} boost notifications.`);
            }
        }
        catch (error) {
            console.error("Error sending boost notifications:", error);
        }
    }
    // --- PATH B: Friend Proximity Notification ---
    try {
        const hostDoc = await db.collection('users').doc(hostId).get();
        if (!hostDoc.exists) {
            console.warn(`Host profile for ${hostId} not found. Skipping friend notification.`);
            return null;
        }
        const hostProfile = hostDoc.data();
        const hostFriends = hostProfile.friends || [];
        const hostBlacklist = [...(hostProfile.blacklist?.hard || []), ...(hostProfile.blacklist?.soft || [])];
        // Filter out blocklists and self
        const friendsToNotify = hostFriends.filter(id => id !== hostId && !hostBlacklist.includes(id));
        if (friendsToNotify.length > 0) {
            // Load all friend profiles in parallel
            const friendDocs = await Promise.all(friendsToNotify.map(friendId => db.collection('users').doc(friendId).get()));
            const qualifiedFriends = [];
            for (const doc of friendDocs) {
                if (!doc.exists)
                    continue;
                const friendProfile = doc.data();
                const friendId = doc.id;
                // Check if friend has blocked host
                const friendBlacklist = [...(friendProfile.blacklist?.hard || []), ...(friendProfile.blacklist?.soft || [])];
                if (friendBlacklist.includes(hostId))
                    continue;
                // Check toggle preference (default is true, so nearbyFriendActivityNotifications !== false)
                if (friendProfile.notificationSettings?.nearbyFriendActivityNotifications === false)
                    continue;
                // Check location
                if (!friendProfile.lastLocation || typeof friendProfile.lastLocation.lat !== 'number' || typeof friendProfile.lastLocation.lng !== 'number')
                    continue;
                // Calculate distance
                const dist = calculateDistance(activityLat, activityLon, friendProfile.lastLocation.lat, friendProfile.lastLocation.lng);
                // Determine radius threshold
                let allowedRadius = 10;
                if (friendProfile.proximitySettings && friendProfile.proximitySettings.enabled && typeof friendProfile.proximitySettings.radiusKm === 'number') {
                    allowedRadius = friendProfile.proximitySettings.radiusKm;
                }
                if (dist <= allowedRadius) {
                    qualifiedFriends.push({ friendId, friendProfile });
                }
            }
            if (qualifiedFriends.length > 0) {
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                // Perform async database checks in parallel (rate limits & idempotency)
                const checks = await Promise.all(qualifiedFriends.map(async (f) => {
                    const friendId = f.friendId;
                    const notifId = `friend_nearby_activity_${activityId}_${friendId}`;
                    const notifRef = db.collection('notifications').doc(notifId);
                    // Idempotency check
                    const notifSnap = await notifRef.get();
                    if (notifSnap.exists)
                        return null;
                    // Rate limit check
                    const notifsSnap = await db.collection('notifications')
                        .where('recipientId', '==', friendId)
                        .where('type', '==', 'friend_nearby_activity')
                        .where('createdAt', '>=', oneDayAgo)
                        .get();
                    if (notifsSnap.size >= 5) {
                        console.log(`User ${friendId} has reached the daily limit of 5 nearby friend activity notifications.`);
                        return null;
                    }
                    return { ...f, notifId, notifRef };
                }));
                const friendsToNotifyFinal = checks.filter((c) => c !== null);
                if (friendsToNotifyFinal.length > 0) {
                    const friendPushTokens = [];
                    const hostUsername = hostProfile.username || null;
                    const hostUsernameFormatted = hostUsername ? `@${hostUsername.replace(/^@/, '')}` : "Ein Freund";
                    const activityTitle = activity.title || activity.placeName || "eine Aktivität";
                    const messageText = `${hostUsernameFormatted} plant gerade "${activityTitle}" in deiner Nähe.`;
                    const batch = db.batch();
                    for (const f of friendsToNotifyFinal) {
                        batch.set(f.notifRef, {
                            recipientId: f.friendId,
                            senderId: hostId,
                            senderName: hostUsernameFormatted,
                            senderProfile: {
                                displayName: hostUsernameFormatted,
                                username: hostUsername,
                                photoURL: hostProfile.photoURL || null
                            },
                            type: 'friend_nearby_activity',
                            title: 'Neue Aktivität in deiner Nähe',
                            message: messageText,
                            isRead: false,
                            createdAt: firestore_2.FieldValue.serverTimestamp(),
                            activityId: activityId,
                            link: `/activities/${activityId}`
                        });
                        if (f.friendProfile.fcmToken) {
                            friendPushTokens.push(f.friendProfile.fcmToken);
                        }
                    }
                    await batch.commit();
                    console.log(`Successfully saved ${friendsToNotifyFinal.length} friend notifications.`);
                    if (friendPushTokens.length > 0) {
                        const pushMessage = {
                            notification: {
                                title: "Neue Aktivität in deiner Nähe",
                                body: messageText,
                            },
                            data: {
                                activityId: activityId,
                                source: "push",
                                click_action: "FLUTTER_NOTIFICATION_CLICK"
                            },
                            tokens: friendPushTokens
                        };
                        const response = await admin.messaging().sendEachForMulticast(pushMessage);
                        console.log(`Successfully sent ${response.successCount} friend push notifications.`);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error("Error processing friend nearby notifications:", error);
    }
    return null;
});
exports.ALLOWED_GENDERS = ['female', 'male', 'diverse'];
/**
 * Normalizes and validates gender requirements array.
 * Rejects invalid strings, removes duplicates, limits length to 3.
 * Returns normalized array or undefined (for unrestricted).
 */
function normalizeAndValidateGenderRequirements(genders) {
    if (!genders || !Array.isArray(genders) || genders.length === 0) {
        return undefined;
    }
    const uniqueGenders = Array.from(new Set(genders));
    if (uniqueGenders.length > 3) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid gender requirements: Too many entries (max 3).');
    }
    for (const g of uniqueGenders) {
        if (typeof g !== 'string' || !exports.ALLOWED_GENDERS.includes(g)) {
            throw new https_1.HttpsError('invalid-argument', `Invalid gender requirement value: "${g}". Must be one of female, male, diverse.`);
        }
    }
    if (uniqueGenders.length === 3) {
        return undefined;
    }
    return uniqueGenders;
}
/**
 * Central server-side activity eligibility validator.
 * Validates account status, requirements (gender, age, verification, photo), and participation state.
 */
function validateActivityEligibility(activity, userProfile, hostProfile) {
    const uid = userProfile.uid;
    // 1. Account status checks
    const statusStr = typeof userProfile.accountStatus === 'string' ? userProfile.accountStatus.toLowerCase() : '';
    if (userProfile.isBanned === true ||
        userProfile.disabled === true ||
        statusStr === 'banned' ||
        statusStr === 'deleted' ||
        statusStr === 'disabled') {
        return { eligible: false, errorCode: 'ACCOUNT_NOT_ELIGIBLE', errorMessage: 'Dein Konto ist gesperrt oder deaktiviert.' };
    }
    if (statusStr === 'suspended' || userProfile.suspendedUntil) {
        let suspendTime = null;
        if (userProfile.suspendedUntil) {
            if (typeof userProfile.suspendedUntil.toMillis === 'function') {
                suspendTime = userProfile.suspendedUntil.toMillis();
            }
            else if (typeof userProfile.suspendedUntil === 'number') {
                suspendTime = userProfile.suspendedUntil;
            }
            else if (typeof userProfile.suspendedUntil === 'string') {
                const parsed = Date.parse(userProfile.suspendedUntil);
                if (!isNaN(parsed))
                    suspendTime = parsed;
            }
        }
        // Fail-closed for suspended status: missing, invalid, or future timestamp blocks
        if (statusStr === 'suspended') {
            if (suspendTime === null || isNaN(suspendTime) || suspendTime > Date.now()) {
                return { eligible: false, errorCode: 'ACCOUNT_NOT_ELIGIBLE', errorMessage: 'Dein Konto ist vorübergehend temporär gesperrt.' };
            }
        }
        else if (suspendTime !== null && !isNaN(suspendTime) && suspendTime > Date.now()) {
            return { eligible: false, errorCode: 'ACCOUNT_NOT_ELIGIBLE', errorMessage: 'Dein Konto ist vorübergehend temporär gesperrt.' };
        }
    }
    // 2. Kicked & Already joined checks
    if (uid && Array.isArray(activity.kickedUserIds) && activity.kickedUserIds.includes(uid)) {
        return { eligible: false, errorCode: 'USER_KICKED', errorMessage: 'Du wurdest aus diesem Event entfernt.' };
    }
    if (uid && Array.isArray(activity.participantIds) && activity.participantIds.includes(uid)) {
        return { eligible: false, errorCode: 'ALREADY_PARTICIPANT', errorMessage: 'Du nimmst bereits an diesem Event teil.' };
    }
    // 3. Blacklist / Block checks
    if (uid && hostProfile?.blacklist) {
        const hard = hostProfile.blacklist.hard || [];
        const soft = hostProfile.blacklist.soft || [];
        if (hard.includes(uid) || soft.includes(uid)) {
            return { eligible: false, errorCode: 'BLOCKED_BY_HOST', errorMessage: 'Du kannst dieser Aktivität nicht beitreten.' };
        }
    }
    if (activity.hostId && userProfile.blacklist) {
        const hard = userProfile.blacklist.hard || [];
        const soft = userProfile.blacklist.soft || [];
        if (hard.includes(activity.hostId) || soft.includes(activity.hostId)) {
            return { eligible: false, errorCode: 'HOST_BLOCKED_BY_USER', errorMessage: 'Du hast den Host dieser Aktivität blockiert.' };
        }
    }
    // 4. Participant limit check
    const participantIds = activity.participantIds || [];
    if (activity.maxParticipants && participantIds.length >= activity.maxParticipants) {
        return { eligible: false, errorCode: 'ACTIVITY_FULL', errorMessage: 'Diese Aktivität hat die maximale Teilnehmerzahl erreicht.' };
    }
    // 5. Requirements validation
    if (activity.requirements) {
        const req = activity.requirements;
        // Gender requirement
        if (req.gender && Array.isArray(req.gender) && req.gender.length > 0 && req.gender.length < 3) {
            const userGender = userProfile.gender || '';
            if (!req.gender.includes(userGender)) {
                return {
                    eligible: false,
                    errorCode: 'GENDER_REQUIREMENT_NOT_MET',
                    errorMessage: 'Diese Aktivität ist nicht für dein Geschlecht freigegeben.'
                };
            }
        }
        // Profile picture requirement
        if (req.requireProfilePicture && (!userProfile.photoURL || typeof userProfile.photoURL !== 'string' || userProfile.photoURL.trim() === '')) {
            return {
                eligible: false,
                errorCode: 'PROFILE_PICTURE_REQUIRED',
                errorMessage: 'Ein Profilbild ist erforderlich, um dieser Aktivität beizutreten.'
            };
        }
        // Verification requirement
        if (req.requireVerification && userProfile.kycStatus !== 'verified') {
            return {
                eligible: false,
                errorCode: 'VERIFICATION_REQUIRED',
                errorMessage: 'Nur verifizierte Nutzer (KYC) können dieser Aktivität beitreten.'
            };
        }
        // Minimum rating requirement
        if (typeof req.minimumRating === 'number' && (userProfile.averageRating || 0) < req.minimumRating) {
            return {
                eligible: false,
                errorCode: 'MINIMUM_RATING_NOT_MET',
                errorMessage: `Mindestbewertung für diese Aktivität ist ${req.minimumRating} Sterne.`
            };
        }
        // Age requirement
        if (req.ageRange) {
            if (typeof userProfile.age !== 'number' || isNaN(userProfile.age)) {
                return {
                    eligible: false,
                    errorCode: 'AGE_REQUIREMENT_NOT_MET',
                    errorMessage: 'Bitte hinterlege dein Alter in deinem Profil.'
                };
            }
            if (typeof req.ageRange.min === 'number' && userProfile.age < req.ageRange.min) {
                return {
                    eligible: false,
                    errorCode: 'AGE_REQUIREMENT_NOT_MET',
                    errorMessage: `Mindestalter für diese Aktivität ist ${req.ageRange.min} Jahre.`
                };
            }
            if (typeof req.ageRange.max === 'number' && userProfile.age > req.ageRange.max) {
                return {
                    eligible: false,
                    errorCode: 'AGE_REQUIREMENT_NOT_MET',
                    errorMessage: `Höchstalter für diese Aktivität ist ${req.ageRange.max} Jahre.`
                };
            }
        }
    }
    return { eligible: true };
}
/**
 * HTTPS Callable: Beantwortet eine Beitrittsanfrage für eine Aktivität (durch den Host).
 */
exports.respondToJoinRequest = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const hostId = request.auth.uid;
    const { notificationId, activityId, userIdToJoin, action, customMessage } = request.data;
    if (typeof notificationId !== 'string' || !notificationId ||
        typeof activityId !== 'string' || !activityId ||
        typeof userIdToJoin !== 'string' || !userIdToJoin ||
        typeof action !== 'string' || !action) {
        throw new https_1.HttpsError('invalid-argument', 'Missing or invalid required arguments.');
    }
    if (action !== 'accept' && action !== 'decline') {
        throw new https_1.HttpsError('invalid-argument', 'Invalid action. Must be accept or decline.');
    }
    const db = admin.firestore();
    try {
        const result = await db.runTransaction(async (transaction) => {
            // 1. Get and verify the activity
            const activityRef = db.collection('activities').doc(activityId);
            const activitySnap = await transaction.get(activityRef);
            if (!activitySnap.exists) {
                throw new https_1.HttpsError('not-found', 'Activity not found.');
            }
            const activity = activitySnap.data();
            if (activity.hostId !== hostId) {
                throw new https_1.HttpsError('permission-denied', 'Only the activity host can respond to join requests.');
            }
            // Check if activity is joinable
            const status = activity.status || 'active';
            if (status !== 'active' && status !== 'open') {
                throw new https_1.HttpsError('failed-precondition', 'Activity is no longer active.');
            }
            if (activity.isCancelled || activity.isDeleted || activity.isBlacklisted) {
                throw new https_1.HttpsError('failed-precondition', 'Activity is cancelled, deleted, or blacklisted.');
            }
            // 2. Get and verify the notification
            const notifRef = db.collection('notifications').doc(notificationId);
            const notifSnap = await transaction.get(notifRef);
            if (!notifSnap.exists) {
                throw new https_1.HttpsError('not-found', 'Join request notification not found.');
            }
            const notif = notifSnap.data();
            const notifActivityId = notif.activityId || notif.entityId;
            if (notif.type !== 'join_request' ||
                notifActivityId !== activityId ||
                notif.senderId !== userIdToJoin ||
                notif.recipientId !== hostId) {
                throw new https_1.HttpsError('invalid-argument', 'Notification mismatch.');
            }
            // 3. Get and verify the user to join
            const userRef = db.collection('users').doc(userIdToJoin);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) {
                throw new https_1.HttpsError('not-found', 'User profile not found.');
            }
            const userProfile = userSnap.data();
            if (userProfile.isBanned) {
                throw new https_1.HttpsError('failed-precondition', 'User is banned.');
            }
            // 4. Get host notification meta state (Read phase - MUST be before any writes)
            const metaRef = db.collection('users').doc(hostId).collection('notification_meta').doc('state');
            const metaSnap = await transaction.get(metaRef);
            const deleteNotificationAndDecrementUnread = () => {
                if (!notif.isRead) {
                    const currentUnread = metaSnap.exists ? (metaSnap.data()?.unreadCount || 0) : 0;
                    const nextUnread = Math.max(0, currentUnread - 1);
                    transaction.set(metaRef, {
                        unreadCount: nextUnread,
                        updatedAt: firestore_2.FieldValue.serverTimestamp()
                    }, { merge: true });
                }
                transaction.delete(notifRef);
            };
            // 5. Verify if already participant or kicked
            const participantIds = activity.participantIds || [];
            const kickedUserIds = activity.kickedUserIds || [];
            if (kickedUserIds.includes(userIdToJoin)) {
                throw new https_1.HttpsError('permission-denied', 'User was removed from this activity and cannot rejoin.');
            }
            if (participantIds.includes(userIdToJoin)) {
                // If already joined, resolve/delete the request and decrement unread counter if unread
                deleteNotificationAndDecrementUnread();
                return { success: true, alreadyParticipant: true };
            }
            if (action === 'accept') {
                const userProfileData = { ...userProfile, uid: userIdToJoin };
                const hostRef = db.collection('users').doc(hostId);
                const hostSnap = await transaction.get(hostRef);
                const hostData = hostSnap.exists ? hostSnap.data() : undefined;
                const eligibility = validateActivityEligibility(activity, userProfileData, hostData);
                if (!eligibility.eligible) {
                    throw new https_1.HttpsError('failed-precondition', `${eligibility.errorCode}: ${eligibility.errorMessage}`, {
                        errorCode: eligibility.errorCode,
                        errorMessage: eligibility.errorMessage
                    });
                }
                // Enforce capacity/maxParticipants limit
                if (activity.maxParticipants && participantIds.length >= activity.maxParticipants) {
                    throw new https_1.HttpsError('resource-exhausted', 'This activity has reached its maximum participants limit.');
                }
                const userLanguage = userProfile.language || 'de';
                const userUsername = userProfile.username || null;
                const usernameFormatted = userUsername ? `@${userUsername.replace(/^@/, '')}` : (userLanguage === 'de' ? 'Activa-Nutzer' : 'Activa user');
                const displayNameToUse = usernameFormatted;
                const photoURLToUse = userProfile.photoURL || null;
                // Update activity
                transaction.update(activityRef, {
                    participantIds: firestore_2.FieldValue.arrayUnion(userIdToJoin),
                    lastInteractionAt: firestore_2.FieldValue.serverTimestamp(),
                    [`participantDetails.${userIdToJoin}`]: {
                        displayName: displayNameToUse,
                        username: userUsername,
                        photoURL: photoURLToUse,
                        isPremium: userProfile.isPremium || false,
                        isSupporter: userProfile.isSupporter || false,
                        checkInStatus: 'pending',
                        hasReviewed: false
                    }
                });
                // Update participantsPreview (max 5)
                const currentPreviews = activity.participantsPreview || [];
                if (currentPreviews.length < 5 && !currentPreviews.some((p) => p.uid === userIdToJoin)) {
                    transaction.update(activityRef, {
                        participantsPreview: firestore_2.FieldValue.arrayUnion({
                            uid: userIdToJoin,
                            displayName: displayNameToUse,
                            username: userUsername,
                            photoURL: photoURLToUse
                        })
                    });
                }
                // Update chat
                const chatRef = db.collection('chats').doc(activityId);
                transaction.update(chatRef, {
                    participantIds: firestore_2.FieldValue.arrayUnion(userIdToJoin),
                    [`participantDetails.${userIdToJoin}`]: {
                        displayName: displayNameToUse,
                        username: userUsername,
                        photoURL: photoURLToUse,
                        isPremium: userProfile.isPremium || false,
                        isSupporter: userProfile.isSupporter || false,
                        checkInStatus: 'pending'
                    },
                    [`unreadCount.${userIdToJoin}`]: 0
                });
                // Add to participants subcollection
                const pSubRef = activityRef.collection('participants').doc(userIdToJoin);
                transaction.set(pSubRef, {
                    uid: userIdToJoin,
                    displayName: displayNameToUse,
                    photoURL: photoURLToUse,
                    checkInStatus: 'pending',
                    joinedAt: firestore_2.FieldValue.serverTimestamp(),
                    hasReviewed: false
                });
                // Delete original join request & decrement host unread counter
                deleteNotificationAndDecrementUnread();
            }
            else {
                // action === 'decline'
                // Delete original join request & decrement host unread counter
                deleteNotificationAndDecrementUnread();
            }
            return { success: true, activityTitle: activity.placeName || activity.title || 'Aktivität' };
        });
        const isAccept = action === 'accept';
        await (0, notifications_1.createNotificationAndDispatch)({
            recipientId: userIdToJoin,
            actorId: hostId,
            type: 'join_response',
            title: isAccept ? 'Anfrage akzeptiert!' : 'Anfrage abgelehnt',
            body: isAccept
                ? `Deine Anfrage für "${result.activityTitle}" wurde angenommen. Du bist jetzt dabei!`
                : (customMessage || `Deine Anfrage für "${result.activityTitle}" wurde leider abgelehnt.`),
            targetUrl: isAccept ? `/chat/${activityId}` : `/activities/${activityId}`,
            entityId: activityId,
            eventId: `join_response_${activityId}_${userIdToJoin}_${action}`,
            responseStatus: isAccept ? 'accepted' : 'declined',
            customMessage: customMessage || undefined
        }).catch(err => console.error('[respondToJoinRequest] Dispatch failed:', err));
        if (action === 'accept') {
            await (0, users_1.maybeActivateReferral)(userIdToJoin, 'first_activity_joined');
        }
        return { success: true };
    }
    catch (error) {
        console.error("Error in respondToJoinRequest transaction:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', error.message || 'Internal error responding to join request.');
    }
});
/**
 * HTTPS Callable: Sendet eine Beitrittsanfrage für eine Aktivität (idempotent).
 */
exports.secureRequestJoinActivity = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const requesterId = request.auth.uid;
    const { activityId, message } = request.data;
    if (typeof activityId !== 'string' || !activityId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing or invalid required arguments.');
    }
    const db = admin.firestore();
    try {
        const result = await db.runTransaction(async (transaction) => {
            const activityRef = db.collection('activities').doc(activityId);
            const requesterRef = db.collection('users').doc(requesterId);
            const notificationRef = db.collection('notifications').doc(`join_request_${activityId}_${requesterId}`);
            const [activitySnap, requesterSnap, notificationSnap] = await Promise.all([
                transaction.get(activityRef),
                transaction.get(requesterRef),
                transaction.get(notificationRef)
            ]);
            if (!activitySnap.exists) {
                throw new https_1.HttpsError('not-found', 'Activity does not exist.');
            }
            const activity = activitySnap.data();
            if (activity.status !== 'active') {
                throw new https_1.HttpsError('failed-precondition', 'Activity is not active.');
            }
            const joinMode = activity.joinMode || 'request';
            if (joinMode === 'direct') {
                throw new https_1.HttpsError('failed-precondition', 'Direct join activities cannot use request join.');
            }
            if (requesterId === activity.hostId) {
                throw new https_1.HttpsError('failed-precondition', 'You cannot request to join your own activity.');
            }
            const participantIds = activity.participantIds || [];
            const kickedUserIds = activity.kickedUserIds || [];
            if (kickedUserIds.includes(requesterId)) {
                throw new https_1.HttpsError('permission-denied', 'You have been removed from this activity and cannot rejoin.');
            }
            if (participantIds.includes(requesterId)) {
                throw new https_1.HttpsError('already-exists', 'You are already a participant of this activity.');
            }
            if (!requesterSnap.exists) {
                throw new https_1.HttpsError('not-found', 'Requester user profile not found.');
            }
            const requesterData = requesterSnap.data();
            requesterData.uid = requesterId;
            const hostId = activity.hostId;
            const hostRef = db.collection('users').doc(hostId);
            const hostSnap = await transaction.get(hostRef);
            if (!hostSnap.exists) {
                throw new https_1.HttpsError('not-found', 'Host profile not found.');
            }
            const hostData = hostSnap.data();
            if (hostData.isBanned === true) {
                throw new https_1.HttpsError('permission-denied', 'Host account is banned.');
            }
            const eligibility = validateActivityEligibility(activity, requesterData, hostData);
            if (!eligibility.eligible) {
                throw new https_1.HttpsError('failed-precondition', `${eligibility.errorCode}: ${eligibility.errorMessage}`, {
                    errorCode: eligibility.errorCode,
                    errorMessage: eligibility.errorMessage
                });
            }
            if (activity.isPaid === true) {
                throw new https_1.HttpsError('failed-precondition', 'Paid activities cannot be request-joined directly.');
            }
            if (notificationSnap.exists) {
                const existingNotif = notificationSnap.data();
                if (existingNotif.type === 'join_request') {
                    return { success: true, status: 'already_requested' };
                }
            }
            const requesterUsername = requesterData.username || null;
            const requesterDisplayName = requesterData.displayName || null;
            const usernameFormatted = requesterUsername ? `@${requesterUsername.replace(/^@/, '')}` : (requesterDisplayName || 'Activa-Nutzer');
            const photoURLToUse = requesterData.photoURL || null;
            const senderProfile = {
                displayName: requesterDisplayName || usernameFormatted,
                username: requesterUsername,
                photoURL: photoURLToUse
            };
            return { success: true, status: 'requested', hostId, requesterId, activityTitle: activity.placeName || activity.title || 'Treffen', senderProfile };
        });
        if (result.status === 'requested' && result.hostId) {
            const rawUsername = result.senderProfile?.username;
            const rawDisplayName = result.senderProfile?.displayName;
            let requesterName = 'Ein Nutzer';
            if (rawUsername && typeof rawUsername === 'string' && rawUsername.trim().length > 0) {
                const cleanUser = rawUsername.trim().replace(/^@+/, '');
                if (cleanUser.length > 0) {
                    requesterName = `@${cleanUser}`;
                }
            }
            else if (rawDisplayName && typeof rawDisplayName === 'string' && rawDisplayName.trim().length > 0) {
                requesterName = rawDisplayName.trim();
            }
            await (0, notifications_1.createNotificationAndDispatch)({
                recipientId: result.hostId,
                actorId: result.requesterId,
                type: 'join_request',
                title: 'Neue Beitrittsanfrage',
                body: message || `${requesterName} möchte an deiner Aktivität "${result.activityTitle}" teilnehmen.`,
                targetUrl: `/activities/${activityId}`,
                entityId: activityId,
                eventId: `join_request_${activityId}_${result.requesterId}`,
                customId: `join_request_${activityId}_${result.requesterId}`,
                senderProfile: result.senderProfile
            }).catch(err => console.error('[secureRequestJoinActivity] Dispatch failed:', err));
        }
        return { success: true, status: result.status };
    }
    catch (error) {
        console.error("Error in secureRequestJoinActivity transaction:", error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', error.message || 'Internal error requesting to join activity.');
    }
});
/**
 * HTTPS Callable: Entfernt einen Teilnehmer aus einer Aktivität (durch den Host/Admin).
 */
exports.kickParticipant = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const callerId = request.auth.uid;
    const { activityId, targetUserId } = request.data;
    if (typeof activityId !== 'string' || !activityId || typeof targetUserId !== 'string' || !targetUserId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing or invalid required arguments.');
    }
    const db = admin.firestore();
    try {
        const result = await db.runTransaction(async (transaction) => {
            // 1. Get activity doc (READ)
            const activityRef = db.collection('activities').doc(activityId);
            const activitySnap = await transaction.get(activityRef);
            if (!activitySnap.exists) {
                throw new https_1.HttpsError('not-found', 'Activity not found.');
            }
            const activity = activitySnap.data();
            // 2. Get chat doc (READ) - MUST occur before any writes
            const chatRef = db.collection('chats').doc(activityId);
            const chatSnap = await transaction.get(chatRef);
            // 3. Check host authorization
            const isHost = activity.hostId === callerId;
            if (!isHost) {
                throw new https_1.HttpsError('permission-denied', 'Only the activity host can remove participants.');
            }
            // 4. Prevent removing host
            if (targetUserId === activity.hostId) {
                throw new https_1.HttpsError('failed-precondition', 'The activity host cannot be removed.');
            }
            // 5. Verify target is a participant
            const participantIds = activity.participantIds || [];
            if (!participantIds.includes(targetUserId)) {
                throw new https_1.HttpsError('failed-precondition', 'Target user is not a participant of this activity.');
            }
            // 6. ALL WRITES AFTER ALL READS:
            // Update activity document
            const updatedParticipantIds = participantIds.filter(id => id !== targetUserId);
            const currentPreview = activity.participantsPreview || [];
            const updatedPreview = currentPreview.filter((p) => p.uid !== targetUserId);
            transaction.update(activityRef, {
                participantIds: updatedParticipantIds,
                participantsPreview: updatedPreview,
                [`participantDetails.${targetUserId}`]: firestore_2.FieldValue.delete(),
                kickedUserIds: firestore_2.FieldValue.arrayUnion(targetUserId),
                lastInteractionAt: firestore_2.FieldValue.serverTimestamp()
            });
            // Update chat document if present
            if (chatSnap.exists) {
                transaction.update(chatRef, {
                    participantIds: firestore_2.FieldValue.arrayRemove(targetUserId),
                    [`participantDetails.${targetUserId}`]: firestore_2.FieldValue.delete(),
                    [`unreadCount.${targetUserId}`]: firestore_2.FieldValue.delete()
                });
            }
            // Delete subcollection document activities/{activityId}/participants/{targetUserId}
            const pSubRef = activityRef.collection('participants').doc(targetUserId);
            transaction.delete(pSubRef);
            // Create notification for kicked user
            const notifRef = db.collection('notifications').doc();
            transaction.set(notifRef, {
                recipientId: targetUserId,
                senderId: 'system',
                type: 'participant_kicked',
                title: 'Aus Aktivität entfernt',
                message: `Du wurdest aus der Aktivität "${activity.placeName || activity.title || 'Aktivität'}" entfernt.`,
                isRead: false,
                createdAt: firestore_2.FieldValue.serverTimestamp(),
                activityId: activityId
            });
            return { success: true };
        });
        return result;
    }
    catch (error) {
        console.error('Error in kickParticipant:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', error.message || 'Internal error removing participant.');
    }
});
//# sourceMappingURL=activities.js.map