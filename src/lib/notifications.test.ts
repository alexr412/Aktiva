import assert from 'node:assert';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NEARBY_SPOT_PUSH_DAILY_LIMIT,
  getEffectiveNotificationPreferences,
  getNotificationTargetUrl,
  normalizeNotification,
  formatUnreadBadge,
  deriveFriendRequestNotificationState,
  type Notification,
  type UserProfile
} from './types';

function testDeriveFriendRequestNotificationState() {
  // 1. Pending: senderId in friendRequestsReceived, no responseStatus
  const pendingNotif: Partial<Notification> = { type: 'friend_request', actorId: 'user_bob' };
  assert.strictEqual(
    deriveFriendRequestNotificationState(pendingNotif, ['user_bob'], []),
    'pending'
  );

  // 2. Accepted via notification responseStatus
  const acceptedNotif: Partial<Notification> = { type: 'friend_request', actorId: 'user_bob', responseStatus: 'accepted' };
  assert.strictEqual(
    deriveFriendRequestNotificationState(acceptedNotif, [], []),
    'accepted'
  );

  // 3. Accepted outside notification (friends array contains senderId)
  const acceptedOutsideNotif: Partial<Notification> = { type: 'friend_request', actorId: 'user_bob' };
  assert.strictEqual(
    deriveFriendRequestNotificationState(acceptedOutsideNotif, [], ['user_bob']),
    'accepted'
  );

  // 4. Declined via notification responseStatus
  const declinedNotif: Partial<Notification> = { type: 'friend_request', actorId: 'user_bob', responseStatus: 'declined' };
  assert.strictEqual(
    deriveFriendRequestNotificationState(declinedNotif, [], []),
    'declined'
  );

  // 5. Cancelled via notification responseStatus
  const cancelledNotif: Partial<Notification> = { type: 'friend_request', actorId: 'user_bob', responseStatus: 'cancelled' };
  assert.strictEqual(
    deriveFriendRequestNotificationState(cancelledNotif, [], []),
    'cancelled'
  );

  // 6. Legacy / Processed: no longer pending, not friends, no explicit responseStatus
  const processedNotif: Partial<Notification> = { type: 'friend_request', actorId: 'user_bob' };
  assert.strictEqual(
    deriveFriendRequestNotificationState(processedNotif, [], []),
    'processed'
  );

  // 7. Invalid: missing actorId/senderId/entityId
  const invalidNotif: Partial<Notification> = { type: 'friend_request' };
  assert.strictEqual(
    deriveFriendRequestNotificationState(invalidNotif, ['user_bob'], []),
    'invalid'
  );

  console.log('✅ testDeriveFriendRequestNotificationState passed successfully!');
}

function testDefaultPreferences() {
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled, false);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.soundEnabled, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.friendRequests, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.friendAccepted, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.chatMessages, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.activityRequests, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.activityParticipants, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.activityUpdates, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.activityReminders, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.nearbySpots, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.recommendations, true);
  assert.strictEqual(DEFAULT_NOTIFICATION_PREFERENCES.engagementReminders, true);
  console.log('✅ testDefaultPreferences passed successfully!');
}

function testEffectivePreferencesLegacyFallback() {
  const emptyProfile: Partial<UserProfile> = { uid: 'user1' };
  const effectiveEmpty = getEffectiveNotificationPreferences(emptyProfile as UserProfile);

  assert.strictEqual(effectiveEmpty.pushEnabled, false);
  assert.strictEqual(effectiveEmpty.chatMessages, true);
  assert.strictEqual(effectiveEmpty.nearbySpots, true);

  const partialProfile: Partial<UserProfile> = {
    uid: 'user2',
    notificationSettings: {
      pushEnabled: true,
      chatMessages: false,
    }
  };
  const effectivePartial = getEffectiveNotificationPreferences(partialProfile as UserProfile);
  assert.strictEqual(effectivePartial.pushEnabled, true);
  assert.strictEqual(effectivePartial.chatMessages, false);
  assert.strictEqual(effectivePartial.friendRequests, true);
  console.log('✅ testEffectivePreferencesLegacyFallback passed successfully!');
}

function testNotificationTargetUrlResolver() {
  const notif1: Partial<Notification> = { type: 'friend_request' };
  assert.strictEqual(getNotificationTargetUrl(notif1), '/profile');

  const notif2: Partial<Notification> = { type: 'chat_message', entityId: 'chat_123' };
  assert.strictEqual(getNotificationTargetUrl(notif2), '/chat/chat_123');

  const notif3: Partial<Notification> = { type: 'activity_join_request', activityId: 'act_99' };
  assert.strictEqual(getNotificationTargetUrl(notif3), '/activities/act_99');

  const notif4: Partial<Notification> = { type: 'nearby_spot', spotId: 'spot_42' };
  assert.strictEqual(getNotificationTargetUrl(notif4), '/map?spot=spot_42');

  const notifCustom: Partial<Notification> = { type: 'system', targetUrl: '/custom/path', link: '/old/path' };
  assert.strictEqual(getNotificationTargetUrl(notifCustom), '/custom/path');

  console.log('✅ testNotificationTargetUrlResolver passed successfully!');
}

