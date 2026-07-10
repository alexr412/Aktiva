"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRefundUpdated = exports.onPayoutRequestUpdated = exports.onKycRequestCreated = exports.secureLeaveActivity = exports.secureRequestPayout = exports.secureCancelActivity = exports.secureVoteToCompleteActivity = exports.secureCompleteActivity = exports.secureJoinPaidActivity = void 0;
exports.getUserBalancesInCents = getUserBalancesInCents;
exports.assertBalanceInvariants = assertBalanceInvariants;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const firestore_2 = require("firebase-admin/firestore");
const StripeModule = require("stripe");
// ─── HELPERS ─────────────────────────────────────────────────────────────────
/**
 * Helper to retrieve user balances safely in integer cents (minor units)
 * to prevent floating-point inaccuracy. Supports seamless backwards compatibility
 * by auto-converting Euro values on-the-fly.
 */
// Exported for regression tests. Keep production semantics unchanged.
function getUserBalancesInCents(userData) {
    if (userData.balancesInCents) {
        return {
            fiatBalanceCents: userData.fiatBalance || 0,
            escrowBalanceCents: userData.escrowBalance || 0,
        };
    }
    else {
        return {
            fiatBalanceCents: Math.round((userData.fiatBalance || 0) * 100),
            escrowBalanceCents: Math.round((userData.escrowBalance || 0) * 100),
        };
    }
}
/**
 * Appends an entry to the immutable financial ledger.
 * Uses server timestamp — never client-supplied timestamps.
 */
function writeLedgerEntry(transaction, db, entry) {
    const ledgerRef = db.collection("financial_ledger").doc();
    transaction.set(ledgerRef, {
        ...entry,
        timestamp: firestore_2.FieldValue.serverTimestamp(),
    });
}
/**
 * Asserts that balance values are non-negative. Throws immediately if violated.
 * Call before committing any transaction that modifies balances.
 */
// Exported for regression tests. Keep production semantics unchanged.
function assertBalanceInvariants(label, fiatCents, escrowCents) {
    if (fiatCents < 0) {
        throw new https_1.HttpsError("internal", `[INVARIANT VIOLATION] ${label}: fiatBalance would be negative (${fiatCents} cents).`);
    }
    if (escrowCents < 0) {
        throw new https_1.HttpsError("internal", `[INVARIANT VIOLATION] ${label}: escrowBalance would be negative (${escrowCents} cents).`);
    }
}
/**
 * Writes a failed operation record to the dead-letter queue collection.
 * This is a best-effort fire-and-forget — no transaction used intentionally.
 */
async function writeDLQ(db, params) {
    try {
        await db.collection("failed_operations").add({
            ...params,
            timestamp: firestore_2.FieldValue.serverTimestamp(),
        });
    }
    catch (e) {
        // DLQ write failures must not suppress the original error
        console.error("[DLQ] Failed to write to dead-letter queue:", e);
    }
}
/**
 * TTL expiry for idempotency documents: 90 days from now.
 * Enables Firestore native TTL to clean up old replay-protection records
 * without opening replay windows before that point.
 */
function idempotencyExpiresAt() {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d;
}
// ─── SHARED LOGIC ─────────────────────────────────────────────────────────────
/**
 * Shared server-side logic to release funds from escrow to host's fiat balance.
 * All reads occur inside the provided transaction for consistency.
 */
async function releaseEscrow(transaction, db, activityData, activityId, hostId, operationId, initiatedBy, executionSource) {
    const hostRef = db.collection("users").doc(hostId);
    const hostSnap = await transaction.get(hostRef);
    if (!hostSnap.exists) {
        throw new https_1.HttpsError("not-found", "Host-Profil nicht gefunden.");
    }
    const hostData = hostSnap.data() || {};
    const hostBalances = getUserBalancesInCents(hostData);
    // Use price locked at activity creation time — not a mutable field
    const priceCents = Math.round((activityData.price || 0) * 100);
    const payingParticipants = (activityData.participantIds || []).filter((id) => id !== hostId);
    const releaseAmountCents = payingParticipants.length * Math.round(priceCents * 0.9);
    if (releaseAmountCents > 0) {
        // Escrow deduction is capped at actual escrow balance to prevent negative escrow
        const escrowDeduction = Math.min(hostBalances.escrowBalanceCents, releaseAmountCents);
        const newEscrow = hostBalances.escrowBalanceCents - escrowDeduction;
        const newFiat = hostBalances.fiatBalanceCents + escrowDeduction;
        // ── Invariant check before commit ──────────────────────────────────────
        assertBalanceInvariants("releaseEscrow/host", newFiat, newEscrow);
        transaction.update(hostRef, {
            escrowBalance: newEscrow,
            fiatBalance: newFiat,
            balancesInCents: true,
        });
        writeLedgerEntry(transaction, db, {
            operationType: "complete_activity",
            amountCents: escrowDeduction,
            currency: "EUR",
            fromUser: "escrow",
            toUser: hostId,
            activityId,
            status: "completed",
            operationId: `${operationId}_release`,
            initiatedBy,
            executionSource,
        });
    }
    else {
        // Free activity: increment successfulFreeHosts counter
        transaction.update(hostRef, {
            successfulFreeHosts: firestore_2.FieldValue.increment(1)
        });
    }
}
// ─── CALLABLE FUNCTIONS ───────────────────────────────────────────────────────
/**
 * MODUL 22: Secure Payment Processing & Escrow Management.
 * Processes payments server-side to prevent balance manipulation.
 * Idempotency check is inside the transaction (race-safe).
 */
