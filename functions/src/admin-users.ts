import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// Role hierarchy rank mapping: user (0) < moderator (1) < admin (2) < superadmin (3)
export function getRoleRank(role?: string): number {
  switch (role) {
    case 'superadmin': return 3;
    case 'admin': return 2;
    case 'moderator': return 1;
    default: return 0; // 'user', 'supporter', or undefined
  }
}

/**
 * Checks if caller is authorized to manage admin operations.
 * Must be authenticated and have role 'admin' or 'superadmin'.
 */
export async function verifyAdminCaller(db: admin.firestore.Firestore, callerUid: string): Promise<{ callerUid: string; callerRole: 'admin' | 'superadmin'; callerData: any }> {
  const callerDoc = await db.collection('users').doc(callerUid).get();
  if (!callerDoc.exists) {
    throw new HttpsError('permission-denied', 'Caller profile not found.');
  }

  const callerData = callerDoc.data() || {};
  const callerRole = callerData.role;

  if (callerRole !== 'admin' && callerRole !== 'superadmin' && callerData.isAdmin !== true) {
    throw new HttpsError('permission-denied', 'Administrative privileges required.');
  }

  const effectiveRole: 'admin' | 'superadmin' = callerRole === 'superadmin' ? 'superadmin' : 'admin';
  return { callerUid, callerRole: effectiveRole, callerData };
}

/**
 * Validates role escalation permissions.
 * Admins CANNOT manage/assign 'admin' or 'superadmin' roles, nor alter existing 'admin' or 'superadmin' target users.
 */
export function checkRoleModificationPermission(callerRole: 'admin' | 'superadmin', targetRole?: string, newRole?: string) {
  const callerRank = getRoleRank(callerRole);
  const targetRank = getRoleRank(targetRole);
  const newRoleRank = newRole ? getRoleRank(newRole) : 0;

  if (callerRole === 'admin') {
    if (targetRank >= 2) {
      throw new HttpsError('permission-denied', 'Admins cannot modify Admin or Superadmin accounts.');
    }
    if (newRoleRank >= 2) {
      throw new HttpsError('permission-denied', 'Admins cannot promote users to Admin or Superadmin.');
    }
  }

  if (callerRank < targetRank) {
    throw new HttpsError('permission-denied', 'Cannot modify a user with a higher privilege level.');
  }
}

/**
 * Writes an immutable audit entry to admin_audit_logs collection.
 */
