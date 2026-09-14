import assert from 'node:assert';
import {
  canViewAdminDashboard,
  canModerateContent,
  canManageUsers,
  canManagePayments,
  canApproveCreators,
  canViewUsageMetrics,
  canManageSystem,
  canReviewKyc,
  normalizeRole
} from './permissions';

console.log('--- RUNNING CENTRAL PERMISSIONS UNIT TESTS ---');

// 1. Role normalization tests
assert.strictEqual(normalizeRole('admin'), 'admin');
assert.strictEqual(normalizeRole('SUPERADMIN'), 'superadmin');
assert.strictEqual(normalizeRole('  moderator  '), 'moderator');
assert.strictEqual(normalizeRole('supporter'), 'supporter');
assert.strictEqual(normalizeRole('invalid_role'), 'user');
assert.strictEqual(normalizeRole(null), 'user');
assert.strictEqual(normalizeRole(undefined), 'user');
console.log('✅ normalizeRole tests passed');

// 2. User & Creator & Supporter (No Admin Privileges)
['user', 'creator', 'supporter'].forEach((role) => {
  assert.strictEqual(canViewAdminDashboard(role), false, `${role} cannot view dashboard`);
  assert.strictEqual(canModerateContent(role), false, `${role} cannot moderate`);
  assert.strictEqual(canManageUsers(role), false, `${role} cannot manage users`);
  assert.strictEqual(canManagePayments(role), false, `${role} cannot manage payments`);
  assert.strictEqual(canApproveCreators(role), false, `${role} cannot approve creators`);
  assert.strictEqual(canViewUsageMetrics(role), false, `${role} cannot view usage`);
  assert.strictEqual(canManageSystem(role), false, `${role} cannot manage system`);
  assert.strictEqual(canReviewKyc(role), false, `${role} cannot review KYC`);
});
console.log('✅ Standard user, creator & supporter isolation tests passed');

// 3. Moderator Access Limits
assert.strictEqual(canViewAdminDashboard('moderator'), true, 'moderator can view dashboard');
assert.strictEqual(canModerateContent('moderator'), true, 'moderator can moderate content');
assert.strictEqual(canManageUsers('moderator'), false, 'moderator CANNOT manage users');
assert.strictEqual(canManagePayments('moderator'), false, 'moderator CANNOT manage payments');
assert.strictEqual(canApproveCreators('moderator'), false, 'moderator CANNOT approve creators');
assert.strictEqual(canViewUsageMetrics('moderator'), false, 'moderator CANNOT view usage metrics');
assert.strictEqual(canManageSystem('moderator'), false, 'moderator CANNOT manage system');
assert.strictEqual(canReviewKyc('moderator'), false, 'moderator CANNOT review KYC');
console.log('✅ Moderator isolation tests passed');

// 4. Finance Access Limits
assert.strictEqual(canViewAdminDashboard('finance'), true, 'finance can view dashboard');
assert.strictEqual(canModerateContent('finance'), false, 'finance CANNOT moderate content');
assert.strictEqual(canManageUsers('finance'), false, 'finance CANNOT manage users');
assert.strictEqual(canManagePayments('finance'), true, 'finance can manage payments');
assert.strictEqual(canApproveCreators('finance'), false, 'finance CANNOT approve creators');
assert.strictEqual(canViewUsageMetrics('finance'), false, 'finance CANNOT view usage metrics');
assert.strictEqual(canManageSystem('finance'), false, 'finance CANNOT manage system');
assert.strictEqual(canReviewKyc('finance'), false, 'finance CANNOT review KYC');
console.log('✅ Finance isolation tests passed');

// 5. Admin & Superadmin Full Access
['admin', 'superadmin'].forEach((role) => {
  assert.strictEqual(canViewAdminDashboard(role), true, `${role} can view dashboard`);
  assert.strictEqual(canModerateContent(role), true, `${role} can moderate`);
  assert.strictEqual(canManageUsers(role), true, `${role} can manage users`);
  assert.strictEqual(canManagePayments(role), true, `${role} can manage payments`);
  assert.strictEqual(canApproveCreators(role), true, `${role} can approve creators`);
  assert.strictEqual(canViewUsageMetrics(role), true, `${role} can view usage`);
  assert.strictEqual(canManageSystem(role), true, `${role} can manage system`);
  assert.strictEqual(canReviewKyc(role), true, `${role} can review KYC`);
});
console.log('✅ Admin & Superadmin full access tests passed');

console.log('🎉 ALL CENTRAL PERMISSIONS UNIT TESTS PASSED SUCCESSFULLY! 🎉');