let stripeInstance = null;
function getStripe() {
    if (!stripeInstance) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new https_1.HttpsError("failed-precondition", "Stripe Secret Key ist auf dem Server nicht konfiguriert.");
        }
        const StripeConstructor = StripeModule.default || StripeModule;
        stripeInstance = new StripeConstructor(key, {
            apiVersion: "2023-10-30",
        });
    }
    return stripeInstance;
}
exports.secureJoinPaidActivity = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Der Nutzer muss eingeloggt sein.");
    }
    const { activityId, transactionToken, referralId } = request.data;
    const uid = request.auth.uid;
    if (!activityId || !transactionToken) {
        throw new https_1.HttpsError("invalid-argument", "Pflichtfelder (activityId, transactionToken) fehlen.");
    }
    const isSandbox = transactionToken.startsWith("txn_sandbox_");
    const isDev = process.env.NODE_ENV === "development" || process.env.FUNCTIONS_EMULATOR === "true";
    if (isSandbox && !isDev) {
        throw new https_1.HttpsError("permission-denied", "Sandbox-Zahlungen sind in Production nicht erlaubt.");
    }
    let stripeAmount = 0;
    let stripeCurrency = "eur";
    if (!isSandbox) {
        const isPI = transactionToken.startsWith("pi_");
        const isCS = transactionToken.startsWith("cs_");
        if (!isPI && !isCS) {
            throw new https_1.HttpsError("invalid-argument", "Ungültige Zahlungs-ID.");
        }
        try {
            const stripe = getStripe();
            if (isPI) {
                const pi = await stripe.paymentIntents.retrieve(transactionToken);
                if (pi.status !== "succeeded") {
                    throw new https_1.HttpsError("failed-precondition", `Zahlung nicht erfolgreich (Status: ${pi.status}).`);
                }
                if (pi.currency.toLowerCase() !== "eur") {
                    throw new https_1.HttpsError("failed-precondition", "Zahlungswährung muss EUR sein.");
                }
                stripeAmount = pi.amount;
                stripeCurrency = pi.currency;
                if (pi.metadata?.activityId && pi.metadata.activityId !== activityId) {
                    throw new https_1.HttpsError("failed-precondition", "Aktivitäts-ID der Zahlung stimmt nicht überein.");
                }
                if (pi.metadata?.userId && pi.metadata.userId !== uid) {
                    throw new https_1.HttpsError("failed-precondition", "Nutzer-ID der Zahlung stimmt nicht überein.");
                }
            }
            else {
                const session = await stripe.checkout.sessions.retrieve(transactionToken);
                if (session.payment_status !== "paid") {
                    throw new https_1.HttpsError("failed-precondition", `Zahlung nicht erfolgreich (Status: ${session.payment_status}).`);
                }
                if (session.currency?.toLowerCase() !== "eur") {
                    throw new https_1.HttpsError("failed-precondition", "Zahlungswährung muss EUR sein.");
                }
                stripeAmount = session.amount_total || 0;
                stripeCurrency = session.currency;
                if (session.metadata?.activityId && session.metadata.activityId !== activityId) {
                    throw new https_1.HttpsError("failed-precondition", "Aktivitäts-ID der Zahlung stimmt nicht überein.");
                }
                if (session.metadata?.userId && session.metadata.userId !== uid) {
                    throw new https_1.HttpsError("failed-precondition", "Nutzer-ID der Zahlung stimmt nicht überein.");
                }
            }
        }
        catch (e) {
            if (e instanceof https_1.HttpsError)
                throw e;
            console.error("[Stripe verification failed]:", e);
            throw new https_1.HttpsError("internal", "Zahlungsverifikation fehlgeschlagen.");
        }
    }
    const db = admin.firestore();
    const paymentRef = db.collection("processed_payments").doc(transactionToken);
    try {
        return await db.runTransaction(async (transaction) => {
            // ── Idempotency check INSIDE transaction ─────────────────────────────
            const paymentSnap = await transaction.get(paymentRef);
            if (paymentSnap.exists) {
                return { success: true, duplicated: true };
            }
            // ── Refund check INSIDE transaction ──────────────────────────────────
            const refundRef = db.collection("refund_requests").doc(transactionToken);
            const refundSnap = await transaction.get(refundRef);
            if (refundSnap.exists) {
                throw new Error("validation:payment_refunded");
            }
            const activityRef = db.collection("activities").doc(activityId);
            const activitySnap = await transaction.get(activityRef);
            if (!activitySnap.exists) {
                throw new Error("validation:activity_not_found");
            }
            const activityData = activitySnap.data();
            if (!activityData)
                throw new Error("validation:data_error");
            // ── CAS: block join on terminal activity state ────────────────────────
            if (activityData.status === "cancelled" || activityData.status === "completed" || activityData.status === "blacklisted") {
                throw new Error("validation:activity_inactive");
            }
            if (!activityData.isPaid) {
                throw new Error("validation:activity_free");
            }
            const dateObj = activityData.activityDate && typeof activityData.activityDate.toDate === "function"
                ? activityData.activityDate.toDate()
                : (activityData.activityDate ? new Date(activityData.activityDate) : null);
            if (dateObj && dateObj.getTime() < Date.now()) {
                throw new Error("validation:activity_past");
            }
            const hostId = activityData.hostId;
            if (hostId === uid) {
                throw new Error("validation:host_cannot_join");
            }
            // Already a participant — idempotent success
            if (activityData.participantIds?.includes(uid)) {
                return { success: true, message: "Bereits Teilnehmer." };
            }
            // Capacity check
            if (activityData.maxParticipants && activityData.participantIds.length >= activityData.maxParticipants) {
                throw new Error("validation:activity_full");
            }
            // Amount check
            const expectedCents = Math.round((activityData.price || 0) * 100);
            if (!isSandbox && stripeAmount !== expectedCents) {
                throw new Error("validation:amount_mismatch");
            }
            const userRef = db.collection("users").doc(uid);
            const hostRef = db.collection("users").doc(hostId);
            const [userDoc, hostDoc] = await Promise.all([
                transaction.get(userRef),
                transaction.get(hostRef),
            ]);
            const userData = userDoc.data() || {};
            const hostData = hostDoc.data() || {};
            // ── Host blocked / user blocked / hidden checks ────────────────────────
            if (hostData.isBanned) {
                throw new Error("validation:host_banned");
            }
            if (hostData.blacklist?.hard?.includes(uid) || hostData.blacklist?.soft?.includes(uid)) {
                throw new Error("validation:user_blocked_by_host");
            }
            if (userData.blacklist?.hard?.includes(hostId) || userData.blacklist?.soft?.includes(hostId)) {
                throw new Error("validation:host_blocked_by_user");
            }
            if (userData.hiddenEntityIds?.includes(activityId)) {
                throw new Error("validation:activity_hidden");
            }
            const price = activityData.price || 0;
            const priceCents = Math.round(price * 100);
            const netAmountCents = Math.round(priceCents * 0.9); // 10% platform fee
            const hostBalances = getUserBalancesInCents(hostData);
            const userBalances = getUserBalancesInCents(userData);
            const newHostEscrow = hostBalances.escrowBalanceCents + netAmountCents;
            // ── Invariant check ───────────────────────────────────────────────────
            assertBalanceInvariants("secureJoinPaidActivity/host", hostBalances.fiatBalanceCents, newHostEscrow);
            // Add participant to activity
            transaction.update(activityRef, {
                participantIds: firestore_2.FieldValue.arrayUnion(uid),
                [`participantDetails.${uid}`]: {
                    displayName: userData.displayName || "Teilnehmer",
                    photoURL: userData.photoURL || null,
                    isPremium: userData.isPremium || false,
                    checkInStatus: "pending",
                    hasReviewed: false
                },
                lastInteractionAt: firestore_2.FieldValue.serverTimestamp()
            });
            // Write participant subcollection document
            const pRef = db.collection("activities").doc(activityId).collection("participants").doc(uid);
            transaction.set(pRef, {
                uid,
                displayName: userData.displayName || "Teilnehmer",
                photoURL: userData.photoURL || null,
                checkInStatus: "pending",
                joinedAt: firestore_2.FieldValue.serverTimestamp(),
                hasReviewed: false
            });
            // Credit host escrow
            transaction.update(hostRef, {
                escrowBalance: newHostEscrow,
                balancesInCents: true
            });
            // Migrate user balance schema if needed
            if (!userData.balancesInCents) {
                transaction.update(userRef, {
                    fiatBalance: userBalances.fiatBalanceCents,
                    escrowBalance: userBalances.escrowBalanceCents,
                    balancesInCents: true
                });
            }
            // Create idempotency marker with TTL
            transaction.set(paymentRef, {
                uid,
                activityId,
                amount: price,
                status: "completed",
                processedAt: firestore_2.FieldValue.serverTimestamp(),
                expiresAt: idempotencyExpiresAt(),
            });
            // Add user to chat
            const chatRef = db.collection("chats").doc(activityId);
            transaction.update(chatRef, {
                participantIds: firestore_2.FieldValue.arrayUnion(uid),
                [`participantDetails.${uid}`]: {
                    displayName: userData.displayName || "Teilnehmer",
                    photoURL: userData.photoURL || null,
                    checkInStatus: "pending"
                },
                [`unreadCount.${uid}`]: 0
            });
            // Ledger entry
            writeLedgerEntry(transaction, db, {
                operationType: "join_activity",
                amountCents: priceCents,
                currency: "EUR",
                fromUser: uid,
                toUser: hostId,
                activityId,
                status: "completed",
                operationId: transactionToken,
                initiatedBy: uid,
                executionSource: "secureJoinPaidActivity"
            });
            // Referral: prevent self-referral and host-referral
            if (referralId && referralId !== uid && referralId !== hostId) {
                const referrerRef = db.collection("users").doc(referralId);
                transaction.update(referrerRef, {
                    successfulReferrals: firestore_2.FieldValue.increment(1)
                });
            }
            return { success: true };
        });
    }
    catch (error) {
        console.error("secureJoinPaidActivity failed:", error);
        const isValidationError = error instanceof Error && error.message.startsWith("validation:");
        if (isValidationError && !isSandbox) {
            const reason = error.message.replace("validation:", "");
            try {
                await db.collection("refund_requests").doc(transactionToken).set({
                    userId: uid,
                    activityId,
                    stripePaymentId: transactionToken,
                    amount: stripeAmount / 100,
                    amountCents: stripeAmount,
                    currency: stripeCurrency,
                    status: "pending",
                    reason: reason,
                    createdAt: firestore_2.FieldValue.serverTimestamp(),
                });
                console.log(`[REFUND] Created refund request for token ${transactionToken} due to ${reason}`);
            }
            catch (refundError) {
                console.error("[REFUND] Failed to write refund request:", refundError);
            }
        }
        await writeDLQ(db, {
            operationId: transactionToken,
            userId: uid,
            activityId,
            source: "secureJoinPaidActivity",
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            inputPayload: { activityId, transactionToken, referralId },
        });
        if (isValidationError) {
            const reason = error.message.replace("validation:", "");
            let code = "failed-precondition";
            let msg = "Beitritt nicht möglich.";
            if (reason === "activity_full") {
                code = "resource-exhausted";
                msg = "Die Aktivität ist bereits voll.";
            }
            else if (reason === "activity_inactive") {
                msg = "Diese Aktivität ist nicht mehr aktiv.";
            }
            else if (reason === "activity_past") {
                msg = "Diese Aktivität liegt in der Vergangenheit.";
            }
            else if (reason === "host_cannot_join") {
                msg = "Als Host kannst du deiner eigenen Aktivität nicht beitreten.";
            }
            else if (reason === "amount_mismatch") {
                msg = "Zahlungsbetrag stimmt nicht mit Aktivitätspreis überein.";
            }
            else if (reason === "payment_refunded") {
                msg = "Diese Zahlung wurde bereits storniert oder zurückerstattet.";
            }
            else if (reason === "activity_not_found") {
                code = "not-found";
                msg = "Aktivität nicht gefunden.";
            }
            else if (reason === "activity_free") {
                msg = "Diese Aktivität erfordert keine Zahlung.";
            }
            else if (reason === "host_banned" || reason === "user_blocked_by_host" || reason === "host_blocked_by_user" || reason === "activity_hidden") {
                code = "permission-denied";
                msg = "Diese Aktivität ist für dich nicht verfügbar.";
            }
            throw new https_1.HttpsError(code, msg);
        }
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", "Transaktionsfehler beim Beitritt.");
    }
});
/**
 * Server-authoritative manual activity completion.
 * CAS: only allowed from an active state. Idempotency inside transaction.
 */