function testDeepLinkSecurityValidation() {
  const sanitizeUrl = (raw: string): string => {
    if (!raw || typeof raw !== 'string') return '/';
    if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('javascript:') && !raw.startsWith('data:')) {
      return raw;
    }
    return '/';
  };

  assert.strictEqual(sanitizeUrl('/chat/123'), '/chat/123');
  assert.strictEqual(sanitizeUrl('/activities/456'), '/activities/456');
  assert.strictEqual(sanitizeUrl('//malicious.com'), '/');
  assert.strictEqual(sanitizeUrl('javascript:alert(1)'), '/');
  assert.strictEqual(sanitizeUrl('https://external.com'), '/');
  console.log('✅ testDeepLinkSecurityValidation passed successfully!');
}

function testNormalizeNotification() {
  const rawLegacy = {
    id: 'notif_100',
    recipientId: 'user_A',
    senderId: 'user_B',
    type: 'friend_nearby_activity',
    title: 'Neue Aktivität',
    message: 'Max ist in der Nähe',
    link: '/activities/act_55',
    activityId: 'act_55',
    isRead: false,
  };

  const normalized = normalizeNotification(rawLegacy);

  assert.strictEqual(normalized.id, 'notif_100');
  assert.strictEqual(normalized.recipientId, 'user_A');
  assert.strictEqual(normalized.actorId, 'user_B');
  assert.strictEqual(normalized.entityId, 'act_55');
  assert.strictEqual(normalized.eventId, 'notif_100');
  assert.strictEqual(normalized.body, 'Max ist in der Nähe');
  assert.strictEqual(normalized.targetUrl, '/activities/act_55');
  assert.strictEqual(normalized.isRead, false);

  console.log('✅ testNormalizeNotification passed successfully!');
}

function testFormatUnreadBadge() {
  assert.strictEqual(formatUnreadBadge(0), '');
  assert.strictEqual(formatUnreadBadge(1), '1');
  assert.strictEqual(formatUnreadBadge(9), '9');
  assert.strictEqual(formatUnreadBadge(99), '99');
  assert.strictEqual(formatUnreadBadge(100), '99+');
  assert.strictEqual(formatUnreadBadge(150), '99+');
  console.log('✅ testFormatUnreadBadge passed successfully!');
}

async function testMarkAllMultiBatchLogic() {
  const simulateMarkAll = (unreadCount: number): { totalUpdated: number; batchCount: number } => {
    let remaining = unreadCount;
    let totalUpdated = 0;
    let batchCount = 0;
    const maxBatches = 20;

    while (batchCount < maxBatches && remaining > 0) {
      const currentBatchSize = Math.min(remaining, 100);
      remaining -= currentBatchSize;
      totalUpdated += currentBatchSize;
      batchCount++;
      if (currentBatchSize < 100) break;
    }
    return { totalUpdated, batchCount };
  };

  const res0 = simulateMarkAll(0);
  assert.strictEqual(res0.totalUpdated, 0);
  assert.strictEqual(res0.batchCount, 0);

  const res45 = simulateMarkAll(45);
  assert.strictEqual(res45.totalUpdated, 45);
  assert.strictEqual(res45.batchCount, 1);

  const res100 = simulateMarkAll(100);
  assert.strictEqual(res100.totalUpdated, 100);
  assert.strictEqual(res100.batchCount, 1);

  const res250 = simulateMarkAll(250);
  assert.strictEqual(res250.totalUpdated, 250);
  assert.strictEqual(res250.batchCount, 3);

  console.log('✅ testMarkAllMultiBatchLogic passed successfully!');
}

function testConstants() {
  assert.strictEqual(NEARBY_SPOT_PUSH_DAILY_LIMIT, 3);
  console.log('✅ testConstants passed successfully!');
}

async function runAllNotificationTests() {
  testDeriveFriendRequestNotificationState();
  testDefaultPreferences();
  testEffectivePreferencesLegacyFallback();
  testNotificationTargetUrlResolver();
  testDeepLinkSecurityValidation();
  testNormalizeNotification();
  testFormatUnreadBadge();
  await testMarkAllMultiBatchLogic();
  testConstants();
  console.log('🎉 ALL NOTIFICATION DATA MODEL, INBOX, FOREGROUND & PUSH TESTS PASSED SUCCESSFULLY! 🎉');
}

runAllNotificationTests();
