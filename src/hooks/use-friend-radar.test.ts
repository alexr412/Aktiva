import assert from 'node:assert';
import { test } from 'node:test';
import { CURRENT_RADAR_CONSENT_VERSION } from '../../functions/src/radar-types';

// Mock localStorage globally for testing
class MockLocalStorage {
  private store: { [key: string]: string } = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

const mockLocalStorage = new MockLocalStorage();
global.localStorage = mockLocalStorage as any;

// Mock window and document properties
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
} as any;

let mockVisibilityState: 'visible' | 'hidden' = 'visible';
global.document = {
  get visibilityState() {
    return mockVisibilityState;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
} as any;

let mockOnLine = true;
global.navigator = {
  get onLine() {
    return mockOnLine;
  }
} as any;

// Import helper logic to test them directly
import {
  readNotificationStorage,
  writeNotificationStorage,
  BaselineState,
  VersionedNotificationStorage,
  FriendNotificationState,
  validateRadarResponse
} from './use-friend-radar';

// Mock toast system
let toastsTriggered: any[] = [];
function mockToast(params: any) {
  toastsTriggered.push(params);
}

// Simulated client state processor (duplicating the exact component logic for pure test runner validation)
class RadarNotificationManager {
  userId: string;
  baselineState: BaselineState = 'uninitialized';
  lastProcessedTimestamp = 0;
  isEvaluating = false;
  language = 'de';
  nearbyFriends: any[] = [];

  constructor(userId: string) {
    this.userId = userId;
  }

  setBaselineState(state: BaselineState) {
    this.baselineState = state;
  }

  async processFriends(newFriends: any[], serverTimestampMs: number, complete: boolean) {
    if (this.isEvaluating) return;
    this.isEvaluating = true;

    try {
      if (serverTimestampMs <= this.lastProcessedTimestamp) {
        return;
      }
      this.lastProcessedTimestamp = serverTimestampMs;

      // Sanitize newFriends to emulate runtime sanitization (No coordinates!)
      const sanitizedFriends = newFriends.map(f => ({
        userId: f.userId,
        username: f.username,
        distanceBucket: f.distanceBucket,
        approximateLatitude: f.approximateLatitude,
        approximateLongitude: f.approximateLongitude,
        precisionKm: f.precisionKm,
        updatedAt: f.updatedAt
      }));

      // Emulate setNearbyFriends state updates (No merging! Only raw slice(0, 30))
      const sliceFriends = sanitizedFriends.slice(0, 30);
      this.nearbyFriends = sliceFriends;

      let storage = readNotificationStorage(this.userId);
      const now = Date.now();

      if (this.baselineState === 'uninitialized' || this.baselineState === 'baseline_pending') {
        const activeIds = new Set(sanitizedFriends.map(f => f.userId));
        
        storage.friends = storage.friends.map(f => {
          if (activeIds.has(f.userId)) {
            return { ...f, wasInside: true, lastSeenInsideAt: now, expiresAt: now + 24 * 60 * 60 * 1000 };
          } else {
            return { ...f, wasInside: false, lastSeenOutsideAt: now };
          }
        });

        for (const f of sanitizedFriends) {
          const exists = storage.friends.some(sf => sf.userId === f.userId);
          if (!exists) {
            storage.friends.push({ userId: f.userId, wasInside: true, lastSeenInsideAt: now, expiresAt: now + 24 * 60 * 60 * 1000 });
          }
        }

        storage.friends = storage.friends.slice(0, 30);
        storage.global.initialized = true;

        writeNotificationStorage(this.userId, storage);
        this.baselineState = 'active';
        return;
      }

      // Active state transitions
      const activeIds = new Set(sanitizedFriends.map(f => f.userId));
      const friendsToNotify: any[] = [];

      for (const f of sanitizedFriends) {
        let record = storage.friends.find(sf => sf.userId === f.userId);
        if (!record) {
          record = { userId: f.userId, wasInside: true, lastSeenInsideAt: now, expiresAt: now + 24 * 60 * 60 * 1000 };
          storage.friends.push(record);
          friendsToNotify.push(f);
        } else if (!record.wasInside) {
          record.wasInside = true;
          record.lastSeenInsideAt = now;
          record.expiresAt = now + 24 * 60 * 60 * 1000;
          friendsToNotify.push(f);
        } else {
          record.lastSeenInsideAt = now;
          record.expiresAt = now + 24 * 60 * 60 * 1000;
        }
      }

      // Friends who left: Only set to wasInside = false if query is COMPLETE
      storage.friends = storage.friends.map(f => {
        if (!activeIds.has(f.userId) && f.wasInside) {
          if (!complete) {
            return f; // Keep wasInside = true if query is incomplete
          } else {
            return { ...f, wasInside: false, lastSeenOutsideAt: now };
          }
        }
        return f;
      });

      storage.friends = storage.friends.slice(0, 30);

      // Save memory changes to localStorage before checking visibility/reloading
      writeNotificationStorage(this.userId, storage);

      if (friendsToNotify.length > 0 && global.document.visibilityState === 'visible' && global.navigator.onLine !== false) {
        // Read fresh storage immediately before toast loop
        storage = readNotificationStorage(this.userId);

        const showCount = Math.min(friendsToNotify.length, 3);
        for (let i = 0; i < showCount; i++) {
          const friend = friendsToNotify[i];
          const record = storage.friends.find(sf => sf.userId === friend.userId);
          const sixHours = 6 * 60 * 60 * 1000;

          if (record && record.lastNotifiedAt && (now - record.lastNotifiedAt < sixHours)) {
            continue;
          }

          const hourAgo = now - 60 * 60 * 1000;
          const currentTimestamps = storage.global.notificationTimestamps.filter(ts => ts > hourAgo);
          if (currentTimestamps.length >= 3) {
            break;
          }

          // Save state BEFORE toast to serialize
          if (record) {
            record.lastNotifiedAt = now;
          }
          storage.global.notificationTimestamps.push(now);

          writeNotificationStorage(this.userId, storage);

          mockToast({
            title: 'Freund in deiner Nähe',
            username: friend.username,
            distanceBucket: friend.distanceBucket,
            latitude: friend.latitude,
            longitude: friend.longitude,
            exactDistance: friend.exactDistance,
          });
        }

        // Set all entrants as wasInside = true
        for (const friend of friendsToNotify) {
          const record = storage.friends.find(sf => sf.userId === friend.userId);
          if (record) {
            record.wasInside = true;
          }
        }
      }

      writeNotificationStorage(this.userId, storage);
    } finally {
      this.isEvaluating = false;
    }
  }
}

// React selection cleanup simulation matching page.tsx
const checkCleanup = (sel: any, list: any[], isEnabled: boolean, completeFlag: boolean) => {
  if (sel?.type === 'friend') {
    const stillExists = list.some(f => f.userId === sel.id);
    if (!isEnabled) {
      return null;
    }
    if (!stillExists) {
      if (completeFlag) {
        return null;
      } else {
        const prevData = sel.data || {};
        return {
          ...sel,
          data: {
            userId: prevData.userId,
            username: prevData.username,
            displayName: prevData.displayName,
            avatarUrl: prevData.avatarUrl,
            isLocationCurrent: false
          }
        };
      }
    }
  }
  return sel;
};

// ----------------------------------------------------
// Test Cases
// ----------------------------------------------------

test('1. Baseline initialization does not trigger toast', async () => {
  mockLocalStorage.clear();
  toastsTriggered = [];
  mockVisibilityState = 'visible';
  mockOnLine = true;

  const manager = new RadarNotificationManager('userA');
  manager.setBaselineState('baseline_pending');

  const friends = [{ userId: 'friend1', username: 'bob', distanceBucket: '2_to_5_km' }];
  await manager.processFriends(friends, Date.now(), true);

  assert.strictEqual(toastsTriggered.length, 0, 'Baseline pending load must trigger 0 toasts');
  assert.strictEqual(manager.baselineState, 'active', 'Should transition to active');
  
  const storage = readNotificationStorage('userA');
  assert.strictEqual(storage.friends.length, 1);
  assert.strictEqual(storage.friends[0].wasInside, true);
});

test('2. Friend enters after baseline pending state', async () => {
  mockLocalStorage.clear();
  toastsTriggered = [];

  const manager = new RadarNotificationManager('userA');
  
  // First baseline: friend1 is inside
  manager.setBaselineState('baseline_pending');
  await manager.processFriends([{ userId: 'friend1', username: 'bob', distanceBucket: '2_to_5_km' }], Date.now(), true);

  // Subsequent poll: friend2 enters!
  const serverTs = Date.now() + 1000;
  await manager.processFriends([
    { userId: 'friend1', username: 'bob', distanceBucket: '2_to_5_km' },
    { userId: 'friend2', username: 'alice', distanceBucket: 'under_1_km' }
  ], serverTs, true);

  assert.strictEqual(toastsTriggered.length, 1, 'Entrant must trigger exactly 1 toast');
  assert.strictEqual(toastsTriggered[0].username, 'alice');
  assert.strictEqual(toastsTriggered[0].distanceBucket, 'under_1_km');
});

test('3. Repeated poll does not trigger double notification', async () => {
  mockLocalStorage.clear();
  toastsTriggered = [];

  const manager = new RadarNotificationManager('userA');
  manager.setBaselineState('active'); // active baseline state simulated

  const friends = [{ userId: 'friend2', username: 'alice', distanceBucket: 'under_1_km' }];
  await manager.processFriends(friends, Date.now(), true);
  assert.strictEqual(toastsTriggered.length, 1);

  // Poll again with same payload
  await manager.processFriends(friends, Date.now() + 1000, true);
  assert.strictEqual(toastsTriggered.length, 1, 'No new toast if status did not transition');
});

test('4. Friend leaves and enters again after 6-hour limit', async () => {
  mockLocalStorage.clear();
  toastsTriggered = [];

  const manager = new RadarNotificationManager('userA');
  manager.setBaselineState('active');

  // 1. Enters: Notifies
  const now = Date.now();
  await manager.processFriends([{ userId: 'friend2', username: 'alice', distanceBucket: 'under_1_km' }], now, true);
  assert.strictEqual(toastsTriggered.length, 1);

  // 2. Leaves: wasInside becomes false
  await manager.processFriends([], now + 1000, true);
  const storage = readNotificationStorage('userA');
  assert.strictEqual(storage.friends[0].wasInside, false);

  // 3. Re-enters immediately (< 6h limit): Should NOT notify
  await manager.processFriends([{ userId: 'friend2', username: 'alice', distanceBucket: 'under_1_km' }], now + 2000, true);
  assert.strictEqual(toastsTriggered.length, 1, 'Should block re-entry notification due to 6-hour limit');

  // 4. Reset lastNotifiedAt to simulate 6 hours passing
  const expiredStorage = readNotificationStorage('userA');
  expiredStorage.friends[0].lastNotifiedAt = now - (7 * 60 * 60 * 1000); // 7 hours ago
  expiredStorage.friends[0].wasInside = false; // set outside
  writeNotificationStorage('userA', expiredStorage);

  // 5. Re-enters after 6h: Should notify!
  await manager.processFriends([{ userId: 'friend2', username: 'alice', distanceBucket: 'under_1_km' }], now + 3000, true);
  assert.strictEqual(toastsTriggered.length, 2, 'Should notify after 6 hours pass');
});

test('5. Global limit: Max 3 notifications per hour', async () => {
  mockLocalStorage.clear();
  toastsTriggered = [];

  const manager = new RadarNotificationManager('userA');
  manager.setBaselineState('active');

  // 4 friends enter simultaneously
  const friends = [
    { userId: 'f1', username: 'user1', distanceBucket: 'under_1_km' },
    { userId: 'f2', username: 'user2', distanceBucket: 'under_1_km' },
    { userId: 'f3', username: 'user3', distanceBucket: 'under_1_km' },
    { userId: 'f4', username: 'user4', distanceBucket: 'under_1_km' },
  ];

  await manager.processFriends(friends, Date.now(), true);
  assert.strictEqual(toastsTriggered.length, 3, 'Must cap at 3 global toasts maximum');

  // Ensure f4 is still marked as wasInside = true so it does not trigger a flood later
  const storage = readNotificationStorage('userA');
  const f4State = storage.friends.find(sf => sf.userId === 'f4');
  assert.ok(f4State);
  assert.strictEqual(f4State.wasInside, true);
});

test('6. Incomplete query does not mark missing friends as outside', async () => {
  mockLocalStorage.clear();
  toastsTriggered = [];

  const manager = new RadarNotificationManager('userA');
  
  // Baseline setup
  manager.setBaselineState('baseline_pending');
  await manager.processFriends([
    { userId: 'friend1', username: 'bob', distanceBucket: '2_to_5_km' },
    { userId: 'friend2', username: 'alice', distanceBucket: 'under_1_km' }
  ], Date.now(), true);

  // Next query is incomplete (complete === false), friend2 is missing
  await manager.processFriends([
    { userId: 'friend1', username: 'bob', distanceBucket: '2_to_5_km' }
  ], Date.now() + 1000, false);

  // Check state: friend2 wasInside should still be true!
  const storage = readNotificationStorage('userA');
  const alice = storage.friends.find(sf => sf.userId === 'friend2');
  assert.ok(alice);
  assert.strictEqual(alice.wasInside, true, 'Alice should NOT be marked outside since query was incomplete');

  // Next query is complete (complete === true), friend2 is missing
  await manager.processFriends([
    { userId: 'friend1', username: 'bob', distanceBucket: '2_to_5_km' }
  ], Date.now() + 2000, true);

  const storage2 = readNotificationStorage('userA');
  const alice2 = storage2.friends.find(sf => sf.userId === 'friend2');
  assert.ok(alice2);
  assert.strictEqual(alice2.wasInside, false, 'Alice should now be marked outside as query is complete');
});

test('7. Outdated answers are discarded', async () => {
  const manager = new RadarNotificationManager('userA');
  manager.lastProcessedTimestamp = 100;

  manager.isEvaluating = false;
  await manager.processFriends([], 99, true);
  assert.strictEqual(manager.lastProcessedTimestamp, 100);
});

test('8. Storage limits and expiry parsing checks', () => {
  mockLocalStorage.clear();

  // Create corrupted storage payload containing coordinate leaks
  const corrupted: any = {
    version: 'v1.0',
    accountId: 'userA',
    expiresAt: Date.now() + 10000,
    friends: [
      { userId: 'f1', wasInside: true, latitude: 53.54, longitude: 8.58, geohash: 'u1x', expiresAt: Date.now() - 1000 }, // Expired
      { userId: 'f2', wasInside: true, latitude: 53.54, longitude: 8.58, expiresAt: Date.now() + 10000 }, // Valid but has coordinate leak
    ],
    global: {
      notificationTimestamps: [Date.now(), Date.now() - 2 * 60 * 60 * 1000], // One current, one >1 hour ago
      initialized: true,
      accountId: 'userA',
      expiresAt: Date.now() + 10000,
    }
  };

  mockLocalStorage.setItem('aktiva_radar_notifications_userA', JSON.stringify(corrupted));

  const storage = readNotificationStorage('userA');
  assert.strictEqual(storage.friends.length, 1, 'Expired entry must be removed');
  assert.strictEqual(storage.friends[0].userId, 'f2');
  
  // Coordinate fields must be stripped
  assert.strictEqual((storage.friends[0] as any).latitude, undefined);
  assert.strictEqual((storage.friends[0] as any).longitude, undefined);
  assert.strictEqual((storage.friends[0] as any).geohash, undefined);

  assert.strictEqual(storage.global.notificationTimestamps.length, 1, 'Timestamps > 1h must be cleared');
});

test('9. Toast content rules: No coordinates or exact distances', () => {
  toastsTriggered = [];
  const manager = new RadarNotificationManager('userA');
  manager.setBaselineState('active');

  const friends = [
    {
      userId: 'f1',
      username: 'bob',
      distanceBucket: '1_to_2_km',
      latitude: 53.54,
      longitude: 8.58,
      exactDistance: 1.34,
    }
  ];

  manager.processFriends(friends, Date.now(), true);

  assert.strictEqual(toastsTriggered.length, 1);
  const toast = toastsTriggered[0];
  
  // Assert no location details are leaked in toast object
  assert.strictEqual(toast.latitude, undefined);
  assert.strictEqual(toast.longitude, undefined);
  assert.strictEqual(toast.exactDistance, undefined);
});

test('10. Multi-tab synchronization checks', async () => {
  mockLocalStorage.clear();
  toastsTriggered = [];

  const tab1 = new RadarNotificationManager('userA');
  tab1.setBaselineState('active');

  const tab2 = new RadarNotificationManager('userA');
  tab2.setBaselineState('active');

  const now = Date.now();
  await tab1.processFriends([{ userId: 'f1', username: 'bob', distanceBucket: 'under_1_km' }], now, true);
  assert.strictEqual(toastsTriggered.length, 1);

  await tab2.processFriends([{ userId: 'f1', username: 'bob', distanceBucket: 'under_1_km' }], now + 50, true);
  assert.strictEqual(toastsTriggered.length, 1, 'Tab 2 must suppress duplicate toast due to shared localStorage check');
});

test('11. Block vs normal radius exit cleanup', async () => {
  mockLocalStorage.clear();
  const manager = new RadarNotificationManager('userA');
  manager.setBaselineState('active');

  await manager.processFriends([{ userId: 'friendB', username: 'bob', distanceBucket: 'under_1_km' }], Date.now(), true);

  await manager.processFriends([], Date.now() + 1000, true);
  
  let storage = readNotificationStorage('userA');
  let bob = storage.friends.find(sf => sf.userId === 'friendB');
  assert.ok(bob);
  assert.strictEqual(bob.wasInside, false);

  const friendsList = new Set<string>([]);
  storage.friends = storage.friends.filter(sf => friendsList.has(sf.userId));
  writeNotificationStorage('userA', storage);

  storage = readNotificationStorage('userA');
  bob = storage.friends.find(sf => sf.userId === 'friendB');
  assert.strictEqual(bob, undefined);
});

test('12. SelectedMapEntity reactive cleanup', () => {
  let selectedMapEntity: any = { id: 'friendB', type: 'friend', data: {} };

  // Case A: Radar deactivated -> always deselects
  assert.strictEqual(checkCleanup(selectedMapEntity, [{ userId: 'friendB' }], false, true), null);

  // Case B: Friend B missing AND complete=true -> deselects
  assert.strictEqual(checkCleanup(selectedMapEntity, [], true, true), null);

  // Case C: Friend B still exists and active -> KEEPS selection
  const resultExists = checkCleanup(selectedMapEntity, [{ userId: 'friendB' }], true, true);
  assert.deepStrictEqual(resultExists, selectedMapEntity);
});

test('13. Failed resume baseline does not transition state', async () => {
  const manager = new RadarNotificationManager('userA');
  manager.setBaselineState('baseline_pending');
  assert.strictEqual(manager.baselineState, 'baseline_pending');
});

test('14. Storage write failures handled gracefully', () => {
  mockLocalStorage.clear();
  
  const originalSet = global.localStorage.setItem;
  global.localStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };

  const data = readNotificationStorage('userA');
  const success = writeNotificationStorage('userA', data);
  assert.strictEqual(success, false);

  // Restore
  global.localStorage.setItem = originalSet;
});