exports.secureCompleteActivity = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Der Nutzer muss eingeloggt sein.");
    }
    const { activityId, operationId } = request.data;
    const uid = request.auth.uid;
    if (!activityId || !operationId) {
        throw new https_1.HttpsError("invalid-argument", "Pflichtfelder (activityId, operationId) fehlen.");
    }
    const db = admin.firestore();
    const opRef = db.collection("processed_operations").doc(operationId);
    try {
        return await db.runTransaction(async (transaction) => {
            // ── Idempotency check INSIDE transaction ─────────────────────────────
            const opSnap = await transaction.get(opRef);
            if (opSnap.exists) {
                return { success: true, duplicated: true };
            }
            const activityRef = db.collection("activities").doc(activityId);
            const activitySnap = await transaction.get(activityRef);
            if (!activitySnap.exists) {
                throw new https_1.HttpsError("not-found", "Aktivität nicht gefunden.");
            }
            const activityData = activitySnap.data();
            if (!activityData)
                throw new https_1.HttpsError("internal", "Datenfehler.");
            // Authorization: only host
            if (activityData.hostId !== uid) {
                throw new https_1.HttpsError("permission-denied", "Nur der Host kann diese Aktivität manuell abschließen.");
            }
            // ── CAS: terminal state check ─────────────────────────────────────────
            if (activityData.status === "completed") {
                return { success: true, message: "Aktivität bereits abgeschlossen." };
            }
            if (activityData.status === "cancelled") {
                throw new https_1.HttpsError("failed-precondition", "Aktivität wurde bereits storniert.");
            }
            // Set status
            transaction.update(activityRef, {
                status: "completed",
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            });
            // Decrement place anchor
            if (activityData.placeId && activityData.placeId !== "custom") {
                const placeRef = db.collection("places").doc(activityData.placeId);
                transaction.set(placeRef, { activityCount: firestore_2.FieldValue.increment(-1) }, { merge: true });
            }
            // Release escrow
            await releaseEscrow(transaction, db, activityData, activityId, uid, operationId, uid, "secureCompleteActivity");
            // Idempotency marker with TTL
            transaction.set(opRef, {
                operationType: "complete_activity",
                activityId,
                processedAt: firestore_2.FieldValue.serverTimestamp(),
                expiresAt: idempotencyExpiresAt(),
            });
            return { success: true };
        });
    }
    catch (error) {
        console.error("secureCompleteActivity failed:", error);
        await writeDLQ(db, {
            operationId,
            userId: uid,
            activityId,
            source: "secureCompleteActivity",
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            inputPayload: { activityId, operationId },
        });
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", "Fehler beim Abschließen der Aktivität.");
    }
});
/**
 * Server-authoritative consensus voting.
 * Idempotency inside transaction. CAS terminal state lock.
 */
