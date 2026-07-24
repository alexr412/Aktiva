import assert from 'assert';
import {
  CURRENT_RADAR_CONSENT_VERSION,
  hasRadarAccessPermission,
  calculateHaversineDistanceKm,
  calculateDistanceBucket,
  obfuscateMetricGridLocation,
} from './radar-types';

async function runRadarBackendTests() {
  console.log('🧪 Starting Aktiva Friend Radar Backend Unit Tests...\n');

  // 1. Pure Function: Haversine Distance
  console.log('Test 1: Haversine Distance Calculation');
  const dist = calculateHaversineDistanceKm(53.5442, 8.5802, 53.5542, 8.5902);
  assert.strictEqual(typeof dist, 'number');
  assert.strictEqual(dist > 1.0 && dist < 2.0, true, `Distance should be ~1.28km, got ${dist}`);
  console.log('  ✅ Haversine distance calculation passed');

  // 2. Pure Function: Distance Bucketing
  console.log('\nTest 2: Distance Bucketing Boundaries');
  assert.strictEqual(calculateDistanceBucket(0.5), 'under_1_km');
  assert.strictEqual(calculateDistanceBucket(1.5), '1_to_2_km');
  assert.strictEqual(calculateDistanceBucket(3.5), '2_to_5_km');
  assert.strictEqual(calculateDistanceBucket(7.5), '5_to_10_km');
  assert.strictEqual(calculateDistanceBucket(15.0), '10_to_25_km');
  console.log('  ✅ Distance bucketing boundaries passed');

  // 3. Pure Function: Metric Grid Obfuscation
  console.log('\nTest 3: Metric Grid Obfuscation');
  const obfuscated1 = obfuscateMetricGridLocation(53.5442, 8.5802);
  const obfuscated2 = obfuscateMetricGridLocation(53.5442, 8.5802);
  assert.strictEqual(obfuscated1.approximateLatitude, obfuscated2.approximateLatitude, 'Repeated queries must yield identical lat cell');
  assert.strictEqual(obfuscated1.approximateLongitude, obfuscated2.approximateLongitude, 'Repeated queries must yield identical lon cell');
  assert.strictEqual(obfuscated1.precisionKm, 2.0, 'PrecisionKm must be 2.0');
  assert.notStrictEqual(obfuscated1.approximateLatitude, 53.5442, 'Raw latitude must NOT be returned');
  assert.notStrictEqual(obfuscated1.approximateLongitude, 8.5802, 'Raw longitude must NOT be returned');
  console.log('  ✅ Metric grid obfuscation passed');

  // 4. Pure Function: hasRadarAccessPermission
  console.log('\nTest 4: Radar Access Permission Evaluation');
  const now = new Date();
  const future = new Date(now.getTime() + 1000 * 60 * 60); // +1 hour
  const past = new Date(now.getTime() - 1000 * 60 * 60); // -1 hour

  const freeUser = { uid: 'free_1', isPremium: false };
  assert.strictEqual(hasRadarAccessPermission(freeUser, now), false, 'Free user must be denied');

  const premiumUserActive = { uid: 'prem_1', isPremium: true, premiumExpiresAt: future };
  assert.strictEqual(hasRadarAccessPermission(premiumUserActive, now), true, 'Active premium user must be granted');

  const premiumUserExpired = { uid: 'prem_2', isPremium: true, premiumExpiresAt: past };
  assert.strictEqual(hasRadarAccessPermission(premiumUserExpired, now), false, 'Expired premium user must be denied');

  const organizerUser = { uid: 'org_1', isPremium: false, isOrganizer: true };
  assert.strictEqual(hasRadarAccessPermission(organizerUser, now), true, 'Organizer user must be granted');

  const launchCampaignUser = { uid: 'launch_1', isPremium: true, premiumSource: 'launch_campaign_2026', premiumExpiresAt: future };
  assert.strictEqual(hasRadarAccessPermission(launchCampaignUser, now), true, 'Launch campaign premium user must be granted');
  console.log('  ✅ Radar access permission evaluation passed');

  // 5. Consent Version Constants
  console.log('\nTest 5: Consent Version Constant');
  assert.strictEqual(CURRENT_RADAR_CONSENT_VERSION, 'v1.0');
  console.log('  ✅ Consent version constant verified');

  console.log('\n🎉 ALL RADAR BACKEND UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runRadarBackendTests().catch((err) => {
  console.error('❌ Radar Backend Unit Tests failed:', err);
  process.exit(1);
});