export async function logAdminAudit(
  db: admin.firestore.Firestore,
  data: {
    actorUid: string;
    targetUid: string;
    action: string;
    before?: any;
    after?: any;
    reason?: string;
    metadata?: any;
  }
) {
  await db.collection('admin_audit_logs').add({
    actorUid: data.actorUid,
    targetUid: data.targetUid,
    action: data.action,
    before: data.before ?? null,
    after: data.after ?? null,
    reason: data.reason ?? null,
    metadata: data.metadata ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Transactional check ensuring at least ONE superadmin remains in the system.
 */
export async function assertNotLastSuperadmin(
  transaction: admin.firestore.Transaction,
  db: admin.firestore.Firestore,
  targetUid: string,
  actionType: 'demote' | 'ban' | 'suspend' | 'delete'
) {
  const superadminSnap = await transaction.get(
    db.collection('users').where('role', '==', 'superadmin')
  );

  const isTargetSuperadmin = superadminSnap.docs.some(doc => doc.id === targetUid);
  if (isTargetSuperadmin && superadminSnap.size <= 1) {
    throw new HttpsError(
      'failed-precondition',
      `Cannot ${actionType} the last remaining Superadmin in the system.`
    );
  }
}

export function normalizeUserProfile(uid: string, raw: any, nowMs: number = Date.now()) {
  const roleVal = raw.role || (raw.isAdmin ? 'admin' : (raw.isSupporter ? 'supporter' : 'user'));
  
  // Canonical effective account status calculation
  let statusVal: 'active' | 'suspended' | 'banned' = 'active';
  if (raw.isBanned === true || raw.accountStatus === 'banned') {
    statusVal = 'banned';
  } else if (raw.accountStatus === 'suspended' && raw.suspendedUntil) {
    let untilMs: number | null = null;
    const su = raw.suspendedUntil;
    if (su && typeof su.toMillis === 'function') untilMs = su.toMillis();
    else if (su && typeof su.toDate === 'function') untilMs = su.toDate().getTime();
    else if (typeof su === 'number') untilMs = su;
    else if (typeof su === 'string') untilMs = Date.parse(su);

    if (untilMs !== null && !isNaN(untilMs) && untilMs > nowMs) {
      statusVal = 'suspended';
    } else {
      statusVal = 'active';
    }
  } else {
    statusVal = 'active';
  }

  const isOrgVal = raw.isOrganizer === true;
  const isPremVal = raw.isPremium === true;
  const displayNameVal = raw.displayName || raw.username || 'Activa-Nutzer';
  const emailVal = raw.email || null;
  const createdAtVal = raw.createdAt || raw.creationTime || null;

  return {
    uid,
    ...raw,
    role: roleVal,
    accountStatus: statusVal,
    isOrganizer: isOrgVal,
    isPremium: isPremVal,
    displayName: displayNameVal,
    email: emailVal,
    createdAt: createdAtVal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. adminListUsers
// ─────────────────────────────────────────────────────────────────────────────

export const adminListUsers = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid } = await verifyAdminCaller(db, request.auth.uid);

  const { search, role, isOrganizer, premium, accountStatus, limit = 50, startAfterDocId } = request.data || {};
  const queryLimit = Math.min(Math.max(1, Number(limit) || 50), 100);

  // 1. Diagnostic Environment Logging
  console.log('[ADMIN USERS ENV]', {
    projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT,
    firebaseProjectId: admin.app().options.projectId,
  });

  // 2. Unfiltered Raw Collection Check
  const rawUsersSnapshot = await db.collection('users').limit(5).get();
  console.log('[ADMIN USERS RAW COLLECTION]', {
    count: rawUsersSnapshot.size,
    ids: rawUsersSnapshot.docs.map(d => d.id),
  });

  console.log('[ADMIN USERS LIST REQUEST]', {
    callerUid,
    search,
    role,
    isOrganizer,
    premium,
    accountStatus,
    queryLimit,
    startAfterDocId,
  });

  const normalizeUserDoc = (doc: admin.firestore.DocumentSnapshot) => {
    return normalizeUserProfile(doc.id, doc.data() || {}, Date.now());
  };

  // Exact Lookup: UID
  if (search && typeof search === 'string' && search.trim().length >= 20 && !search.includes(' ') && !search.includes('@')) {
    const docSnap = await db.collection('users').doc(search.trim()).get();
    if (docSnap.exists) {
      let users = [normalizeUserDoc(docSnap)];
      if (accountStatus && accountStatus !== 'all' && ['active', 'suspended', 'banned'].includes(accountStatus)) {
        users = users.filter(u => u.accountStatus === accountStatus);
      }
      return { users, hasMore: false };
    }
  }

  // Exact Lookup: Email
  if (search && typeof search === 'string' && search.includes('@')) {
    const cleanEmail = search.trim().toLowerCase();
    let emailSnap = await db.collection('users').where('emailLower', '==', cleanEmail).limit(10).get();
    if (emailSnap.empty) {
      emailSnap = await db.collection('users').where('email', '==', search.trim()).limit(10).get();
    }
    if (!emailSnap.empty) {
      let users = emailSnap.docs.map(normalizeUserDoc);
      if (accountStatus && accountStatus !== 'all' && ['active', 'suspended', 'banned'].includes(accountStatus)) {
        users = users.filter(u => u.accountStatus === accountStatus);
      }
      return { users, hasMore: false };
    }
  }

  // Exact Lookup: Username
  if (search && typeof search === 'string' && search.startsWith('@')) {
    const cleanUsername = search.replace(/^@/, '').trim().toLowerCase();
    let unameSnap = await db.collection('users').where('usernameLowercase', '==', cleanUsername).limit(10).get();
    if (unameSnap.empty) {
      unameSnap = await db.collection('users').where('username', '==', search.trim()).limit(10).get();
    }
    if (!unameSnap.empty) {
      let users = unameSnap.docs.map(normalizeUserDoc);
      if (accountStatus && accountStatus !== 'all' && ['active', 'suspended', 'banned'].includes(accountStatus)) {
        users = users.filter(u => u.accountStatus === accountStatus);
      }
      return { users, hasMore: false };
    }
  }

  let baseQuery: admin.firestore.Query = db.collection('users');

  // Filter: Role (ignore 'all' or empty)
  if (role && role !== 'all' && ['user', 'moderator', 'admin', 'superadmin'].includes(role)) {
    baseQuery = baseQuery.where('role', '==', role);
  }

  // Filter: Organizer
  if (typeof isOrganizer === 'boolean') {
    baseQuery = baseQuery.where('isOrganizer', '==', isOrganizer);
  }

  // Filter: Account Status (ignore 'all' or empty)
  if (accountStatus && accountStatus !== 'all' && ['active', 'suspended', 'banned'].includes(accountStatus)) {
    baseQuery = baseQuery.where('accountStatus', '==', accountStatus);
  }

  // Filter: Premium (ignore 'all' or empty)
  if (premium === 'active') {
    baseQuery = baseQuery.where('isPremium', '==', true);
  } else if (premium === 'inactive') {
    baseQuery = baseQuery.where('isPremium', '==', false);
  }

  // Prefix Search on Name if provided
  if (search && typeof search === 'string' && search.trim().length > 0) {
    const term = search.trim().toLowerCase().replace(/^@/, '');
    baseQuery = baseQuery.where('displayNameLower', '>=', term).where('displayNameLower', '<=', term + '\uf8ff');
    baseQuery = baseQuery.orderBy('displayNameLower', 'asc');
  }

  const targetCount = queryLimit;
  const matchingUsers: any[] = [];
  let currentCursorDoc: admin.firestore.DocumentSnapshot | null = null;

  if (startAfterDocId) {
    const startDoc = await db.collection('users').doc(startAfterDocId).get();
    if (startDoc.exists) {
      currentCursorDoc = startDoc;
    }
  }

  let hasMore = false;
  let lastEvaluatedDoc: admin.firestore.DocumentSnapshot | null = currentCursorDoc;
  const fetchBatchSize = targetCount + 15;

  while (matchingUsers.length < targetCount) {
    let batchQuery = baseQuery;
    if (lastEvaluatedDoc && lastEvaluatedDoc.exists) {
      batchQuery = batchQuery.startAfter(lastEvaluatedDoc);
    }
    batchQuery = batchQuery.limit(fetchBatchSize);

    const snapshot = await batchQuery.get();
    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const docs = snapshot.docs;

    for (const doc of docs) {
      lastEvaluatedDoc = doc;
      const normalized = normalizeUserDoc(doc);

      const matchesStatus = !accountStatus || accountStatus === 'all'
        ? true
        : normalized.accountStatus === accountStatus;

      if (matchesStatus) {
        matchingUsers.push(normalized);
        if (matchingUsers.length === targetCount) {
          const docIndex = docs.indexOf(doc);
          hasMore = docIndex < docs.length - 1 || docs.length === fetchBatchSize;
          break;
        }
      }
    }

    if (docs.length < fetchBatchSize || matchingUsers.length === targetCount) {
      if (matchingUsers.length < targetCount) {
        hasMore = false;
      }
      break;
    }
  }

  const lastDocId = lastEvaluatedDoc && lastEvaluatedDoc.exists ? lastEvaluatedDoc.id : undefined;

  console.log('[ADMIN USERS RESULT]', {
    requestedLimit: queryLimit,
    returnedCount: matchingUsers.length,
    hasMore,
    lastDocId,
    sampleIds: matchingUsers.slice(0, 5).map(u => u.uid),
  });

  return { users: matchingUsers, hasMore, lastDocId };
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. adminGetUserDetail
// ─────────────────────────────────────────────────────────────────────────────

export const adminGetUserDetail = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  await verifyAdminCaller(db, request.auth.uid);

  const { targetUid } = request.data || {};
  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Target UID is required.');
  }

  const userDoc = await db.collection('users').doc(targetUid).get();
  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'User profile not found.');
  }

  const profile = { uid: userDoc.id, ...userDoc.data() };

  // Fetch Firebase Auth Record
  let authUser: any = null;
  try {
    const authRecord = await admin.auth().getUser(targetUid);
    authUser = {
      uid: authRecord.uid,
      email: authRecord.email || null,
      emailVerified: authRecord.emailVerified || false,
      disabled: authRecord.disabled || false,
      creationTime: authRecord.metadata.creationTime || null,
      lastSignInTime: authRecord.metadata.lastSignInTime || null,
      providerData: authRecord.providerData.map(p => ({ providerId: p.providerId, email: p.email })),
    };
  } catch (err) {
    console.warn(`Could not fetch Auth record for ${targetUid}:`, err);
  }

  // Fetch Aggregated Stats on demand
  let stats = { hostedActivitiesCount: 0, joinedActivitiesCount: 0, friendsCount: 0 };
  try {
    const [hostedSnap, joinedSnap] = await Promise.all([
      db.collection('activities').where('hostId', '==', targetUid).count().get(),
      db.collection('activities').where('participantIds', 'array-contains', targetUid).count().get(),
    ]);

    stats.hostedActivitiesCount = hostedSnap.data().count;
    stats.joinedActivitiesCount = joinedSnap.data().count;
    stats.friendsCount = Array.isArray((profile as any).friends) ? (profile as any).friends.length : 0;
  } catch (err) {
    console.warn(`Error counting stats for user ${targetUid}:`, err);
  }

  return { profile, authUser, stats };
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. adminSetUserRole
// ─────────────────────────────────────────────────────────────────────────────

export const adminSetUserRole = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid, callerRole } = await verifyAdminCaller(db, request.auth.uid);

  const { targetUid, role: newRole } = request.data || {};
  if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Target UID is required.');
  if (!['user', 'moderator', 'admin', 'superadmin'].includes(newRole)) {
    throw new HttpsError('invalid-argument', 'Invalid role value.');
  }

  await db.runTransaction(async (transaction) => {
    const targetRef = db.collection('users').doc(targetUid);
    const targetSnap = await transaction.get(targetRef);

    if (!targetSnap.exists) throw new HttpsError('not-found', 'Target user profile not found.');

    const targetData = targetSnap.data() || {};
    const oldRole = targetData.role || 'user';

    checkRoleModificationPermission(callerRole, oldRole, newRole);

    if (oldRole === 'superadmin' && newRole !== 'superadmin') {
      await assertNotLastSuperadmin(transaction, db, targetUid, 'demote');
    }

    transaction.update(targetRef, {
      role: newRole,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logAdminAudit(db, {
      actorUid: callerUid,
      targetUid,
      action: 'USER_ROLE_CHANGED',
      before: { role: oldRole },
      after: { role: newRole },
    });
  });

  return { success: true, targetUid, role: newRole };
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. adminSetOrganizerStatus
// ─────────────────────────────────────────────────────────────────────────────

export const adminSetOrganizerStatus = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid, callerRole } = await verifyAdminCaller(db, request.auth.uid);

  const { targetUid, isOrganizer } = request.data || {};
  if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Target UID is required.');
  const boolVal = !!isOrganizer;

  const targetDoc = await db.collection('users').doc(targetUid).get();
  if (!targetDoc.exists) throw new HttpsError('not-found', 'Target user not found.');

  const targetData = targetDoc.data() || {};
  checkRoleModificationPermission(callerRole, targetData.role);

  await db.collection('users').doc(targetUid).update({
    isOrganizer: boolVal,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await logAdminAudit(db, {
    actorUid: callerUid,
    targetUid,
    action: boolVal ? 'USER_ORGANIZER_GRANTED' : 'USER_ORGANIZER_REMOVED',
    before: { isOrganizer: !!targetData.isOrganizer },
    after: { isOrganizer: boolVal },
  });

  return { success: true, targetUid, isOrganizer: boolVal };
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. adminSetUserPremium
// ─────────────────────────────────────────────────────────────────────────────

export const adminSetUserPremium = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid, callerRole } = await verifyAdminCaller(db, request.auth.uid);

  const { targetUid, mode, durationDays, customExpirationIso } = request.data || {};
  if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Target UID is required.');
  if (!['set', 'extend', 'remove'].includes(mode)) throw new HttpsError('invalid-argument', 'Invalid mode.');

  const targetDoc = await db.collection('users').doc(targetUid).get();
  if (!targetDoc.exists) throw new HttpsError('not-found', 'Target user profile not found.');

  const targetData = targetDoc.data() || {};
  checkRoleModificationPermission(callerRole, targetData.role);

  const now = Date.now();
  let newExpiresAt: number | null = null;
  let updates: any = {};

  if (mode === 'remove') {
    updates = {
      isPremium: false,
      premiumStartsAt: FieldValue.delete(),
      premiumExpiresAt: FieldValue.delete(),
      premiumSource: FieldValue.delete(),
      premiumCampaignId: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    };
  } else if (mode === 'set' || mode === 'extend') {
    if (customExpirationIso) {
      const parsed = Date.parse(customExpirationIso);
      if (isNaN(parsed) || parsed <= now) throw new HttpsError('invalid-argument', 'Custom expiration date must be in the future.');
      newExpiresAt = parsed;
    } else {
      const days = Number(durationDays) || 30;
      if (days <= 0 || days > 3650) throw new HttpsError('invalid-argument', 'Invalid duration days.');

      const additionMs = days * 24 * 60 * 60 * 1000;
      let baseMs = now;

      if (mode === 'extend' && targetData.isPremium && targetData.premiumExpiresAt) {
        const existingMs = targetData.premiumExpiresAt.toMillis ? targetData.premiumExpiresAt.toMillis() : Date.parse(targetData.premiumExpiresAt);
        if (!isNaN(existingMs) && existingMs > now) {
          baseMs = existingMs;
        }
      }
      newExpiresAt = baseMs + additionMs;
    }

    updates = {
      isPremium: true,
      premiumStartsAt: targetData.premiumStartsAt || FieldValue.serverTimestamp(),
      premiumExpiresAt: Timestamp.fromMillis(newExpiresAt),
      premiumSource: 'admin',
      premiumCampaignId: null,
      updatedAt: FieldValue.serverTimestamp(),
    };
  }

  await db.collection('users').doc(targetUid).update(updates);

  await logAdminAudit(db, {
    actorUid: callerUid,
    targetUid,
    action: mode === 'remove' ? 'USER_PREMIUM_REMOVED' : (mode === 'extend' ? 'USER_PREMIUM_UPDATED' : 'USER_PREMIUM_GRANTED'),
    before: { isPremium: !!targetData.isPremium, premiumExpiresAt: targetData.premiumExpiresAt || null },
    after: { isPremium: mode !== 'remove', premiumExpiresAt: newExpiresAt ? Timestamp.fromMillis(newExpiresAt) : null },
  });

  return { success: true, targetUid, mode, expiresAt: newExpiresAt ? new Date(newExpiresAt).toISOString() : null };
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. adminSuspendUser & adminUnsuspendUser
// ─────────────────────────────────────────────────────────────────────────────

export const adminSuspendUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid, callerRole } = await verifyAdminCaller(db, request.auth.uid);

  const { targetUid, durationHours, customUntilIso, reasonPublic, noteInternal } = request.data || {};
  if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Target UID is required.');
  if (!reasonPublic || typeof reasonPublic !== 'string' || !reasonPublic.trim()) {
    throw new HttpsError('invalid-argument', 'Public suspension reason is required.');
  }

  const now = Date.now();
  let untilMs = now + 24 * 60 * 60 * 1000; // Default 24h

  if (customUntilIso) {
    const parsed = Date.parse(customUntilIso);
    if (isNaN(parsed) || parsed <= now) throw new HttpsError('invalid-argument', 'Custom suspension date must be in the future.');
    untilMs = parsed;
  } else if (durationHours) {
    const h = Number(durationHours);
    if (h <= 0 || h > 8760) throw new HttpsError('invalid-argument', 'Invalid duration hours.');
    untilMs = now + h * 60 * 60 * 1000;
  }

  await db.runTransaction(async (transaction) => {
    const targetRef = db.collection('users').doc(targetUid);
    const targetSnap = await transaction.get(targetRef);
    if (!targetSnap.exists) throw new HttpsError('not-found', 'Target user profile not found.');

    const targetData = targetSnap.data() || {};
    checkRoleModificationPermission(callerRole, targetData.role);

    if (targetData.role === 'superadmin') {
      await assertNotLastSuperadmin(transaction, db, targetUid, 'suspend');
    }

    transaction.update(targetRef, {
      accountStatus: 'suspended',
      suspendedUntil: Timestamp.fromMillis(untilMs),
      suspendedBy: callerUid,
      suspensionReasonPublic: reasonPublic.trim(),
      suspensionNoteInternal: noteInternal ? noteInternal.trim() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logAdminAudit(db, {
      actorUid: callerUid,
      targetUid,
      action: 'USER_SUSPENDED',
      before: { accountStatus: targetData.accountStatus || 'active' },
      after: { accountStatus: 'suspended', suspendedUntil: Timestamp.fromMillis(untilMs) },
      reason: reasonPublic.trim(),
    });
  });

  return { success: true, targetUid, suspendedUntil: new Date(untilMs).toISOString() };
});

export const adminUnsuspendUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid, callerRole } = await verifyAdminCaller(db, request.auth.uid);

  const { targetUid } = request.data || {};
  if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Target UID is required.');

  const targetDoc = await db.collection('users').doc(targetUid).get();
  if (!targetDoc.exists) throw new HttpsError('not-found', 'Target user not found.');

  const targetData = targetDoc.data() || {};
  checkRoleModificationPermission(callerRole, targetData.role);

  await db.collection('users').doc(targetUid).update({
    accountStatus: 'active',
    suspendedUntil: FieldValue.delete(),
    suspendedBy: FieldValue.delete(),
    suspensionReasonPublic: FieldValue.delete(),
    suspensionNoteInternal: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await logAdminAudit(db, {
    actorUid: callerUid,
    targetUid,
    action: 'USER_UNSUSPENDED',
    before: { accountStatus: targetData.accountStatus || 'suspended' },
    after: { accountStatus: 'active' },
  });

  return { success: true, targetUid };
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. adminBanUser & adminUnbanUser
// ─────────────────────────────────────────────────────────────────────────────

export const adminBanUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid, callerRole } = await verifyAdminCaller(db, request.auth.uid);

  const { targetUid, reasonPublic, noteInternal } = request.data || {};
  if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Target UID is required.');
  if (!reasonPublic || typeof reasonPublic !== 'string' || !reasonPublic.trim()) {
    throw new HttpsError('invalid-argument', 'Public ban reason is required.');
  }

  await db.runTransaction(async (transaction) => {
    const targetRef = db.collection('users').doc(targetUid);
    const targetSnap = await transaction.get(targetRef);
    if (!targetSnap.exists) throw new HttpsError('not-found', 'Target user profile not found.');

    const targetData = targetSnap.data() || {};
    checkRoleModificationPermission(callerRole, targetData.role);

    if (targetData.role === 'superadmin') {
      await assertNotLastSuperadmin(transaction, db, targetUid, 'ban');
    }

    transaction.update(targetRef, {
      accountStatus: 'banned',
      isBanned: true,
      bannedAt: FieldValue.serverTimestamp(),
      bannedBy: callerUid,
      banReasonPublic: reasonPublic.trim(),
      banNoteInternal: noteInternal ? noteInternal.trim() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logAdminAudit(db, {
      actorUid: callerUid,
      targetUid,
      action: 'USER_BANNED',
      before: { accountStatus: targetData.accountStatus || 'active', isBanned: !!targetData.isBanned },
      after: { accountStatus: 'banned', isBanned: true },
      reason: reasonPublic.trim(),
    });
  });

  try {
    await admin.auth().updateUser(targetUid, { disabled: true });
  } catch (e) {
    console.warn(`Could not disable Auth user ${targetUid}:`, e);
  }

  return { success: true, targetUid };
});

export const adminUnbanUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid, callerRole } = await verifyAdminCaller(db, request.auth.uid);

  const { targetUid } = request.data || {};
  if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Target UID is required.');

  const targetDoc = await db.collection('users').doc(targetUid).get();
  if (!targetDoc.exists) throw new HttpsError('not-found', 'Target user not found.');

  const targetData = targetDoc.data() || {};
  checkRoleModificationPermission(callerRole, targetData.role);

  await db.collection('users').doc(targetUid).update({
    accountStatus: 'active',
    isBanned: false,
    bannedAt: FieldValue.delete(),
    bannedBy: FieldValue.delete(),
    banReasonPublic: FieldValue.delete(),
    banNoteInternal: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  try {
    await admin.auth().updateUser(targetUid, { disabled: false });
  } catch (e) {
    console.warn(`Could not re-enable Auth user ${targetUid}:`, e);
  }

  await logAdminAudit(db, {
    actorUid: callerUid,
    targetUid,
    action: 'USER_UNBANNED',
    before: { accountStatus: targetData.accountStatus || 'banned', isBanned: true },
    after: { accountStatus: 'active', isBanned: false },
  });

  return { success: true, targetUid };
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. adminDeleteUser
// ─────────────────────────────────────────────────────────────────────────────

export const adminDeleteUser = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid, callerRole } = await verifyAdminCaller(db, request.auth.uid);

  const { targetUid, confirmationText } = request.data || {};
  if (!targetUid || typeof targetUid !== 'string') throw new HttpsError('invalid-argument', 'Target UID is required.');
  if (confirmationText !== targetUid) {
    throw new HttpsError('invalid-argument', 'Confirmation text does not match target UID.');
  }

  await db.runTransaction(async (transaction) => {
    const targetRef = db.collection('users').doc(targetUid);
    const targetSnap = await transaction.get(targetRef);
    if (!targetSnap.exists) throw new HttpsError('not-found', 'Target user profile not found.');

    const targetData = targetSnap.data() || {};
    checkRoleModificationPermission(callerRole, targetData.role);

    if (targetData.role === 'superadmin') {
      await assertNotLastSuperadmin(transaction, db, targetUid, 'delete');
    }
  });

  await logAdminAudit(db, {
    actorUid: callerUid,
    targetUid,
    action: 'USER_DELETED',
    reason: 'Admin explicit deletion',
  });

  try {
    await admin.auth().deleteUser(targetUid);
  } catch (err: any) {
    console.warn(`Auth user delete failed or user already absent in Auth: ${targetUid}`, err);
    await db.collection('users').doc(targetUid).delete().catch(() => {});
  }

  return { success: true, targetUid };
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. adminBulkUpdateUsers
// ─────────────────────────────────────────────────────────────────────────────

export const adminBulkUpdateUsers = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  const { callerUid, callerRole } = await verifyAdminCaller(db, request.auth.uid);

  const { targetUids, action, durationDays, durationHours, reasonPublic } = request.data || {};
  if (!Array.isArray(targetUids) || targetUids.length === 0) {
    throw new HttpsError('invalid-argument', 'Target UIDs array is required.');
  }

  if (targetUids.length > 100) {
    throw new HttpsError('invalid-argument', 'Maximum 100 users per bulk request.');
  }

  if (!['grant_premium', 'extend_premium', 'suspend'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Invalid bulk action type.');
  }

  const uniqueUids = Array.from(new Set(targetUids));
  let successCount = 0;
  let failureCount = 0;
  const errors: any[] = [];

  for (const targetUid of uniqueUids) {
    try {
      const targetDoc = await db.collection('users').doc(targetUid).get();
      if (!targetDoc.exists) {
        failureCount++;
        errors.push({ uid: targetUid, error: 'User not found' });
        continue;
      }

      const targetData = targetDoc.data() || {};
      checkRoleModificationPermission(callerRole, targetData.role);

      if (action === 'grant_premium' || action === 'extend_premium') {
        const days = Number(durationDays) || 30;
        const now = Date.now();
        const additionMs = days * 24 * 60 * 60 * 1000;
        let baseMs = now;

        if (action === 'extend_premium' && targetData.isPremium && targetData.premiumExpiresAt) {
          const existingMs = targetData.premiumExpiresAt.toMillis ? targetData.premiumExpiresAt.toMillis() : Date.parse(targetData.premiumExpiresAt);
          if (!isNaN(existingMs) && existingMs > now) {
            baseMs = existingMs;
          }
        }
        const expiresAtMs = baseMs + additionMs;

        await db.collection('users').doc(targetUid).update({
          isPremium: true,
          premiumStartsAt: targetData.premiumStartsAt || FieldValue.serverTimestamp(),
          premiumExpiresAt: Timestamp.fromMillis(expiresAtMs),
          premiumSource: 'admin',
          premiumCampaignId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });

        await logAdminAudit(db, {
          actorUid: callerUid,
          targetUid,
          action: action === 'grant_premium' ? 'USER_PREMIUM_GRANTED' : 'USER_PREMIUM_UPDATED',
          metadata: { bulk: true, durationDays: days },
        });
      } else if (action === 'suspend') {
        if (!reasonPublic || typeof reasonPublic !== 'string') {
          throw new Error('Public suspension reason required.');
        }
        const h = Number(durationHours) || 24;
        const untilMs = Date.now() + h * 60 * 60 * 1000;

        await db.collection('users').doc(targetUid).update({
          accountStatus: 'suspended',
          suspendedUntil: Timestamp.fromMillis(untilMs),
          suspendedBy: callerUid,
          suspensionReasonPublic: reasonPublic.trim(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        await logAdminAudit(db, {
          actorUid: callerUid,
          targetUid,
          action: 'USER_SUSPENDED',
          reason: reasonPublic.trim(),
          metadata: { bulk: true, durationHours: h },
        });
      }

      successCount++;
    } catch (err: any) {
      failureCount++;
      errors.push({ uid: targetUid, error: err.message || 'Operation failed' });
    }
  }

  return { successCount, failureCount, errors };
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. adminBackfillUsers (Safe Legacy Migration Function)
// ─────────────────────────────────────────────────────────────────────────────

export const adminBackfillUsers = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  await verifyAdminCaller(db, request.auth.uid);

  const snapshot = await db.collection('users').get();
  let updatedCount = 0;

  for (const doc of snapshot.docs) {
    const raw = doc.data() || {};
    const updates: any = {};

    if (!raw.role) {
      updates.role = raw.isAdmin ? 'admin' : (raw.isSupporter ? 'supporter' : 'user');
    }
    if (!raw.accountStatus) {
      updates.accountStatus = raw.isBanned ? 'banned' : 'active';
    }

    // Clean up expired suspensions in Firestore
    if (raw.accountStatus === 'suspended') {
      let untilMs: number | null = null;
      const su = raw.suspendedUntil;
      if (su && typeof su.toMillis === 'function') untilMs = su.toMillis();
      else if (su && typeof su.toDate === 'function') untilMs = su.toDate().getTime();
      else if (typeof su === 'number') untilMs = su;
      else if (typeof su === 'string') untilMs = Date.parse(su);

      if (!untilMs || isNaN(untilMs) || untilMs <= Date.now()) {
        updates.accountStatus = 'active';
        updates.suspendedUntil = FieldValue.delete();
        updates.suspendedBy = FieldValue.delete();
        updates.suspensionReasonPublic = FieldValue.delete();
        updates.suspensionNoteInternal = FieldValue.delete();
      }
    }
    if (raw.displayName && !raw.displayNameLower) {
      updates.displayNameLower = raw.displayName.trim().toLowerCase();
    }
    if (raw.email && !raw.emailLower) {
      updates.emailLower = raw.email.trim().toLowerCase();
    }
    if (raw.username && !raw.usernameLowercase) {
      updates.usernameLowercase = raw.username.trim().toLowerCase().replace(/^@/, '');
    }

    if (!raw.createdAt) {
      try {
        const authRecord = await admin.auth().getUser(doc.id);
        if (authRecord.metadata.creationTime) {
          updates.createdAt = Timestamp.fromDate(new Date(authRecord.metadata.creationTime));
        }
      } catch (err) {
        console.warn(`Could not fetch creationTime for Auth user ${doc.id}`);
      }
    }

    if (Object.keys(updates).length > 0) {
      await doc.ref.set(updates, { merge: true });
      updatedCount++;
    }
  }

  console.log(`[ADMIN BACKFILL COMPLETED] Scanned ${snapshot.size} users, backfilled ${updatedCount} legacy documents.`);
  return { scanned: snapshot.size, backfilled: updatedCount };
});

// ─────────────────────────────────────────────────────────────────────────────
// adminListUsageStats
// ─────────────────────────────────────────────────────────────────────────────

export const adminListUsageStats = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');
  const db = admin.firestore();
  await verifyAdminCaller(db, request.auth.uid);

  const { search, role, sortBy = 'geoapifyCredits', timeframe = 'this_month', limit = 50 } = request.data || {};
  const queryLimit = Math.min(Math.max(1, Number(limit) || 50), 100);

  // Compute Europe/Berlin Date Key (e.g. 2026-08-28)
  const berlinDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

  // 1. Fetch Daily Global Aggregates (usage_daily/YYYY-MM-DD)
  const dailyDoc = await db.collection('usage_daily').doc(berlinDayKey).get();
  const dailyData = dailyDoc.exists ? (dailyDoc.data() || {}) : {};

  const dailyCreditLimit = Number(process.env.GEOAPIFY_DAILY_CREDIT_LIMIT) || 3000;
  const creditsToday = dailyData.credits || 0;
  const requestsToday = dailyData.requests || 0;
  const cacheHitsToday = dailyData.cacheHits || 0;
  const cacheMissesToday = dailyData.cacheMisses || 0;
  const successCountToday = dailyData.successCount || 0;
  const errorCountToday = dailyData.errorCount || 0;

  const cacheAvoidanceRate = (cacheHitsToday + cacheMissesToday) > 0
    ? Number(((cacheHitsToday / (cacheHitsToday + cacheMissesToday)) * 100).toFixed(1))
    : 0;

  const errorRate = (successCountToday + errorCountToday) > 0
    ? Number(((errorCountToday / (successCountToday + errorCountToday)) * 100).toFixed(1))
    : 0;

  // 2. Fetch User Usage Rankings
  const usageSnap = await db.collection('user_usage').limit(100).get();
  let usageDocs = usageSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Seed Fallback: Only in Development/Test Environments
  if (usageDocs.length === 0 && process.env.NODE_ENV !== 'production') {
    const usersSnap = await db.collection('users').limit(15).get();
    let seedIndex = 0;
    const nowYM = berlinDayKey.slice(0, 7).replace('-', '_');

    usageDocs = usersSnap.docs.map(doc => {
      const u = doc.data() || {};
      seedIndex++;
      const promptTok = Math.floor(1200 + (seedIndex * 3400) + (doc.id.length * 150));
      const compTok = Math.floor(400 + (seedIndex * 1100));
      const geoapifyReqs = Math.floor(12 + seedIndex * 9);
      const credits = Math.floor(18 + seedIndex * 14);
      const reqCount = Math.floor(5 + seedIndex * 8) + geoapifyReqs;

      return {
        id: `${nowYM}_${doc.id}`,
        uid: doc.id,
        yearMonth: nowYM,
        displayName: u.displayName || u.username || 'Activa User',
        username: u.username || null,
        email: u.email || null,
        photoURL: u.photoURL || null,
        role: u.role || (u.isAdmin ? 'admin' : (u.isSupporter ? 'supporter' : 'user')),
        isPremium: u.isPremium ?? false,
        geoapifyCredits: credits,
        geoapifyRequests: geoapifyReqs,
        cacheHits: Math.floor(45 + seedIndex * 30),
        cacheMisses: geoapifyReqs,
        promptTokens: promptTok,
        completionTokens: compTok,
        totalTokens: promptTok + compTok,
        requestCount: reqCount,
        estimatedCostUsd: Number((credits * 0.0005).toFixed(4)),
        lastUsedAt: Date.now() - (seedIndex * 3600000 * 3),
        feature: seedIndex % 3 === 0 ? 'geoapify_places' : (seedIndex % 2 === 0 ? 'intent_parsing' : 'activity_generator')
      };
    });
  }

  // Filter by Search Query
  if (search && typeof search === 'string' && search.trim()) {
    const clean = search.trim().toLowerCase();
    usageDocs = usageDocs.filter((item: any) =>
      (item.displayName && item.displayName.toLowerCase().includes(clean)) ||
      (item.username && item.username.toLowerCase().includes(clean)) ||
      (item.email && item.email.toLowerCase().includes(clean)) ||
      (item.uid && item.uid.toLowerCase().includes(clean))
    );
  }

  // Filter by Role
  if (role && role !== 'all') {
    usageDocs = usageDocs.filter((item: any) => {
      if (role === 'free') return !item.isPremium && item.role !== 'admin' && item.role !== 'superadmin';
      if (role === 'premium') return item.isPremium === true;
      if (role === 'admin') return item.role === 'admin' || item.role === 'superadmin';
      return item.role === role;
    });
  }

  // Sort Results
  usageDocs.sort((a: any, b: any) => {
    if (sortBy === 'requestCount') return (b.requestCount || 0) - (a.requestCount || 0);
    if (sortBy === 'cacheHits') return (b.cacheHits || 0) - (a.cacheHits || 0);
    if (sortBy === 'totalTokens') return (b.totalTokens || 0) - (a.totalTokens || 0);
    if (sortBy === 'recent') return (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
    // Default: geoapifyCredits desc
    return (b.geoapifyCredits || 0) - (a.geoapifyCredits || 0);
  });

  const slicedItems = usageDocs.slice(0, queryLimit);

  // Compute Aggregates
  const totalGeoapifyCredits = usageDocs.reduce((acc: number, cur: any) => acc + (cur.geoapifyCredits || 0), 0);
  const totalTokens = usageDocs.reduce((acc: number, cur: any) => acc + (cur.totalTokens || 0), 0);
  const totalRequests = usageDocs.reduce((acc: number, cur: any) => acc + (cur.requestCount || 0), 0);
  const activeUsersCount = usageDocs.length;

  return {
    items: slicedItems,
    summary: {
      berlinDayKey,
      creditsToday,
      dailyCreditLimit,
      dailyLimitPercentage: Math.min(100, Math.round((creditsToday / dailyCreditLimit) * 100)),
      requestsToday,
      cacheHitsToday,
      cacheMissesToday,
      cacheAvoidanceRate,
      errorRate,
      totalGeoapifyCredits,
      totalTokens,
      totalRequests,
      activeUsersCount,
      services: dailyData.services || {
        places: { requests: 0, credits: 0 },
        geocoding: { requests: 0, credits: 0 },
        reverse_geocoding: { requests: 0, credits: 0 },
        autocomplete: { requests: 0, credits: 0 },
        place_details: { requests: 0, credits: 0 },
      }
    }
  };
});