exports.secureVoteToCompleteActivity = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Der Nutzer muss eingeloggt sein.");
    }
    const { activityId, operationId } = request.data;
    const uid = request.auth.uid;
    if (!activityId || !operationId) {
        throw new https_1.HttpsError("invalid-argument", "Pflichtfelder (activityId, operationId) fehlen.");
    }
    const db = admin.firestore();
    const opRef = db.collection("processed_operations").doc(operationId);
    try {
        return await db.runTransaction(async (transaction) => {
            // ── Idempotency check INSIDE transaction ─────────────────────────────
            const opSnap = await transaction.get(opRef);
            if (opSnap.exists) {
                return { success: true, duplicated: true };
            }
            const activityRef = db.collection("activities").doc(activityId);
            const activitySnap = await transaction.get(activityRef);
            if (!activitySnap.exists) {
                throw new https_1.HttpsError("not-found", "Aktivität nicht gefunden.");
            }
            const activityData = activitySnap.data();
            if (!activityData)
                throw new https_1.HttpsError("internal", "Datenfehler.");
            // ── CAS: terminal state check ─────────────────────────────────────────
            if (activityData.status === "completed") {
                return { success: true, message: "Aktivität bereits abgeschlossen." };
            }
            if (activityData.status === "cancelled") {
                throw new https_1.HttpsError("failed-precondition", "Aktivität wurde bereits storniert.");
            }
            // Authorization: voter must be a participant
            const participantIds = activityData.participantIds || [];
            if (!participantIds.includes(uid)) {
                throw new https_1.HttpsError("permission-denied", "Nur Teilnehmer können für den Abschluss stimmen.");
            }
            // Add vote (deduplicated)
            const currentVotes = activityData.completionVotes || [];
            if (currentVotes.includes(uid)) {
                return { success: true, message: "Stimme bereits registriert." };
            }
            const newVotes = [...new Set([...currentVotes, uid])];
            transaction.update(activityRef, {
                completionVotes: newVotes,
                lastInteractionAt: firestore_2.FieldValue.serverTimestamp(),
            });
            const allVoted = participantIds.every((id) => newVotes.includes(id)) && newVotes.length === participantIds.length;
            if (allVoted) {
                transaction.update(activityRef, {
                    status: "completed",
                    updatedAt: firestore_2.FieldValue.serverTimestamp(),
                });
                if (activityData.placeId && activityData.placeId !== "custom") {
                    const placeRef = db.collection("places").doc(activityData.placeId);
                    transaction.set(placeRef, { activityCount: firestore_2.FieldValue.increment(-1) }, { merge: true });
                }
                await releaseEscrow(transaction, db, activityData, activityId, activityData.hostId, operationId, uid, "secureVoteToCompleteActivity");
            }
            // Idempotency marker with TTL
            transaction.set(opRef, {
                operationType: "vote_to_complete",
                activityId,
                voterId: uid,
                allVotedCompleted: allVoted,
                processedAt: firestore_2.FieldValue.serverTimestamp(),
                expiresAt: idempotencyExpiresAt(),
            });
            return { success: true, allVoted };
        });
    }
    catch (error) {
        console.error("secureVoteToCompleteActivity failed:", error);
        await writeDLQ(db, {
            operationId,
            userId: uid,
            activityId,
            source: "secureVoteToCompleteActivity",
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            inputPayload: { activityId, operationId },
        });
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", "Fehler bei der Stimmenabgabe.");
    }
});
/**
 * Server-authoritative manual activity cancellation.
 * Idempotency inside transaction. CAS terminal state lock.
 * Creates refunds atomically for all paying participants.
 */
