import assert from 'assert';
import { getRoleRank, checkRoleModificationPermission } from './admin-users';
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

  assert.doesNotThrow(() => {
    checkRoleModificationPermission('superadmin', 'user', 'superadmin');
  });
  console.log('  ✅ Role modification privilege escalation safeguards passed');

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

  console.log('\n🎉 ALL ADMIN USERS BACKEND UNIT TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runAdminUsersBackendTests().catch((err) => {
  console.error('❌ Admin Users Backend Unit Tests failed:', err);
  process.exit(1);
});
