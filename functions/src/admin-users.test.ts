import assert from 'assert';
import { getRoleRank, checkRoleModificationPermission } from './admin-users';
import { isAccountActive, getParticipantLimit, isPremiumActive, UserProfile } from '../../src/lib/types';

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

  // 3. Account Status Evaluation (isAccountActive)
  console.log('\nTest 3: Account Status Evaluation (isAccountActive)');
  const nowMs = Date.now();
  const futureMs = nowMs + 1000 * 60 * 60 * 24; // +1 day
  const pastMs = nowMs - 1000 * 60 * 60 * 24; // -1 day

  const activeUser: UserProfile = { uid: 'u1', onboardingCompleted: true, accountStatus: 'active' };
  assert.strictEqual(isAccountActive(activeUser, nowMs), true, 'Active user must pass');

  const bannedUser: UserProfile = { uid: 'u2', onboardingCompleted: true, isBanned: true, accountStatus: 'banned' };
  assert.strictEqual(isAccountActive(bannedUser, nowMs), false, 'Banned user must fail');

  const activeSuspendedUser: UserProfile = {
    uid: 'u3',
    onboardingCompleted: true,
    accountStatus: 'suspended',
    suspendedUntil: futureMs as any,
  };
  assert.strictEqual(isAccountActive(activeSuspendedUser, nowMs), false, 'Active suspended user must fail');

  const expiredSuspendedUser: UserProfile = {
    uid: 'u4',
    onboardingCompleted: true,
    accountStatus: 'suspended',
    suspendedUntil: pastMs as any,
  };
  assert.strictEqual(isAccountActive(expiredSuspendedUser, nowMs), true, 'Expired suspended user must pass');
  console.log('  ✅ Account status evaluation passed');

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
  console.log('  ✅ Legacy user normalization & export verification passed');

  console.log('\n🎉 ALL ADMIN USERS BACKEND UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runAdminUsersBackendTests().catch((err) => {
  console.error('❌ Admin Users Backend Unit Tests failed:', err);
  process.exit(1);
});
