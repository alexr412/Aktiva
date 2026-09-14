import assert from 'node:assert';
import * as clientPerms from './permissions';
import * as serverPerms from '../../functions/src/permissions';

console.log('--- RUNNING PERMISSIONS PARITY TEST (CLIENT vs FUNCTIONS) ---');

const roles: Array<clientPerms.UserRole> = [
  'user',
  'creator',
  'supporter',
  'moderator',
  'finance',
  'admin',
  'superadmin'
];

roles.forEach((role) => {
  assert.strictEqual(
    clientPerms.canViewAdminDashboard(role),
    serverPerms.canViewAdminDashboard(role),
    `Parity fail for canViewAdminDashboard on role ${role}`
  );
  assert.strictEqual(
    clientPerms.canModerateContent(role),
    serverPerms.canModerateContent(role),
    `Parity fail for canModerateContent on role ${role}`
  );
  assert.strictEqual(
    clientPerms.canManageUsers(role),
    serverPerms.canManageUsers(role),
    `Parity fail for canManageUsers on role ${role}`
  );
  assert.strictEqual(
    clientPerms.canManagePayments(role),
    serverPerms.canManagePayments(role),
    `Parity fail for canManagePayments on role ${role}`
  );
  assert.strictEqual(
    clientPerms.canApproveCreators(role),
    serverPerms.canApproveCreators(role),
    `Parity fail for canApproveCreators on role ${role}`
  );
  assert.strictEqual(
    clientPerms.canViewUsageMetrics(role),
    serverPerms.canViewUsageMetrics(role),
    `Parity fail for canViewUsageMetrics on role ${role}`
  );
  assert.strictEqual(
    clientPerms.canManageSystem(role),
    serverPerms.canManageSystem(role),
    `Parity fail for canManageSystem on role ${role}`
  );
  assert.strictEqual(
    clientPerms.canReviewKyc(role),
    serverPerms.canReviewKyc(role),
    `Parity fail for canReviewKyc on role ${role}`
  );
});

console.log('🎉 ALL PERMISSIONS PARITY TESTS PASSED SUCCESSFULLY! CLIENT AND SERVER ARE 100% IN SYNC. 🎉');
