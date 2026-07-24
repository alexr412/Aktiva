import * as admin from 'firebase-admin';

async function populate() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();

  // Create user1 with both legacy fields
  await db.collection('users').doc('user_legacy_both').set({
    displayName: 'Legacy User Both',
    lastLocation: { lat: 53.54, lng: 8.58 },
    proximitySettings: { radiusKm: 10, enabled: true },
    friends: ['user2'],
  });

  // Create user2 with only proximitySettings
  await db.collection('users').doc('user_legacy_settings').set({
    displayName: 'Legacy User Settings Only',
    proximitySettings: { radiusKm: 5, enabled: false },
  });

  // Create user3 with no legacy fields
  await db.collection('users').doc('user_clean').set({
    displayName: 'Clean User',
    friends: ['user_legacy_both'],
  });

  console.log('✅ Mock legacy users populated successfully!');
}

populate().catch(err => {
  console.error('Failed to populate mock users:', err);
  process.exit(1);
});
