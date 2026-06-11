import * as admin from '../functions/node_modules/firebase-admin';

// Configure admin SDK to connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
process.env.GCLOUD_PROJECT = 'aktiva-rules-test';

// Initialize firebase admin SDK
admin.initializeApp({
  storageBucket: 'aktiva-rules-test.appspot.com'
});

async function runTests() {
  const { onUserDeleted } = await import('../functions/src/users');
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const userId = 'test_user_id';

  console.log('--- 1. Clearing emulator state ---');
  // Clear Firestore collections
  const collections = ['users', 'places', 'activities', 'chats', 'notifications', 'reviews', 'payoutRequests', 'refunds', 'financial_ledger'];
  for (const colName of collections) {
    const snap = await db.collection(colName).get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  // Clear Storage files
  try {
    const [files] = await bucket.getFiles();
    for (const file of files) {
      await file.delete();
    }
    console.log('Storage cleared.');
  } catch (err) {
    console.log('Storage clear failed (might be empty):', err);
  }

  console.log('\n--- 2. Seeding database & storage ---');
  
  // 2.1 Seed user profile
  await db.collection('users').doc(userId).set({
    uid: userId,
    displayName: 'Test User',
    username: 'test_user_un',
    friends: ['friend_1'],
    friendRequestsSent: ['friend_2'],
    friendRequestsReceived: ['friend_3'],
    fcmToken: 'test_fcm_token',
    notificationSettings: {
      friendRequests: true,
      activityInvites: true,
      chatMessages: true,
      localHighlights: false,
      nearbyFriendActivityNotifications: true
    },
    proximitySettings: {
      enabled: true,
      radiusKm: 15
    }
  });

  // Seed other users to test array updates
  await db.collection('users').doc('friend_1').set({
    uid: 'friend_1',
    displayName: 'Friend One',
    friends: [userId, 'some_other_friend']
  });
  await db.collection('users').doc('friend_2').set({
    uid: 'friend_2',
    displayName: 'Friend Two',
    friendRequestsReceived: [userId]
  });
  await db.collection('users').doc('friend_3').set({
    uid: 'friend_3',
    displayName: 'Friend Three',
    friendRequestsSent: [userId]
  });

  // 2.2 Seed hosted activity (should be cancelled & anonymized)
  const actHostedRef = db.collection('activities').doc('activity_hosted');
  await actHostedRef.set({
    id: 'activity_hosted',
    title: 'Test Hosted Activity',
    hostId: userId,
    hostName: 'Test User',
    hostPhotoURL: 'https://avatar.url/avatar.jpg',
    status: 'active',
    participantIds: ['friend_1']
  });

  // 2.3 Seed participant activity (should remove user)
  const actPartRef = db.collection('activities').doc('activity_participant');
  await actPartRef.set({
    id: 'activity_participant',
    title: 'Friend Activity',
    hostId: 'friend_1',
    participantIds: [userId, 'friend_2'],
    participantsPreview: [
      { uid: userId, displayName: 'Test User' },
      { uid: 'friend_2', displayName: 'Friend Two' }
    ],
    participantDetails: {
      [userId]: { displayName: 'Test User', hasPaid: true },
      friend_2: { displayName: 'Friend Two', hasPaid: false }
    }
  });
  // subcollection participant doc
  await actPartRef.collection('participants').doc(userId).set({
    uid: userId,
    joinedAt: new Date()
  });
  await actPartRef.collection('participants').doc('friend_2').set({
    uid: 'friend_2',
    joinedAt: new Date()
  });

  // 2.4 Seed chat (should remove user, clean up participantDetails & unreadCount)
  await db.collection('chats').doc('chat_1').set({
    id: 'chat_1',
    participants: [userId, 'friend_1'],
    participantIds: [userId, 'friend_1'],
    participantDetails: {
      [userId]: { displayName: 'Test User' },
      friend_1: { displayName: 'Friend One' }
    },
    unreadCount: {
      [userId]: 5,
      friend_1: 2
    }
  });

  // 2.5 Seed notifications
  await db.collection('notifications').doc('notif_rec').set({
    id: 'notif_rec',
    recipientId: userId,
    senderId: 'friend_1',
    type: 'friend_request'
  });
  await db.collection('notifications').doc('notif_sent').set({
    id: 'notif_sent',
    recipientId: 'friend_1',
    senderId: userId,
    type: 'join_request'
  });

  // 2.6 Seed reviews
  await db.collection('reviews').doc('review_1').set({
    id: 'review_1',
    authorId: userId,
    rating: 5,
    text: 'Great!'
  });

  // 2.7 Seed central/retention collections
  await db.collection('payoutRequests').doc('payout_1').set({
    id: 'payout_1',
    userId: userId,
    amount: 150.00,
    status: 'completed'
  });
  await db.collection('refunds').doc('refund_1').set({
    id: 'refund_1',
    userId: userId,
    amount: 12.50
  });
  await db.collection('financial_ledger').doc('ledger_1').set({
    id: 'ledger_1',
    userId: userId,
    action: 'deposit',
    amount: 100
  });

  // 2.8 Seed storage files
  const avatarFile = bucket.file(`users/${userId}/avatar/avatar.jpg`);
  await avatarFile.save('mock avatar jpeg data', { contentType: 'image/jpeg' });
  const kycFile = bucket.file(`kyc/${userId}/identity_document.pdf`);
  await kycFile.save('mock kyc pdf data', { contentType: 'application/pdf' });

  console.log('Seed completed successfully.');

  console.log('\n--- 3. Running onUserDeleted trigger ---');
  await onUserDeleted.run({ uid: userId } as any, {} as any);

  console.log('\n--- 4. Verifying results ---');
  let testsPassed = true;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
    } else {
      console.error(`❌ [FAIL] ${message}`);
      testsPassed = false;
    }
  };

  // 4.1 User doc deleted
  const userDoc = await db.collection('users').doc(userId).get();
  assert(!userDoc.exists, 'User profile document is deleted.');

  // 4.2 Friends updated
  const f1Doc = await db.collection('users').doc('friend_1').get();
  assert(!f1Doc.data()?.friends.includes(userId), "User is removed from Friend One's friends array.");
  assert(f1Doc.data()?.friends.includes('some_other_friend'), "Friend One's other friends are preserved.");

  const f2Doc = await db.collection('users').doc('friend_2').get();
  assert(!f2Doc.data()?.friendRequestsReceived.includes(userId), "User is removed from Friend Two's friendRequestsReceived.");

  const f3Doc = await db.collection('users').doc('friend_3').get();
  assert(!f3Doc.data()?.friendRequestsSent.includes(userId), "User is removed from Friend Three's friendRequestsSent.");

  // 4.3 Hosted activity cancelled & anonymized
  const actHostedDoc = await db.collection('activities').doc('activity_hosted').get();
  assert(actHostedDoc.exists, 'Hosted activity remains in database.');
  assert(actHostedDoc.data()?.status === 'cancelled', 'Hosted activity status is set to cancelled.');
  assert(actHostedDoc.data()?.hostName === 'Gelöschter Nutzer', 'Hosted activity hostName is anonymized.');
  assert(actHostedDoc.data()?.hostPhotoURL === null, 'Hosted activity hostPhotoURL is set to null.');

  // 4.4 Participant activity updated
  const actPartDoc = await db.collection('activities').doc('activity_participant').get();
  assert(actPartDoc.exists, 'Participant activity remains in database.');
  assert(!actPartDoc.data()?.participantIds.includes(userId), 'User ID removed from activity participantIds.');
  assert(actPartDoc.data()?.participantIds.includes('friend_2'), "Other activity participants are preserved.");
  
  const preview = actPartDoc.data()?.participantsPreview || [];
  assert(!preview.some((p: any) => p.uid === userId), 'User removed from participantsPreview.');
  assert(preview.some((p: any) => p.uid === 'friend_2'), 'Other participants remain in participantsPreview.');

  const details = actPartDoc.data()?.participantDetails || {};
  assert(details[userId] === undefined, 'User removed from participantDetails map.');
  assert(details['friend_2'] !== undefined, 'Other participant details remain in map.');

  // Subcollection participant doc
  const partSubDoc = await db.collection('activities').doc('activity_participant').collection('participants').doc(userId).get();
  assert(!partSubDoc.exists, 'User subcollection participant document is deleted.');
  const otherPartSubDoc = await db.collection('activities').doc('activity_participant').collection('participants').doc('friend_2').get();
  assert(otherPartSubDoc.exists, 'Other user subcollection participant document is preserved.');

  // 4.5 Chat updated
  const chatDoc = await db.collection('chats').doc('chat_1').get();
  assert(chatDoc.exists, 'Chat document remains in database.');
  assert(!chatDoc.data()?.participants.includes(userId), 'User ID removed from chats participants.');
  assert(!chatDoc.data()?.participantIds.includes(userId), 'User ID removed from chats participantIds.');
  assert(chatDoc.data()?.participantDetails[userId] === undefined, 'User details removed from chat participantDetails.');
  assert(chatDoc.data()?.unreadCount[userId] === undefined, 'User unreadCount removed from chat unreadCount.');
  assert(chatDoc.data()?.participantDetails['friend_1'] !== undefined, 'Other chat participant details remain.');

  // 4.6 Notifications deleted
  const n1 = await db.collection('notifications').doc('notif_rec').get();
  assert(!n1.exists, 'Received notification is deleted.');
  const n2 = await db.collection('notifications').doc('notif_sent').get();
  assert(!n2.exists, 'Sent notification is deleted.');

  // 4.7 Reviews deleted
  const rev = await db.collection('reviews').doc('review_1').get();
  assert(!rev.exists, 'Review is deleted.');

  // 4.8 KYC/Finance retained
  const payout = await db.collection('payoutRequests').doc('payout_1').get();
  assert(payout.exists, 'Payout records are retained.');
  const refund = await db.collection('refunds').doc('refund_1').get();
  assert(refund.exists, 'Refund records are retained.');
  const ledger = await db.collection('financial_ledger').doc('ledger_1').get();
  assert(ledger.exists, 'Financial ledger records are retained.');

  // 4.9 Storage files cleaned up / retained
  const [avatarExists] = await avatarFile.exists();
  assert(!avatarExists, 'Avatar storage files are deleted.');
  
  const [kycExists] = await kycFile.exists();
  assert(kycExists, 'KYC storage documents are retained.');

  console.log('\n--- Test Result Summary ---');
  if (testsPassed) {
    console.log('✅ ALL INTEGRATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME INTEGRATION TESTS FAILED!');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled execution error:', err);
  process.exit(1);
});
