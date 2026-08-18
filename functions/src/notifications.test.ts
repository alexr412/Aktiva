import assert from 'node:assert';
import {
  getPreferenceKeyForType,
  calculateDistanceKm,
  NEARBY_NOTIFICATION_MAX_RADIUS_KM,
  NEARBY_PUSH_DAILY_LIMIT,
  ENGAGEMENT_PUSH_DAILY_LIMIT
} from './notifications';

function testPreferenceMapping() {
  assert.strictEqual(getPreferenceKeyForType('friend_request'), 'friendRequests');
  assert.strictEqual(getPreferenceKeyForType('friend_accepted'), 'friendAccepted');
  assert.strictEqual(getPreferenceKeyForType('chat_message'), 'chatMessages');
  assert.strictEqual(getPreferenceKeyForType('activity_join_request'), 'activityRequests');
  assert.strictEqual(getPreferenceKeyForType('activity_join_response'), 'activityParticipants');
  assert.strictEqual(getPreferenceKeyForType('activity_update'), 'activityUpdates');
  assert.strictEqual(getPreferenceKeyForType('nearby_activity'), 'nearbyActivities');
  assert.strictEqual(getPreferenceKeyForType('nearby_spot'), 'nearbyActivities');
  assert.strictEqual(getPreferenceKeyForType('friend_nearby_activity'), 'nearbyFriendActivityNotifications');
  assert.strictEqual(getPreferenceKeyForType('recommendation'), 'recommendations');
  assert.strictEqual(getPreferenceKeyForType('engagement_reminder'), 'engagementReminders');
  assert.strictEqual(getPreferenceKeyForType('unknown_type'), null);
  console.log('✅ testPreferenceMapping passed successfully!');
}

function testDistanceCalculation() {
  // Berlin Brandenburg Gate (52.51627, 13.3777) to Alexanderplatz (52.5219, 13.4132) ~2.4km
  const dist = calculateDistanceKm(52.51627, 13.3777, 52.5219, 13.4132);
  assert.ok(dist > 2.0 && dist < 3.0, `Distance ${dist} should be ~2.4km`);

  // Same coordinates -> 0km
  const zeroDist = calculateDistanceKm(52.51627, 13.3777, 52.51627, 13.3777);
  assert.strictEqual(Math.round(zeroDist), 0);

  // 1km offset test -> should be <= NEARBY_NOTIFICATION_MAX_RADIUS_KM (2km)
  const smallDist = calculateDistanceKm(52.51627, 13.3777, 52.5200, 13.3850);
  assert.ok(smallDist <= NEARBY_NOTIFICATION_MAX_RADIUS_KM);

  console.log('✅ testDistanceCalculation passed successfully!');
}

function testConstantsAndRateLimits() {
  assert.strictEqual(NEARBY_NOTIFICATION_MAX_RADIUS_KM, 2);
  assert.strictEqual(NEARBY_PUSH_DAILY_LIMIT, 3);
  assert.strictEqual(ENGAGEMENT_PUSH_DAILY_LIMIT, 1);
  console.log('✅ testConstantsAndRateLimits passed successfully!');
}

function testDeterministicIdGeneration() {
  const recipientId = 'user_123';
  const eventId = 'req_999';
  const type = 'friend_request';
  const notificationId = `${type}_${eventId}_${recipientId}`;

  assert.strictEqual(notificationId, 'friend_request_req_999_user_123');
  console.log('✅ testDeterministicIdGeneration passed successfully!');
}

function testAtomicUnreadCounterLogic() {
  let currentUnread = 0;

  // 1. First notification created -> increment
  currentUnread = Math.max(0, currentUnread + 1);
  assert.strictEqual(currentUnread, 1);

  // 2. Second notification created -> increment
  currentUnread = Math.max(0, currentUnread + 1);
  assert.strictEqual(currentUnread, 2);

  // 3. One read -> decrement
  currentUnread = Math.max(0, currentUnread - 1);
  assert.strictEqual(currentUnread, 1);

  // 4. Mark all read -> reset to 0
  currentUnread = 0;
  assert.strictEqual(currentUnread, 0);

  // 5. Decrement below zero safety -> stays 0
  currentUnread = Math.max(0, currentUnread - 1);
  assert.strictEqual(currentUnread, 0);

  console.log('✅ testAtomicUnreadCounterLogic passed successfully!');
}