exports.secureCancelActivity = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Der Nutzer muss eingeloggt sein.");
    }
    const { activityId, operationId } = request.data;
    const uid = request.auth.uid;
    if (!activityId || !operationId) {
        throw new https_1.HttpsError("invalid-argument", "Pflichtfelder (activityId, operationId) fehlen.");
    }
    const db = admin.firestore();
    const opRef = db.collection("processed_operations").doc(operationId);
    try {
        return await db.runTransaction(async (transaction) => {
            // ── Idempotency check INSIDE transaction ─────────────────────────────
            const opSnap = await transaction.get(opRef);
            if (opSnap.exists) {
                return { success: true, duplicated: true };
            }
            const activityRef = db.collection("activities").doc(activityId);
            const activitySnap = await transaction.get(activityRef);
            if (!activitySnap.exists) {
                throw new https_1.HttpsError("not-found", "Aktivität nicht gefunden.");
            }
            const activityData = activitySnap.data();
            if (!activityData)
                throw new https_1.HttpsError("internal", "Datenfehler.");
            // Authorization: only host
            if (activityData.hostId !== uid) {
                throw new https_1.HttpsError("permission-denied", "Nur der Host kann diese Aktivität stornieren.");
            }
            // ── CAS: terminal state check ─────────────────────────────────────────
            if (activityData.status === "cancelled") {
                return { success: true, message: "Aktivität bereits storniert." };
            }
            if (activityData.status === "completed") {
                throw new https_1.HttpsError("failed-precondition", "Eine bereits abgeschlossene Aktivität kann nicht storniert werden.");
            }
            transaction.update(activityRef, {
                status: "cancelled",
                updatedAt: firestore_2.FieldValue.serverTimestamp(),
            });
            if (activityData.placeId && activityData.placeId !== "custom") {
                const placeRef = db.collection("places").doc(activityData.placeId);
                transaction.set(placeRef, { activityCount: firestore_2.FieldValue.increment(-1) }, { merge: true });
            }
            if (activityData.isPaid && activityData.price > 0) {
                const hostRef = db.collection("users").doc(uid);
                const hostSnap = await transaction.get(hostRef);
                if (!hostSnap.exists)
                    throw new https_1.HttpsError("not-found", "Host-Profil nicht gefunden.");
                const hostData = hostSnap.data() || {};
                const hostBalances = getUserBalancesInCents(hostData);
                const participantIds = activityData.participantIds || [];
                const payingParticipants = participantIds.filter((id) => id !== uid);
                const priceCents = Math.round(activityData.price * 100);
                const netPerParticipant = Math.round(priceCents * 0.9);
                const escrowDeductionCents = payingParticipants.length * netPerParticipant;
                if (escrowDeductionCents > 0) {
                    const finalEscrow = Math.max(0, hostBalances.escrowBalanceCents - escrowDeductionCents);
                    // ── Invariant check ─────────────────────────────────────────────
                    assertBalanceInvariants("secureCancelActivity/host", hostBalances.fiatBalanceCents, finalEscrow);
                    transaction.update(hostRef, {
                        escrowBalance: finalEscrow,
                        balancesInCents: true
                    });
                }
                for (const pId of payingParticipants) {
                    // Anti-self-refund: host cannot create refund for themselves
                    if (pId === uid)
                        continue;
                    const refundRef = db.collection("refunds").doc();
                    transaction.set(refundRef, {
                        activityId,
                        userId: pId,
                        amount: activityData.price, // float Euro for UI display
                        amountCents: priceCents,
                        status: "pending",
                        createdAt: firestore_2.FieldValue.serverTimestamp(),
                    });
                    writeLedgerEntry(transaction, db, {
                        operationType: "refund_created",
                        amountCents: priceCents,
                        currency: "EUR",
                        fromUser: uid,
                        toUser: pId,
                        activityId,
                        status: "pending",
                        operationId: `${operationId}_refund_${pId}`,
                        initiatedBy: uid,
                        executionSource: "secureCancelActivity"
                    });
                }
            }
            // Idempotency marker with TTL
            transaction.set(opRef, {
                operationType: "cancel_activity",
                activityId,
                processedAt: firestore_2.FieldValue.serverTimestamp(),
                expiresAt: idempotencyExpiresAt(),
            });
            return { success: true };
        });
    }
    catch (error) {
        console.error("secureCancelActivity failed:", error);
        await writeDLQ(db, {
            operationId,
            userId: uid,
            activityId,
            source: "secureCancelActivity",
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            inputPayload: { activityId, operationId },
        });
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", "Fehler beim Stornieren der Aktivität.");
    }
});
/**
 * Server-authoritative payout request logic.
 * Deducts user balance and registers a payoutRequest securely.
 * Idempotency inside transaction.
 */
