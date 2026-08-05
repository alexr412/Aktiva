import assert from 'node:assert';
import { getMigratedItem, setMigratedItem, removeMigratedItem } from './storage-migration';

console.log('--- RUNNING ACTIVA STORAGE & MIGRATION UNIT TESTS ---');

// Mock localStorage / sessionStorage setup for Node environment
class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}

const mockLocal = new MockStorage();
const mockSession = new MockStorage();

(globalThis as any).localStorage = mockLocal;
(globalThis as any).sessionStorage = mockSession;

// 1. Test: Only old storage key present
function testOnlyOldKeyPresent() {
  console.log('Test 1: Only old storage key present');
  mockLocal.clear();
  mockLocal.setItem('aktiva_last_location', JSON.stringify({ lat: 52.52, lng: 13.40 }));

  const val = getMigratedItem('activa_last_location', 'aktiva_last_location');
  assert.strictEqual(val, JSON.stringify({ lat: 52.52, lng: 13.40 }), 'Value should be returned from legacy key');
  assert.strictEqual(mockLocal.getItem('activa_last_location'), JSON.stringify({ lat: 52.52, lng: 13.40 }), 'Value should be copied to new key');
  assert.strictEqual(mockLocal.getItem('aktiva_last_location'), JSON.stringify({ lat: 52.52, lng: 13.40 }), 'Legacy key should remain intact for rollback compatibility');
  console.log('  ✅ Test 1 passed');
}

// 2. Test: Both old and new key present simultaneously (new key takes precedence)
function testBothKeysPresent() {
  console.log('\nTest 2: Both old and new key present (new key takes precedence)');
  mockLocal.clear();
  mockLocal.setItem('aktiva_collections', JSON.stringify([{ id: 'old_1', name: 'Alte Sammlung' }]));
  mockLocal.setItem('activa_collections', JSON.stringify([{ id: 'new_1', name: 'Neue Sammlung' }]));

  const val = getMigratedItem('activa_collections', 'aktiva_collections');
  assert.strictEqual(val, JSON.stringify([{ id: 'new_1', name: 'Neue Sammlung' }]), 'New key value MUST take precedence');
  assert.strictEqual(mockLocal.getItem('activa_collections'), JSON.stringify([{ id: 'new_1', name: 'Neue Sammlung' }]), 'New key value must remain unchanged');
  console.log('  ✅ Test 2 passed');
}

// 3. Test: Invalid/malformed legacy value
function testInvalidLegacyValue() {
  console.log('\nTest 3: Invalid/malformed legacy value');
  mockLocal.clear();
  mockLocal.setItem('aktiva_last_location', '{malformed_json...');

  const val = getMigratedItem('activa_last_location', 'aktiva_last_location');
  assert.strictEqual(val, '{malformed_json...', 'Raw string stored in legacy key should be preserved without crashing');
  assert.strictEqual(mockLocal.getItem('activa_last_location'), '{malformed_json...', 'Malformed string copied safely');
  console.log('  ✅ Test 3 passed');
}

// 4. Test: Idempotent multiple-run migration
function testMultipleRunMigration() {
  console.log('\nTest 4: Idempotent multiple-run migration');
  mockLocal.clear();
  mockLocal.setItem('aktiva_radar_notifications_u1', 'data_123');

  // First run
  const run1 = getMigratedItem('activa_radar_notifications_u1', 'aktiva_radar_notifications_u1');
  assert.strictEqual(run1, 'data_123');

  // Second run
  const run2 = getMigratedItem('activa_radar_notifications_u1', 'aktiva_radar_notifications_u1');
  assert.strictEqual(run2, 'data_123');

  // Third run with updated new key
  setMigratedItem('activa_radar_notifications_u1', 'aktiva_radar_notifications_u1', 'updated_456');
  const run3 = getMigratedItem('activa_radar_notifications_u1', 'aktiva_radar_notifications_u1');
  assert.strictEqual(run3, 'updated_456', 'Updated value returned cleanly');
  assert.strictEqual(mockLocal.getItem('aktiva_radar_notifications_u1'), 'updated_456', 'Rollback key updated in sync');
  console.log('  ✅ Test 4 passed');
}

// 5. Test: Unavailable / restricted storage
function testRestrictedStorage() {
  console.log('\nTest 5: Restricted / throwing storage handled gracefully');
  const restrictedStorage: Storage = {
    length: 0,
    clear: () => {},
    getItem: () => { throw new Error('QuotaExceededError / Access Denied'); },
    key: () => null,
    removeItem: () => {},
    setItem: () => { throw new Error('QuotaExceededError / Access Denied'); },
  };

  const savedLocal = (globalThis as any).localStorage;
  (globalThis as any).localStorage = restrictedStorage;

  const val = getMigratedItem('activa_test', 'aktiva_test');
  assert.strictEqual(val, null, 'Restricted storage read must return null without throwing error');

  (globalThis as any).localStorage = savedLocal;
  console.log('  ✅ Test 5 passed');
}

// 6. Test: Service Worker Cache Cleanup Logic
function testServiceWorkerCacheCleanup() {
  console.log('\nTest 6: Service Worker Cache Cleanup Logic');
  const STATIC_CACHE = 'activa-v1-static';
  const DYNAMIC_CACHE = 'activa-v1-dynamic';

  const existingCaches = [
    'aktiva-v0-static',
    'aktiva-v0-dynamic',
    'activa-v0-old-static',
    'activa-v1-static',
    'activa-v1-dynamic',
    'unrelated-cache'
  ];

  const cachesToDelete = existingCaches.filter(
    (name) => (name.startsWith('aktiva-') || name.startsWith('activa-')) && name !== STATIC_CACHE && name !== DYNAMIC_CACHE
  );

  assert.deepStrictEqual(cachesToDelete, [
    'aktiva-v0-static',
    'aktiva-v0-dynamic',
    'activa-v0-old-static'
  ], 'Must identify all legacy aktiva-* and old activa-* caches for deletion');

  console.log('  ✅ Test 6 passed');
}

// 7. Test: removeMigratedItem clears both keys
function testRemoveMigratedItem() {
  console.log('\nTest 7: removeMigratedItem removes both new and old keys');
  mockLocal.clear();
  mockLocal.setItem('activa_test_key', '1');
  mockLocal.setItem('aktiva_test_key', '1');

  removeMigratedItem('activa_test_key', 'aktiva_test_key');
  assert.strictEqual(mockLocal.getItem('activa_test_key'), null);
  assert.strictEqual(mockLocal.getItem('aktiva_test_key'), null);
  console.log('  ✅ Test 7 passed');
}

// Run tests
try {
  testOnlyOldKeyPresent();
  testBothKeysPresent();
  testInvalidLegacyValue();
  testMultipleRunMigration();
  testRestrictedStorage();
  testServiceWorkerCacheCleanup();
  testRemoveMigratedItem();
  console.log('\n🎉 ALL STORAGE & MIGRATION TESTS PASSED SUCCESSFULLY! 🎉\n');
} catch (err) {
  console.error('❌ STORAGE MIGRATION TEST FAILED:', err);
  process.exit(1);
}
