import * as assert from 'assert';
import { validateUserRequirements, getUserAge, calculateAgeFromBirthdate } from './activity-requirements-policy';

console.log('--- STARTING ACTIVITY REQUIREMENTS POLICY TESTS ---');

// Test 1: Age calculation from birthdate
const testNowMs = new Date('2026-09-03T12:00:00Z').getTime();
const age26 = calculateAgeFromBirthdate('2000-01-01', testNowMs);
assert.strictEqual(age26, 26, 'Age calculation from 2000-01-01 in 2026 should be 26');

const age25BirthdayNotReached = calculateAgeFromBirthdate('2000-12-31', testNowMs);
assert.strictEqual(age25BirthdayNotReached, 25, 'Age calculation before birthday should be 25');

// Test 2: getUserAge fallback precedence
const userWithBirthday = { birthday: '1995-05-15', age: 20 };
assert.strictEqual(getUserAge(userWithBirthday, testNowMs), 31, 'Birthday takes precedence over age field');

const userWithOnlyAge = { age: 28 };
assert.strictEqual(getUserAge(userWithOnlyAge, testNowMs), 28, 'Numeric age field used when birthday is missing');

const userWithNoAgeInfo = {};
assert.strictEqual(getUserAge(userWithNoAgeInfo, testNowMs), null, 'Returns null when age information is missing');

// Test 3: validateUserRequirements gender
const requirementsGender = { gender: ['female', 'diverse'] };
assert.doesNotThrow(() => {
  validateUserRequirements({ gender: 'female' }, requirementsGender, testNowMs);
});
assert.throws(
  () => {
    validateUserRequirements({ gender: 'male' }, requirementsGender, testNowMs);
  },
  (err: any) => err.code === 'permission-denied'
);

// Test 4: validateUserRequirements profile picture & verification & rating
assert.throws(
  () => {
    validateUserRequirements({ photoURL: '' }, { requireProfilePicture: true }, testNowMs);
  },
  (err: any) => err.code === 'permission-denied'
);

assert.throws(
  () => {
    validateUserRequirements({ kycStatus: 'unverified' }, { requireVerification: true }, testNowMs);
  },
  (err: any) => err.code === 'permission-denied'
);

assert.throws(
  () => {
    validateUserRequirements({ averageRating: 4.2 }, { minimumRating: 4.5 }, testNowMs);
  },
  (err: any) => err.code === 'permission-denied'
);

// Test 5: validateUserRequirements ageRange fail-closed
assert.throws(
  () => {
    // Missing age information must FAIL-CLOSED
    validateUserRequirements({}, { ageRange: { min: 18, max: 50 } }, testNowMs);
  },
  (err: any) => err.code === 'permission-denied',
  'Missing age info must fail closed when ageRange is specified'
);

assert.throws(
  () => {
    validateUserRequirements({ age: 17 }, { ageRange: { min: 18, max: 50 } }, testNowMs);
  },
  (err: any) => err.code === 'permission-denied',
  'Underage user must fail'
);

assert.doesNotThrow(() => {
  validateUserRequirements({ age: 25 }, { ageRange: { min: 18, max: 50 } }, testNowMs);
}, 'User in age range should pass');

console.log('✅ ALL ACTIVITY REQUIREMENTS POLICY TESTS PASSED CLEANLY!');