exports.secureRequestPayout = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Der Nutzer muss eingeloggt sein.");
    }
    const { amount, operationId } = request.data;
    const uid = request.auth.uid;
    if (!operationId) {
        throw new https_1.HttpsError("invalid-argument", "Pflichtfeld (operationId) fehlt.");
    }
    const db = admin.firestore();
    const opRef = db.collection("processed_operations").doc(operationId);
    try {
        return await db.runTransaction(async (transaction) => {
            // ── Idempotency check INSIDE transaction ─────────────────────────────
            const opSnap = await transaction.get(opRef);
            if (opSnap.exists) {
                return { success: true, duplicated: true };
            }
            const userRef = db.collection("users").doc(uid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) {
                throw new https_1.HttpsError("not-found", "Benutzerprofil nicht gefunden.");
            }
            const userData = userSnap.data() || {};
            // KYC gate
            if (userData.kycStatus !== "verified") {
                throw new https_1.HttpsError("failed-precondition", "Identitätsprüfung (KYC) ist für Auszahlungen erforderlich.");
            }
            const balances = getUserBalancesInCents(userData);
            // Use provided amount or cash out entire balance
            const amountCents = amount !== undefined ? Math.round(amount * 100) : balances.fiatBalanceCents;
            if (amountCents < 5000) {
                throw new https_1.HttpsError("failed-precondition", "Das Auszahlungslimit liegt bei mindestens 50,00 €.");
            }
            if (balances.fiatBalanceCents < amountCents) {
                throw new https_1.HttpsError("failed-precondition", "Ungenügendes Guthaben für diese Auszahlung.");
            }
            const newFiatBalanceCents = balances.fiatBalanceCents - amountCents;
            // ── Invariant check ───────────────────────────────────────────────────
            assertBalanceInvariants("secureRequestPayout/user", newFiatBalanceCents, balances.escrowBalanceCents);
            transaction.update(userRef, {
                fiatBalance: newFiatBalanceCents,
                balancesInCents: true
            });
            const payoutRef = db.collection("payoutRequests").doc();
            transaction.set(payoutRef, {
                userId: uid,
                amount: amountCents / 100, // Euro for UI display
                amountCents,
                status: "pending",
                createdAt: firestore_2.FieldValue.serverTimestamp(),
            });
            writeLedgerEntry(transaction, db, {
                operationType: "payout_request",
                amountCents,
                currency: "EUR",
                fromUser: uid,
                toUser: "system",
                activityId: "none",
                status: "pending",
                operationId,
                initiatedBy: uid,
                executionSource: "secureRequestPayout"
            });
            // Idempotency marker with TTL
            transaction.set(opRef, {
                operationType: "payout_request",
                amountCents,
                processedAt: firestore_2.FieldValue.serverTimestamp(),
                expiresAt: idempotencyExpiresAt(),
            });
            return { success: true, payoutRequestId: payoutRef.id };
        });
    }
    catch (error) {
        console.error("secureRequestPayout failed:", error);
        await writeDLQ(db, {
            operationId,
            userId: uid,
            source: "secureRequestPayout",
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            inputPayload: { amount, operationId },
        });
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", "Fehler bei der Auszahlungsanforderung.");
    }
});
/**
 * Server-authoritative leave activity.
 * Handles refunds for paid activities atomically with escrow correction.
/**
 * Helper to delete a collection or subcollection in batches of 100 docs.
 */
async function deleteCollectionInBatches(db, collectionRef, batchSize = 100) {
    let hasMore = true;
    while (hasMore) {
        const snap = await collectionRef.limit(batchSize).get();
        if (snap.empty) {
            hasMore = false;
            break;
        }
        const batch = db.batch();
        snap.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        if (snap.size < batchSize) {
            hasMore = false;
        }
    }
}
/**
 * State-machine lock: cannot leave completed or cancelled activities.
 * Anti-self-refund and escrow lower-bound checks included.
 */
