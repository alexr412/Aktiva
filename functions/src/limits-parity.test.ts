import * as assert from 'assert';
import * as serverLimits from './limits-policy';
import * as frontendLimits from '../../src/lib/types';

console.log('Running limits-parity.test.ts...');

const testProfiles: (frontendLimits.UserProfile | null)[] = [
  null,
  { uid: 'free', onboardingCompleted: true } as any,
  { uid: 'tier1', isPremium: true, premiumTier: 'tier1', premiumExpiresAt: new Date(Date.now() + 3600000) } as any,
  { uid: 'tier2', isPremium: true, premiumTier: 'tier2', premiumExpiresAt: new Date(Date.now() + 3600000) } as any,
  { uid: 'tier3', isPremium: true, premiumTier: 'tier3', premiumExpiresAt: new Date(Date.now() + 3600000) } as any,
  { uid: 'org', isOrganizer: true } as any,
  { uid: 'legacy_premium', isPremium: true } as any,
  { uid: 'expired_premium', isPremium: true, premiumTier: 'tier1', premiumExpiresAt: new Date(Date.now() - 3600000) } as any,
  { uid: 'invalid_date', isPremium: true, premiumExpiresAt: 'not_a_valid_date' } as any,
  { uid: 'is_prem_false_tier1', isPremium: false, premiumTier: 'tier1' } as any,
  { uid: 'is_prem_false_tier2', isPremium: false, premiumTier: 'tier2' } as any,
  { uid: 'is_prem_false_tier3', isPremium: false, premiumTier: 'tier3' } as any,
  { uid: 'premium_until_alias', isPremium: true, premiumTier: 'tier2', premiumUntil: new Date(Date.now() + 3600000) } as any,
];

const nowMs = Date.now();

for (const profile of testProfiles) {
  const serverMaxRooms = serverLimits.getMaxOpenRoomsLimit(profile as any, nowMs);
  const frontendMaxRooms = frontendLimits.getMaxOpenRoomsLimit(profile, nowMs);
  assert.strictEqual(
    serverMaxRooms,
    frontendMaxRooms,
    `getMaxOpenRoomsLimit mismatch for profile ${JSON.stringify(profile)}: server=${serverMaxRooms}, frontend=${frontendMaxRooms}`
  );

  const serverPartLimit = serverLimits.getParticipantLimit(profile as any, nowMs);
  const frontendPartLimit = frontendLimits.getParticipantLimit(profile, nowMs);
  assert.strictEqual(
    serverPartLimit,
    frontendPartLimit,
    `getParticipantLimit mismatch for profile ${JSON.stringify(profile)}: server=${serverPartLimit}, frontend=${frontendPartLimit}`
  );

  const serverPrem = serverLimits.isPremiumActive(profile as any, nowMs);
  const frontendPrem = frontendLimits.isPremiumActive(profile, nowMs);
  assert.strictEqual(
    serverPrem,
    frontendPrem,
    `isPremiumActive mismatch for profile ${JSON.stringify(profile)}: server=${serverPrem}, frontend=${frontendPrem}`
  );

  const serverRadar = serverLimits.getRadarRadiusLimit(profile as any, nowMs);
  const frontendRadar = frontendLimits.getRadarRadiusLimit(profile, nowMs);
  assert.strictEqual(
    serverRadar,
    frontendRadar,
    `getRadarRadiusLimit mismatch for profile ${JSON.stringify(profile)}: server=${serverRadar}, frontend=${frontendRadar}`
  );
}

console.log('✅ limits-parity.test.ts PASSED! Server policy and frontend types are in 100% parity.');