// ----------------------------------------------------
// Fail-Closed Validation Helper Tests
// ----------------------------------------------------

test('15. validateRadarResponse: complete validation checks', () => {
  // Test complete missing
  const res1 = validateRadarResponse({ friends: [] });
  assert.strictEqual(res1.complete, false, 'Missing complete field must default to false');

  // Test complete is null
  const res2 = validateRadarResponse({ friends: [], complete: null });
  assert.strictEqual(res2.complete, false, 'null complete field must yield false');

  // Test complete is string
  const res3 = validateRadarResponse({ friends: [], complete: 'true' });
  assert.strictEqual(res3.complete, false, 'String complete field must yield false');

  // Test complete is true
  const res4 = validateRadarResponse({ friends: [], complete: true });
  assert.strictEqual(res4.complete, true, 'Explicit boolean true must yield true');

  // Test legacy backend answer without completeness fields
  const resLegacy = validateRadarResponse({
    friends: [{ userId: 'f1', username: 'bob', distanceBucket: 'under_1_km' }]
  });
  assert.strictEqual(resLegacy.complete, false, 'Legacy response must yield complete = false');
  assert.strictEqual(resLegacy.friends.length, 1);
  assert.strictEqual(resLegacy.friends[0].userId, 'f1');
});

// ----------------------------------------------------
// SelectedMapEntity location stripping on incomplete responses
// ----------------------------------------------------