exports.secureLeaveActivity = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Der Nutzer muss eingeloggt sein.");
    }
    const { activityId, operationId } = request.data;
    const uid = request.auth.uid;
    if (!activityId || !operationId) {
        throw new https_1.HttpsError("invalid-argument", "Pflichtfelder (activityId, operationId) fehlen.");
    }
    const db = admin.firestore();
    const opRef = db.collection("processed_operations").doc(operationId);
    let isLastParticipantVal = false;
    try {
        const result = await db.runTransaction(async (transaction) => {
            // ── Idempotency check INSIDE transaction ─────────────────────────────
            const opSnap = await transaction.get(opRef);
            if (opSnap.exists) {
                return { success: true, duplicated: true };
            }
            const activityRef = db.collection("activities").doc(activityId);
            const activitySnap = await transaction.get(activityRef);
            if (!activitySnap.exists) {
                throw new https_1.HttpsError("not-found", "Aktivität nicht gefunden.");
            }
            const activityData = activitySnap.data();
            if (!activityData)
                throw new https_1.HttpsError("internal", "Datenfehler.");
            // ── Member revalidation INSIDE transaction ────────────────────────────
            const participantIds = activityData.participantIds || [];
            if (!participantIds.includes(uid)) {
                throw new https_1.HttpsError("not-found", "Du bist kein Teilnehmer dieser Aktivität.");
            }
            const remainingParticipantIds = participantIds.filter((id) => id !== uid);
            const isLastParticipant = remainingParticipantIds.length === 0;
            isLastParticipantVal = isLastParticipant;
            const hostTransferFrom = activityData.hostId === uid && !isLastParticipant ? uid : null;
            const hostTransferTo = hostTransferFrom ? remainingParticipantIds[0] : null;
            console.log(`[LEAVE_ROOM_DEBUG] uid: ${uid}`);
            console.log(`[LEAVE_ROOM_DEBUG] chatId/activityId: ${activityId}`);
            console.log(`[LEAVE_ROOM_DEBUG] participantIds before: ${JSON.stringify(participantIds)}`);
            console.log(`[LEAVE_ROOM_DEBUG] remainingParticipantIds after: ${JSON.stringify(remainingParticipantIds)}`);
            console.log(`[LEAVE_ROOM_DEBUG] isLastParticipant: ${isLastParticipant}`);
            console.log(`[LEAVE_ROOM_DEBUG] hostTransferFrom: ${hostTransferFrom} / hostTransferTo: ${hostTransferTo}`);
            console.log(`[LEAVE_ROOM_DEBUG] cleanupMode: "hard-delete"`);
            console.log(`[LEAVE_ROOM_DEBUG] deleteActivity: ${isLastParticipant}`);
            console.log(`[LEAVE_ROOM_DEBUG] deleteChat: ${isLastParticipant}`);
            console.log(`[LEAVE_ROOM_DEBUG] deleteSubcollections: ${isLastParticipant}`);
            const chatRef = db.collection("chats").doc(activityId);
            if (isLastParticipant) {
                // Last participant leaving -> clean up the whole room (hard-delete)
                const shouldDecrementCount = activityData.status !== "completed" && activityData.status !== "cancelled";
                if (shouldDecrementCount && activityData.placeId && activityData.placeId !== "custom") {
                    const placeRef = db.collection("places").doc(activityData.placeId);
                    transaction.set(placeRef, { activityCount: firestore_2.FieldValue.increment(-1) }, { merge: true });
                }
                // Delete parent documents
                transaction.delete(activityRef);
                transaction.delete(chatRef);
                // Delete participant subcollection document
                const pRef = db.collection("activities").doc(activityId).collection("participants").doc(uid);
                transaction.delete(pRef);
            }
            else {
                // More participants remain -> remove current user
                const updatedPreview = (activityData.participantsPreview || []).filter((p) => p.uid !== uid);
                let newHostName = null;
                let newHostUsername = null;
                let newHostPhotoURL = null;
                if (hostTransferTo) {
                    const newHostRef = db.collection("users").doc(hostTransferTo);
                    const newHostSnap = await transaction.get(newHostRef);
                    if (newHostSnap.exists) {
                        const newHostData = newHostSnap.data() || {};
                        newHostUsername = newHostData.username || null;
                        newHostName = newHostData.username
                            ? `@${newHostData.username.replace(/^@/, '')}`
                            : "Teilnehmer";
                        newHostPhotoURL = newHostData.photoURL || null;
                    }
                }
                const activityUpdate = {
                    participantIds: remainingParticipantIds,
                    participantsPreview: updatedPreview,
                    [`participantDetails.${uid}`]: firestore_2.FieldValue.delete(),
                    lastInteractionAt: firestore_2.FieldValue.serverTimestamp(),
                };
                if (hostTransferTo) {
                    activityUpdate.hostId = hostTransferTo;
                    activityUpdate.hostName = newHostName;
                    activityUpdate.hostUsername = newHostUsername;
                    activityUpdate.hostPhotoURL = newHostPhotoURL;
                }
                transaction.update(activityRef, activityUpdate);
                // Delete participant subcollection document
                const pRef = db.collection("activities").doc(activityId).collection("participants").doc(uid);
                transaction.delete(pRef);
                const chatUpdate = {
                    participantIds: firestore_2.FieldValue.arrayRemove(uid),
                    [`participantDetails.${uid}`]: firestore_2.FieldValue.delete(),
                    [`unreadCount.${uid}`]: firestore_2.FieldValue.delete(),
                };
                if (hostTransferTo) {
                    chatUpdate.hostId = hostTransferTo;
                    chatUpdate.hostName = newHostName;
                    chatUpdate.hostUsername = newHostUsername;
                    chatUpdate.hostPhotoURL = newHostPhotoURL;
                }
                transaction.update(chatRef, chatUpdate);
            }
            // Handle refund if paid activity and the leaving user is not the host
            if (activityData.isPaid && activityData.price > 0 && activityData.hostId !== uid) {
                const hostId = activityData.hostId;
                const priceCents = Math.round(activityData.price * 100);
                const netAmountCents = Math.round(priceCents * 0.9); // the amount the host received for this slot
                const hostRef = db.collection("users").doc(hostId);
                const hostSnap = await transaction.get(hostRef);
                if (!hostSnap.exists)
                    throw new https_1.HttpsError("not-found", "Host-Profil nicht gefunden.");
                const hostData = hostSnap.data() || {};
                const hostBalances = getUserBalancesInCents(hostData);
                // ── Escrow lower-bound protection ─────────────────────────────────
                if (hostBalances.escrowBalanceCents < netAmountCents) {
                    throw new https_1.HttpsError("internal", "[INVARIANT VIOLATION] Host escrowBalance is insufficient to refund this participant.");
                }
                const newHostEscrow = hostBalances.escrowBalanceCents - netAmountCents;
                // ── Invariant check ───────────────────────────────────────────────
                assertBalanceInvariants("secureLeaveActivity/host", hostBalances.fiatBalanceCents, newHostEscrow);
                transaction.update(hostRef, {
                    escrowBalance: newHostEscrow,
                    balancesInCents: true
                });
                // Create refund for participant (refund full price, not net)
                const refundRef = db.collection("refunds").doc();
                transaction.set(refundRef, {
                    activityId,
                    userId: uid,
                    amount: activityData.price,
                    amountCents: priceCents,
                    status: "pending",
                    createdAt: firestore_2.FieldValue.serverTimestamp(),
                });
                writeLedgerEntry(transaction, db, {
                    operationType: "refund_created",
                    amountCents: priceCents,
                    currency: "EUR",
                    fromUser: hostId,
                    toUser: uid,
                    activityId,
                    status: "pending",
                    operationId: `${operationId}_refund_${uid}`,
                    initiatedBy: uid,
                    executionSource: "secureLeaveActivity"
                });
            }
            // Idempotency marker with TTL
            transaction.set(opRef, {
                operationType: "leave_activity",
                activityId,
                userId: uid,
                processedAt: firestore_2.FieldValue.serverTimestamp(),
                expiresAt: idempotencyExpiresAt(),
            });
            return { success: true };
        });
        if (result && result.success && isLastParticipantVal) {
            const chatRef = db.collection("chats").doc(activityId);
            const activityRef = db.collection("activities").doc(activityId);
            await deleteCollectionInBatches(db, chatRef.collection("messages"));
            await deleteCollectionInBatches(db, activityRef.collection("participants"));
        }
        return result;
    }
    catch (error) {
        console.error("secureLeaveActivity failed:", error);
        await writeDLQ(db, {
            operationId,
            userId: uid,
            activityId,
            source: "secureLeaveActivity",
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            inputPayload: { activityId, operationId },
        });
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", "Fehler beim Verlassen der Aktivität.");
    }
});
// ─── FIRESTORE TRIGGERS ───────────────────────────────────────────────────────
/**
 * Trigger: When a kycRequest document is created, automatically set the user's
 * kycStatus to 'pending' on the server side.
 * This removes the need for any client-side write to the protected kycStatus field.
 */
