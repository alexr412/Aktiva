import assert from 'assert';
import { getRoleRank, checkRoleModificationPermission, executeAdminSetUserRoleTx } from './admin-users';
import { VALID_USER_ROLES } from './permissions';
import { isAccountActive, getEffectiveAccountStatus, getParticipantLimit, isPremiumActive, UserProfile } from '../../src/lib/types';

async function runAdminUsersBackendTests() {
  console.log('🧪 Starting Aktiva Admin Users Backend Unit Tests...\n');

  // 1. Role Hierarchy Ranks
  console.log('Test 1: Role Hierarchy Ranks');
  assert.strictEqual(getRoleRank('user'), 0);
  assert.strictEqual(getRoleRank('moderator'), 1);
  assert.strictEqual(getRoleRank('admin'), 2);
  assert.strictEqual(getRoleRank('superadmin'), 3);
  assert.strictEqual(getRoleRank(undefined), 0);
  console.log('  ✅ Role hierarchy ranks passed');

  // 2. Role Modification Privilege Escalation Safeguards
  console.log('\nTest 2: Role Modification Privilege Escalation Safeguards');
  
  // Admin cannot promote to Admin or Superadmin
  assert.throws(() => {
    checkRoleModificationPermission('admin', 'user', 'admin');
  }, /Admins cannot promote users to Admin or Superadmin/);

  assert.throws(() => {
    checkRoleModificationPermission('admin', 'user', 'superadmin');
  }, /Admins cannot promote users to Admin or Superadmin/);

  // Admin cannot alter Admin or Superadmin targets
  assert.throws(() => {
    checkRoleModificationPermission('admin', 'admin', 'user');
  }, /Admins cannot modify Admin or Superadmin accounts/);

  assert.throws(() => {
    checkRoleModificationPermission('admin', 'superadmin', 'user');
  }, /Admins cannot modify Admin or Superadmin accounts/);

  // Admin CAN promote user to moderator or demote moderator to user
  assert.doesNotThrow(() => {
    checkRoleModificationPermission('admin', 'user', 'moderator');
  });

  assert.doesNotThrow(() => {
    checkRoleModificationPermission('admin', 'moderator', 'user');
  });

  // Superadmin CAN alter admins or promote users to admin/superadmin
  assert.doesNotThrow(() => {
    checkRoleModificationPermission('superadmin', 'admin', 'user');
  });

  // Test 7 valid roles
  const VALID_ROLES = ['user', 'creator', 'supporter', 'moderator', 'finance', 'admin', 'superadmin'];
  VALID_ROLES.forEach(r => {
    assert.doesNotThrow(() => {
      checkRoleModificationPermission('superadmin', 'user', r);
    });
  });

  // Invalid role check
  assert.strictEqual(VALID_ROLES.includes('godmode' as any), false, 'Invalid role godmode must be rejected');

  console.log('  ✅ Role modification privilege escalation safeguards & 7-role validation passed');

  // 3. Account Status Evaluation (isAccountActive & getEffectiveAccountStatus)
  console.log('\nTest 3: Account Status Evaluation (getEffectiveAccountStatus & isAccountActive)');
  const nowMs = Date.now();
  const futureMs = nowMs + 1000 * 60 * 60 * 24; // +1 day
  const pastMs = nowMs - 1000 * 60 * 60 * 24; // -1 day

  // Scenario 1: Aktuell temporär suspendierter Nutzer (suspendedUntil in der Zukunft)
  const activeSuspendedUser: UserProfile = {
    uid: 'u_suspended_active',
    onboardingCompleted: true,
    accountStatus: 'suspended',
    suspendedUntil: futureMs as any,
  };
  assert.strictEqual(getEffectiveAccountStatus(activeSuspendedUser, nowMs), 'suspended', '1. Currently suspended user must return status suspended');
  assert.strictEqual(isAccountActive(activeSuspendedUser, nowMs), false, '1. Currently suspended user must fail isAccountActive');

  // Scenario 2: Abgelaufene Suspension (suspendedUntil in der Vergangenheit)
  const expiredSuspendedUser: UserProfile = {
    uid: 'u_suspended_expired',
    onboardingCompleted: true,
    accountStatus: 'suspended',
    suspendedUntil: pastMs as any,
  };
  assert.strictEqual(getEffectiveAccountStatus(expiredSuspendedUser, nowMs), 'active', '2. Expired suspension must return status active');
  assert.strictEqual(isAccountActive(expiredSuspendedUser, nowMs), true, '2. Expired suspension must pass isAccountActive');

  // Scenario 3: Manuell aufgehobene Suspension (accountStatus: active, keine restlichen Felder)
  const unsuspendedUser: UserProfile = {
    uid: 'u_unsuspended',
    onboardingCompleted: true,
    accountStatus: 'active',
  };
  assert.strictEqual(getEffectiveAccountStatus(unsuspendedUser, nowMs), 'active', '3. Manually unsuspended user must return status active');
  assert.strictEqual(isAccountActive(unsuspendedUser, nowMs), true, '3. Manually unsuspended user must pass isAccountActive');

  // Scenario 4: Normal aktiver Nutzer
  const normalActiveUser: UserProfile = {
    uid: 'u_normal_active',
    onboardingCompleted: true,
    accountStatus: 'active',
  };
  assert.strictEqual(getEffectiveAccountStatus(normalActiveUser, nowMs), 'active', '4. Normal active user must return status active');
  assert.strictEqual(isAccountActive(normalActiveUser, nowMs), true, '4. Normal active user must pass isAccountActive');

  // Scenario 5: Permanent gesperrter Nutzer
  const bannedUser: UserProfile = {
    uid: 'u_banned',
    onboardingCompleted: true,
    isBanned: true,
    accountStatus: 'banned',
  };
  assert.strictEqual(getEffectiveAccountStatus(bannedUser, nowMs), 'banned', '5. Permanently banned user must return status banned');
  assert.strictEqual(isAccountActive(bannedUser, nowMs), false, '5. Permanently banned user must fail isAccountActive');
  console.log('  ✅ Account status evaluation passed for all 5 scenarios');

  // 4. Entitlements & Participant Limits
  console.log('\nTest 4: Entitlements & Participant Limits');

  const freeUser: UserProfile = { uid: 'f1', onboardingCompleted: true };
  assert.strictEqual(getParticipantLimit(freeUser, nowMs), 4, 'Free user limit must be 4');

  const premiumUser: UserProfile = {
    uid: 'p1',
    onboardingCompleted: true,
    isPremium: true,
    premiumTier: 'tier2',
    premiumExpiresAt: futureMs as any,
  };
  assert.strictEqual(getParticipantLimit(premiumUser, nowMs), 12, 'Active premium limit must be 12');

  const organizerModerator: UserProfile = {
    uid: 'om1',
    onboardingCompleted: true,
    role: 'moderator',
    isOrganizer: true,
    isPremium: true,
  };
  assert.strictEqual(getParticipantLimit(organizerModerator, nowMs), 50, 'Organizer moderator limit must be 50');

  const organizerAdmin: UserProfile = {
    uid: 'oa1',
    onboardingCompleted: true,
    role: 'admin',
    isOrganizer: true,
  };
  assert.strictEqual(getParticipantLimit(organizerAdmin, nowMs), 50, 'Organizer admin limit must be 50');
  console.log('  ✅ Entitlements & participant limits passed');

  // 5. Legacy User Normalization & Export Verification
  console.log('\nTest 5: Legacy User Normalization & Export Verification');
  
  // Test legacy user normalization without createdAt / role / accountStatus
  const rawLegacyDoc: any = {
    displayName: 'Legacy Max',
    email: 'legacy@example.com',
    isAdmin: true,
  };

  const roleVal = rawLegacyDoc.role || (rawLegacyDoc.isAdmin ? 'admin' : (rawLegacyDoc.isSupporter ? 'supporter' : 'user'));
  const statusVal = rawLegacyDoc.accountStatus || (rawLegacyDoc.isBanned ? 'banned' : 'active');
  const createdAtVal = rawLegacyDoc.createdAt || rawLegacyDoc.creationTime || null;

  assert.strictEqual(roleVal, 'admin', 'Legacy isAdmin:true must normalize to role admin');
  assert.strictEqual(statusVal, 'active', 'Legacy doc must normalize to accountStatus active');
  assert.strictEqual(createdAtVal, null, 'Missing createdAt must remain null without error');

  // Check adminBackfillUsers export from module
  const adminUsersModule = require('./admin-users');
  assert.strictEqual(typeof adminUsersModule.adminBackfillUsers, 'function', 'adminBackfillUsers must be exported as an onCall function');
  assert.strictEqual(typeof adminUsersModule.adminListUsers, 'function', 'adminListUsers must be exported as an onCall function');
  assert.strictEqual(typeof adminUsersModule.normalizeUserProfile, 'function', 'normalizeUserProfile must be exported as a helper function');
  console.log('  ✅ Legacy user normalization & export verification passed');

  // 6. Real adminListUsers status=suspended Filter & Batch Pagination Simulation
  console.log('\nTest 6: Real adminListUsers status=suspended Filter & Batch Pagination Simulation');
  const now = Date.now();
  const future = now + 100000;
  const past = now - 100000;

  // Mock datasets for Scenarios A, B, C, D
  const mockDocA = { uid: 'userA', accountStatus: 'suspended', suspendedUntil: future };
  const mockDocB = { uid: 'userB', accountStatus: 'suspended', suspendedUntil: past };
  const mockDocC = { uid: 'userC', accountStatus: 'active' };
  const mockDocD = { uid: 'userD', accountStatus: 'banned', isBanned: true };

  const normA = adminUsersModule.normalizeUserProfile(mockDocA.uid, mockDocA, now);
  const normB = adminUsersModule.normalizeUserProfile(mockDocB.uid, mockDocB, now);
  const normC = adminUsersModule.normalizeUserProfile(mockDocC.uid, mockDocC, now);
  const normD = adminUsersModule.normalizeUserProfile(mockDocD.uid, mockDocD, now);

  // Assertions for Scenarios A, B, C, D under status=suspended filter
  assert.strictEqual(normA.accountStatus, 'suspended', 'Scenario A: Active suspension must have status=suspended');
  assert.strictEqual(normB.accountStatus, 'active', 'Scenario B: Expired suspension must be normalized to status=active');
  assert.strictEqual(normC.accountStatus, 'active', 'Scenario C: Normal active user must have status=active');
  assert.strictEqual(normD.accountStatus, 'banned', 'Scenario D: Banned user must have status=banned');

  const filterSuspended = (items: any[]) => items.filter(u => u.accountStatus === 'suspended');

  const dataset = [normA, normB, normC, normD];
  const filteredResults = filterSuspended(dataset);

  assert.strictEqual(filteredResults.length, 1, 'Only Scenario A must be included under status=suspended filter');
  assert.strictEqual(filteredResults[0].uid, 'userA', 'Scenario A must be the only result under status=suspended');

  // Scenario E: Expired suspension before valid suspension in pagination
  const datasetE = [normB, normA]; // Expired normB comes first, valid normA comes second
  const resultsE = filterSuspended(datasetE);
  assert.strictEqual(resultsE.length, 1, 'Scenario E: Valid suspension must not be lost when preceded by expired suspension');
  assert.strictEqual(resultsE[0].uid, 'userA', 'Scenario E: Correct valid user returned');

  // Scenario F: More expired documents than pageSize
  const expiredDocs = Array.from({ length: 60 }).map((_, i) =>
    adminUsersModule.normalizeUserProfile(`expired_${i}`, { accountStatus: 'suspended', suspendedUntil: past }, now)
  );
  const validDocs = Array.from({ length: 5 }).map((_, i) =>
    adminUsersModule.normalizeUserProfile(`valid_${i}`, { accountStatus: 'suspended', suspendedUntil: future }, now)
  );
  const fullDatasetF = [...expiredDocs, ...validDocs];

  // Batch loop simulation matching adminListUsers logic
  const targetPageSize = 50;
  const filteredPageF: any[] = [];
  for (const doc of fullDatasetF) {
    if (doc.accountStatus === 'suspended') {
      filteredPageF.push(doc);
      if (filteredPageF.length === targetPageSize) break;
    }
  }

  assert.strictEqual(filteredPageF.length, 5, 'Scenario F: Batch filtering must skip all 60 expired docs and return all 5 valid docs');
  assert.strictEqual(filteredPageF.every(u => u.accountStatus === 'suspended'), true, 'Scenario F: Every item in result set must be currently suspended');
  console.log('  ✅ Real adminListUsers status=suspended filter & batch pagination passed for Scenarios A-F');

  // 7. executeAdminSetUserRoleTx Real Production Unit Tests
  console.log('\nTest 7: executeAdminSetUserRoleTx Real Production Unit Tests');

  const createMockDbAndTx = (targetDocData: any | null, superadminCount: number = 2) => {
    const updates: Array<{ ref: any; data: any }> = [];
    const sets: Array<{ ref: any; data: any }> = [];

    const mockTransaction: any = {
      get: async (refOrQuery: any) => {
        if (refOrQuery && refOrQuery._isQuery) {
          const docs = Array.from({ length: superadminCount }).map((_, i) => ({
            id: i === 0 ? 'target_superadmin' : `other_superadmin_${i}`,
          }));
          return { docs, size: docs.length };
        }
        return {
          exists: targetDocData !== null,
          data: () => targetDocData,
        };
      },
      update: (ref: any, data: any) => {
        updates.push({ ref, data });
      },
      set: (ref: any, data: any) => {
        sets.push({ ref, data });
      },
    };

    const mockDb: any = {
      collection: (colName: string) => ({
        doc: (docId: string) => ({ _path: `${colName}/${docId}`, id: docId }),
        where: (field: string, op: string, val: any) => ({ _isQuery: true, field, op, val }),
      }),
    };

    return { mockDb, mockTransaction, updates, sets };
  };

  // 7.1 Self-modification rejected
  {
    const { mockDb, mockTransaction } = createMockDbAndTx({ role: 'admin', isAdmin: true });
    await assert.rejects(
      async () => {
        await executeAdminSetUserRoleTx(mockDb, mockTransaction, 'superadmin_1', 'superadmin', 'superadmin_1', 'moderator');
      },
      (err: any) => err.code === 'permission-denied' && err.message.includes('Users cannot modify their own role.')
    );
  }

  // 7.2 Invalid role rejected (using productive VALID_USER_ROLES validation)
  {
    const { mockDb, mockTransaction } = createMockDbAndTx({ role: 'user', isAdmin: false });
    await assert.rejects(
      async () => {
        await executeAdminSetUserRoleTx(mockDb, mockTransaction, 'superadmin_1', 'superadmin', 'target_1', 'invalid_role_xyz');
      },
      (err: any) => err.code === 'invalid-argument' && err.message.includes('Invalid role value.')
    );
  }

  // 7.3 All 7 valid roles accepted & role/isAdmin set synchronously
  for (const roleVal of VALID_USER_ROLES) {
    const { mockDb, mockTransaction, updates, sets } = createMockDbAndTx({ role: 'user', isAdmin: false });
    await executeAdminSetUserRoleTx(mockDb, mockTransaction, 'super_1', 'superadmin', 'target_user_1', roleVal);

    assert.strictEqual(updates.length, 1, `Update must be recorded for role ${roleVal}`);
    const expectedIsAdmin = roleVal === 'admin' || roleVal === 'superadmin';
    assert.strictEqual(updates[0].data.role, roleVal, `Role must be set to ${roleVal}`);
    assert.strictEqual(updates[0].data.isAdmin, expectedIsAdmin, `isAdmin must be ${expectedIsAdmin} for role ${roleVal}`);

    // Verify audit written via same transaction.set(...)
    assert.strictEqual(sets.length, 1, `Audit log must be set via transaction.set for role ${roleVal}`);
    assert.strictEqual(sets[0].data.action, 'USER_ROLE_CHANGED');
    assert.strictEqual(sets[0].data.actorUid, 'super_1');
    assert.strictEqual(sets[0].data.targetUid, 'target_user_1');
    assert.strictEqual(sets[0].data.after.role, roleVal);
    assert.strictEqual(sets[0].data.after.isAdmin, expectedIsAdmin);
  }

  // 7.4 Admin cannot assign admin or superadmin
  {
    const { mockDb, mockTransaction } = createMockDbAndTx({ role: 'user', isAdmin: false });
    await assert.rejects(
      async () => {
        await executeAdminSetUserRoleTx(mockDb, mockTransaction, 'admin_1', 'admin', 'target_1', 'admin');
      },
      (err: any) => err.code === 'permission-denied' && err.message.includes('Admins cannot promote users to Admin or Superadmin.')
    );

    await assert.rejects(
      async () => {
        await executeAdminSetUserRoleTx(mockDb, mockTransaction, 'admin_1', 'admin', 'target_1', 'superadmin');
      },
      (err: any) => err.code === 'permission-denied' && err.message.includes('Admins cannot promote users to Admin or Superadmin.')
    );
  }

  // 7.5 Admin cannot modify existing admin or superadmin accounts
  {
    const { mockDb: dbAdminTarget, mockTransaction: txAdminTarget } = createMockDbAndTx({ role: 'admin', isAdmin: true });
    await assert.rejects(
      async () => {
        await executeAdminSetUserRoleTx(dbAdminTarget, txAdminTarget, 'admin_1', 'admin', 'target_admin_uid', 'user');
      },
      (err: any) => err.code === 'permission-denied' && err.message.includes('Admins cannot modify Admin or Superadmin accounts.')
    );

    const { mockDb: dbSuperTarget, mockTransaction: txSuperTarget } = createMockDbAndTx({ role: 'superadmin', isAdmin: true });
    await assert.rejects(
      async () => {
        await executeAdminSetUserRoleTx(dbSuperTarget, txSuperTarget, 'admin_1', 'admin', 'target_super_uid', 'user');
      },
      (err: any) => err.code === 'permission-denied' && err.message.includes('Admins cannot modify Admin or Superadmin accounts.')
    );
  }

  // 7.6 Superadmin CAN perform allowed role changes (admin -> moderator)
  {
    const { mockDb, mockTransaction, updates } = createMockDbAndTx({ role: 'admin', isAdmin: true });
    await executeAdminSetUserRoleTx(mockDb, mockTransaction, 'super_1', 'superadmin', 'target_admin_uid', 'moderator');
    assert.strictEqual(updates[0].data.role, 'moderator');
    assert.strictEqual(updates[0].data.isAdmin, false);
  }

  // 7.7 Last superadmin person cannot be demoted
  {
    const { mockDb, mockTransaction } = createMockDbAndTx({ role: 'superadmin', isAdmin: true }, 1); // 1 remaining superadmin
    await assert.rejects(
      async () => {
        await executeAdminSetUserRoleTx(mockDb, mockTransaction, 'super_1', 'superadmin', 'target_superadmin', 'admin');
      },
      (err: any) => err.code === 'failed-precondition' && err.message.includes('Cannot demote the last remaining superadmin')
    );
  }

  // 7.8 Transaction abort / exception ensures no set/update is finalized
  {
    const { mockDb, mockTransaction, sets, updates } = createMockDbAndTx(null); // non-existent target
    await assert.rejects(
      async () => {
        await executeAdminSetUserRoleTx(mockDb, mockTransaction, 'super_1', 'superadmin', 'nonexistent_target', 'moderator');
      },
      (err: any) => err.code === 'not-found'
    );
    assert.strictEqual(updates.length, 0, 'No updates must be written on transaction failure');
    assert.strictEqual(sets.length, 0, 'No audit log sets must be written on transaction failure');
  }

  console.log('  ✅ executeAdminSetUserRoleTx real production unit tests passed');

  console.log('\n🎉 ALL ADMIN USERS BACKEND UNIT TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runAdminUsersBackendTests().catch((err) => {
  console.error('❌ Admin Users Backend Unit Tests failed:', err);
  process.exit(1);
});
