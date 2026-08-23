import { isPremiumActive, getParticipantLimit, getMaxOpenRoomsLimit, formatPremiumExpiry, parseTimestampMillis, UserProfile } from './types';

function runTests() {
  console.log('--- RUNNING PREMIUM SYSTEM UNIT TESTS ---');

  // Test 1: Null profile
  console.assert(isPremiumActive(null) === false, 'Null profile active test');
  console.assert(getParticipantLimit(null) === 4, 'Null profile limit test');
  console.assert(getMaxOpenRoomsLimit(null) === 5, 'Null profile max open rooms limit test');

  // Test 2: Free user
  const freeProfile = { uid: 'u1', email: 'a@b.de', isPremium: false } as unknown as UserProfile;
  console.assert(isPremiumActive(freeProfile) === false, 'Free user active test');
  console.assert(getParticipantLimit(freeProfile) === 4, 'Free user limit test');
  console.assert(getMaxOpenRoomsLimit(freeProfile) === 5, 'Free user max open rooms limit test');

  // Test 3: Legacy permanent premium (isPremium: true, no expiresAt)
  const legacyProfile = { uid: 'u2', email: 'b@b.de', isPremium: true } as unknown as UserProfile;
  console.assert(isPremiumActive(legacyProfile) === true, 'Legacy profile active test');
  console.assert(getParticipantLimit(legacyProfile) === 8, 'Legacy profile limit test');
  console.assert(getMaxOpenRoomsLimit(legacyProfile) === 10, 'Legacy profile max open rooms limit test');

  // Test 4: Tier 1 active premium
  const tier1Profile = { uid: 'u3_1', email: 'c1@b.de', isPremium: true, premiumTier: 'tier1' } as unknown as UserProfile;
  console.assert(getMaxOpenRoomsLimit(tier1Profile) === 10, 'Tier 1 max open rooms limit test');

  // Test 5: Tier 2 active premium
  const tier2Profile = { uid: 'u3_2', email: 'c2@b.de', isPremium: true, premiumTier: 'tier2' } as unknown as UserProfile;
  console.assert(getMaxOpenRoomsLimit(tier2Profile) === 25, 'Tier 2 max open rooms limit test');

  // Test 6: Temporary active premium (expires in future)
  const futureMs = Date.now() + 100000;
  const activeTempProfile = {
    uid: 'u3',
    email: 'c@b.de',
    isPremium: true,
    premiumExpiresAt: { toMillis: () => futureMs } as any,
  } as unknown as UserProfile;
  console.assert(isPremiumActive(activeTempProfile) === true, 'Active temp profile test');
  console.assert(getParticipantLimit(activeTempProfile) === 8, 'Active temp limit test');

  // Test 7: Expired temporary premium
  const pastMs = Date.now() - 1000;
  const expiredTempProfile = {
    uid: 'u4',
    email: 'd@b.de',
    isPremium: true,
    premiumExpiresAt: { toMillis: () => pastMs } as any,
  } as unknown as UserProfile;
  console.assert(isPremiumActive(expiredTempProfile) === false, 'Expired temp profile test');
  console.assert(getParticipantLimit(expiredTempProfile) === 4, 'Expired temp limit test');
  console.assert(getMaxOpenRoomsLimit(expiredTempProfile) === 5, 'Expired temp max open rooms limit test');

  // Test 8: Organizer hierarchy (Organizer = 50 regardless of isPremium)
  const orgProfile = { uid: 'u5', email: 'e@b.de', isOrganizer: true, isPremium: false } as unknown as UserProfile;
  console.assert(getParticipantLimit(orgProfile) === 50, 'Organizer limit test');
  console.assert(getMaxOpenRoomsLimit(orgProfile) === 50, 'Organizer max open rooms limit test');

  // Test 9: Timestamp formats (ISO string, number, seconds object)
  const isoStr = '2026-10-31T22:59:59.999Z';
  console.assert(parseTimestampMillis(isoStr) === Date.parse(isoStr), 'ISO string parse test');
  console.assert(parseTimestampMillis({ seconds: 1000, nanoseconds: 0 }) === 1000000, 'Seconds obj parse test');

  // Test 10: formatPremiumExpiry
  const formattedDe = formatPremiumExpiry({
    uid: 'u6',
    isPremium: true,
    premiumExpiresAt: { toMillis: () => Date.parse('2026-08-14T12:00:00Z') } as any,
  } as unknown as UserProfile, 'de');
  console.assert(formattedDe === '14.08.2026', `Format DE test: ${formattedDe}`);

  console.log('✅ ALL PREMIUM UNIT TESTS PASSED!');
}

runTests();