exports.onKycRequestCreated = (0, firestore_1.onDocumentCreated)("kycRequests/{requestId}", async (event) => {
    const data = event.data?.data();
    if (!data?.userId)
        return null;
    const db = admin.firestore();
    try {
        await db.collection("users").doc(data.userId).update({
            kycStatus: "pending",
        });
        console.log(`[KYC] Set kycStatus='pending' for user ${data.userId}.`);
    }
    catch (e) {
        console.error(`[KYC] Failed to update kycStatus for user ${data.userId}:`, e);
        await writeDLQ(db, {
            userId: data.userId,
            source: "onKycRequestCreated",
            errorMessage: e instanceof Error ? e.message : String(e),
        });
    }
    return null;
});
/**
 * Trigger: Append ledger entry when a payout is marked completed by an admin.
 */
exports.onPayoutRequestUpdated = (0, firestore_1.onDocumentUpdated)("payoutRequests/{requestId}", async (event) => {
    const currData = event.data?.after.data();
    const prevData = event.data?.before.data();
    if (!currData || !prevData)
        return null;
    if (prevData.status !== "completed" && currData.status === "completed") {
        const db = admin.firestore();
        const amountCents = currData.amountCents || Math.round((currData.amount || 0) * 100);
        const ledgerRef = db.collection("financial_ledger").doc();
        await ledgerRef.set({
            operationType: "payout_completed",
            amountCents,
            currency: "EUR",
            fromUser: "system",
            toUser: currData.userId,
            activityId: "none",
            status: "completed",
            operationId: `${event.params.requestId}_completed`,
            initiatedBy: "admin",
            executionSource: "onPayoutRequestUpdated",
            timestamp: firestore_2.FieldValue.serverTimestamp()
        });
    }
    return null;
});
/**
 * Trigger: Append ledger entry when a refund is marked completed by an admin.
 */
exports.onRefundUpdated = (0, firestore_1.onDocumentUpdated)("refunds/{refundId}", async (event) => {
    const currData = event.data?.after.data();
    const prevData = event.data?.before.data();
    if (!currData || !prevData)
        return null;
    if (prevData.status !== "completed" && currData.status === "completed") {
        const db = admin.firestore();
        const amountCents = currData.amountCents || Math.round((currData.amount || 0) * 100);
        const ledgerRef = db.collection("financial_ledger").doc();
        await ledgerRef.set({
            operationType: "refund_completed",
            amountCents,
            currency: "EUR",
            fromUser: "system",
            toUser: currData.userId,
            activityId: currData.activityId,
            status: "completed",
            operationId: `${event.params.refundId}_completed`,
            initiatedBy: "admin",
            executionSource: "onRefundUpdated",
            timestamp: firestore_2.FieldValue.serverTimestamp()
        });
    }
    return null;
});
//# sourceMappingURL=payments.js.map