import test from 'node:test';
import assert from 'node:assert';
import { canManageSystem } from './permissions';

test('Canonical RBAC Permission Tests for canManageSystem', async (t) => {
  await t.test('allows admin role', () => {
    assert.strictEqual(canManageSystem('admin'), true);
  });

  await t.test('allows superadmin role', () => {
    assert.strictEqual(canManageSystem('superadmin'), true);
  });

  await t.test('rejects moderator role', () => {
    assert.strictEqual(canManageSystem('moderator'), false);
  });

  await t.test('rejects finance role', () => {
    assert.strictEqual(canManageSystem('finance'), false);
  });

  await t.test('rejects supporter role', () => {
    assert.strictEqual(canManageSystem('supporter'), false);
  });

  await t.test('rejects creator role', () => {
    assert.strictEqual(canManageSystem('creator'), false);
  });

  await t.test('rejects standard user role', () => {
    assert.strictEqual(canManageSystem('user'), false);
  });

  await t.test('rejects missing or null role', () => {
    assert.strictEqual(canManageSystem(null), false);
    assert.strictEqual(canManageSystem(undefined), false);
    assert.strictEqual(canManageSystem(''), false);
  });
});

test('handleTriggerWeeklyReportManual Integration & RBAC', async (t) => {
  const { handleTriggerWeeklyReportManual } = await import('./reports');

  function createMockDb(userRole?: string | null, isAdminFlag?: boolean) {
    return {
      collection(colName: string) {
        return {
          doc(docId: string) {
            return {
              async get() {
                if (colName === 'users' && docId === 'caller_123') {
                  if (userRole === undefined) return { exists: false, data: () => null };
                  return {
                    exists: true,
                    data: () => ({ role: userRole, isAdmin: isAdminFlag })
                  };
                }
                return { exists: false, data: () => null };
              }
            };
          }
        };
      }
    };
  }

  const dummyAggregator = async () => ({ processed: 5, sent: 2 });

  await t.test('rejects unauthenticated caller', async () => {
    await assert.rejects(
      async () => handleTriggerWeeklyReportManual({}, createMockDb('admin'), dummyAggregator),
      (err: any) => err.code === 'unauthenticated'
    );
  });

  await t.test('rejects caller when user document does not exist', async () => {
    await assert.rejects(
      async () => handleTriggerWeeklyReportManual({ auth: { uid: 'caller_123' } }, createMockDb(undefined), dummyAggregator),
      (err: any) => err.code === 'permission-denied'
    );
  });

  await t.test('rejects non-admin roles (user, moderator, etc.) even if isAdmin: true is set', async () => {
    await assert.rejects(
      async () => handleTriggerWeeklyReportManual({ auth: { uid: 'caller_123' } }, createMockDb('user', true), dummyAggregator),
      (err: any) => err.code === 'permission-denied'
    );
    await assert.rejects(
      async () => handleTriggerWeeklyReportManual({ auth: { uid: 'caller_123' } }, createMockDb('moderator', true), dummyAggregator),
      (err: any) => err.code === 'permission-denied'
    );
  });

  await t.test('allows admin role', async () => {
    const res = await handleTriggerWeeklyReportManual({ auth: { uid: 'caller_123' } }, createMockDb('admin'), dummyAggregator);
    assert.strictEqual(res.processed, 5);
    assert.strictEqual(res.sent, 2);
  });

  await t.test('allows superadmin role', async () => {
    const res = await handleTriggerWeeklyReportManual({ auth: { uid: 'caller_123' } }, createMockDb('superadmin'), dummyAggregator);
    assert.strictEqual(res.processed, 5);
    assert.strictEqual(res.sent, 2);
  });
});
