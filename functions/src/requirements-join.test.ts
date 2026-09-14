import * as assert from 'assert';
import { validateActivityEligibility, checkUserEligibilityForActivityCreation } from './activities';

console.log('Running requirements-join.test.ts...');

// 1. Eligibility failure prior to payment
const userUnderage = {
  uid: 'user1',
  accountStatus: 'active',
  isBanned: false,
  age: 16,
};

const activityWithAgeLimit = {
  hostId: 'host1',
  participantIds: [],
  maxParticipants: 10,
  requirements: {
    ageRange: { min: 18, max: 99 }
  }
};

const preCheckResult = validateActivityEligibility(activityWithAgeLimit, userUnderage);
assert.strictEqual(preCheckResult.eligible, false);
assert.strictEqual(preCheckResult.errorCode, 'AGE_REQUIREMENT_NOT_MET');

// 2. Kicked user pre-check
const kickedUser = {
  uid: 'user2',
  accountStatus: 'active',
  isBanned: false,
};

const activityWithKickedUser = {
  hostId: 'host1',
  participantIds: ['user3'],
  kickedUserIds: ['user2'],
  maxParticipants: 10,
};

const kickedCheck = validateActivityEligibility(activityWithKickedUser, kickedUser);
assert.strictEqual(kickedCheck.eligible, false);
assert.strictEqual(kickedCheck.errorCode, 'USER_KICKED');

// 3. Activity full pre-check
const normalUser = {
  uid: 'user4',
  accountStatus: 'active',
  isBanned: false,
};

const fullActivity = {
  hostId: 'host1',
  participantIds: ['user5', 'user6'],
  maxParticipants: 2,
};

const fullCheck = validateActivityEligibility(fullActivity, normalUser);
assert.strictEqual(fullCheck.eligible, false);
assert.strictEqual(fullCheck.errorCode, 'ACTIVITY_FULL');

// 4. User Creation Eligibility Check (banned / suspended / incomplete profile)
const bannedUserData = {
  uid: 'banned_1',
  onboardingCompleted: true,
  isBanned: true,
  accountStatus: 'suspended'
};
const bannedCreationCheck = checkUserEligibilityForActivityCreation(bannedUserData);
assert.strictEqual(bannedCreationCheck.eligible, false);
assert.ok(bannedCreationCheck.errorMessage?.includes('gesperrt') || bannedCreationCheck.errorMessage?.includes('deaktiviert'));

console.log('✅ requirements-join.test.ts PASSED!');