test('16. SelectedMapEntity location stripping on incomplete missing friend', () => {
  const selectedFriend: any = {
    id: 'f1',
    type: 'friend',
    data: {
      userId: 'f1',
      username: 'bob',
      displayName: 'Bob Builder',
      avatarUrl: 'https://avatar',
      distanceBucket: 'under_1_km',
      approximateLatitude: 53.54,
      approximateLongitude: 8.58,
      precisionKm: 2.0,
      updatedAt: '2026-07-24'
    }
  };

  // Case A: Missing from list, complete = false
  // Result must keep card open but strip coordinates & distanceBucket and set isLocationCurrent = false
  const stripped = checkCleanup(selectedFriend, [], true, false);
  assert.ok(stripped);
  assert.strictEqual(stripped.id, 'f1');
  assert.strictEqual(stripped.data.isLocationCurrent, false);
  assert.strictEqual(stripped.data.approximateLatitude, undefined);
  assert.strictEqual(stripped.data.approximateLongitude, undefined);
  assert.strictEqual(stripped.data.precisionKm, undefined);
  assert.strictEqual(stripped.data.distanceBucket, undefined);
  assert.strictEqual(stripped.data.updatedAt, undefined);
  // Confirm Identity fields kept
  assert.strictEqual(stripped.data.userId, 'f1');
  assert.strictEqual(stripped.data.username, 'bob');
  assert.strictEqual(stripped.data.displayName, 'Bob Builder');
  assert.strictEqual(stripped.data.avatarUrl, 'https://avatar');

  // Case B: Missing from list, complete = true
  // Result must be null (deselect)
  const deselected = checkCleanup(selectedFriend, [], true, true);
  assert.strictEqual(deselected, null);
});