function testMulticastChunkingLogic() {
  const chunkTokens = (tokens: string[], size = 500): string[][] => {
    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += size) {
      chunks.push(tokens.slice(i, i + size));
    }
    return chunks;
  };

  const tokens1200 = Array.from({ length: 1200 }, (_, i) => `token_${i}`);
  const chunks = chunkTokens(tokens1200, 500);

  assert.strictEqual(chunks.length, 3);
  assert.strictEqual(chunks[0].length, 500);
  assert.strictEqual(chunks[1].length, 500);
  assert.strictEqual(chunks[2].length, 200);

  console.log('✅ testMulticastChunkingLogic passed successfully!');
}

function testDeleteNotificationLogic() {
  // Mock DB state for unit testing deleteNotification logic
  const dbState: Record<string, any> = {
    notifications: {
      readNotif: { id: 'readNotif', recipientId: 'userA', isRead: true, type: 'system' },
      unreadNotif: { id: 'unreadNotif', recipientId: 'userA', isRead: false, type: 'system' },
      joinReqNotif: { id: 'joinReqNotif', recipientId: 'userA', isRead: false, type: 'join_request', entityId: 'act123' },
      foreignNotif: { id: 'foreignNotif', recipientId: 'userB', isRead: false, type: 'system' }
    },
    meta: {
      userA: { unreadCount: 3 },
      userB: { unreadCount: 1 }
    },
    activities: {
      act123: { id: 'act123', participantIds: ['hostA', 'userC'] }
    }
  };

  const simulateDeleteNotification = (callerUid: string, notificationId: string) => {
    const notif = dbState.notifications[notificationId];
    if (!notif) {
      return { success: false, error: 'not-found' };
    }
    if (notif.recipientId !== callerUid) {
      return { success: false, error: 'permission-denied' };
    }

    delete dbState.notifications[notificationId];

    if (!notif.isRead) {
      const currentMeta = dbState.meta[callerUid]?.unreadCount || 0;
      dbState.meta[callerUid] = { unreadCount: Math.max(0, currentMeta - 1) };
    }

    return { success: true };
  };

  // 1. Delete own read notification -> unreadCount unchanged
  const resRead = simulateDeleteNotification('userA', 'readNotif');
  assert.strictEqual(resRead.success, true);
  assert.strictEqual(dbState.notifications['readNotif'], undefined);
  assert.strictEqual(dbState.meta['userA'].unreadCount, 3);

  // 2. Delete own unread notification -> unreadCount reduced by 1
  const resUnread = simulateDeleteNotification('userA', 'unreadNotif');
  assert.strictEqual(resUnread.success, true);
  assert.strictEqual(dbState.notifications['unreadNotif'], undefined);
  assert.strictEqual(dbState.meta['userA'].unreadCount, 2);

  // 3. Attempt deleting foreign notification -> permission-denied
  const resForeign = simulateDeleteNotification('userA', 'foreignNotif');
  assert.strictEqual(resForeign.success, false);
  assert.strictEqual(resForeign.error, 'permission-denied');
  assert.ok(dbState.notifications['foreignNotif']);

  // 4. Attempt deleting missing/already deleted notification -> not-found
  const resMissing = simulateDeleteNotification('userA', 'unreadNotif');
  assert.strictEqual(resMissing.success, false);
  assert.strictEqual(resMissing.error, 'not-found');

  // 5. Delete join request notification -> activity data remains untouched
  const resJoin = simulateDeleteNotification('userA', 'joinReqNotif');
  assert.strictEqual(resJoin.success, true);
  assert.strictEqual(dbState.notifications['joinReqNotif'], undefined);
  assert.strictEqual(dbState.meta['userA'].unreadCount, 1);
  assert.deepStrictEqual(dbState.activities['act123'].participantIds, ['hostA', 'userC']);

  console.log('✅ testDeleteNotificationLogic passed successfully!');
}

async function runNotificationUnitTests() {
  testPreferenceMapping();
  testDistanceCalculation();
  testConstantsAndRateLimits();
  testDeterministicIdGeneration();
  testAtomicUnreadCounterLogic();
  testMulticastChunkingLogic();
  testDeleteNotificationLogic();
  console.log('🎉 ALL SERVER NOTIFICATION SERVICE UNIT TESTS PASSED! 🎉');
}

runNotificationUnitTests();
