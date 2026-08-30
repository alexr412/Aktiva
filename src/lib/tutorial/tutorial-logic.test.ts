import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CURRENT_APP_TUTORIAL_VERSION } from './tutorial-config';

console.log('🧪 Running Tutorial Logic & Security Rule Sync Tests...');

// 1. Sync Test: Ensure TS constant matches firestore.rules
const rulesPath = path.join(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

assert.ok(
  rulesContent.includes(`request.resource.data.get('appTutorialVersion', 0) == ${CURRENT_APP_TUTORIAL_VERSION}`),
  `firestore.rules version check must match CURRENT_APP_TUTORIAL_VERSION (${CURRENT_APP_TUTORIAL_VERSION})`
);
console.log('✅ PASS: firestore.rules version check matches TS CURRENT_APP_TUTORIAL_VERSION');

// 2. Eligibility evaluation tests
function evaluateEligibility(profile: { onboardingCompleted: boolean; appTutorialEligible?: boolean; appTutorialVersion?: number }, isReplay: boolean): boolean {
  return (
    profile.onboardingCompleted === true &&
    profile.appTutorialEligible === true &&
    (profile.appTutorialVersion ?? 0) === 0 &&
    !isReplay
  );
}

// Case A: Legacy user (onboardingCompleted: true, no appTutorialEligible flag)
const legacyUser = { onboardingCompleted: true };
assert.equal(evaluateEligibility(legacyUser, false), false, 'Legacy user must NOT be auto-eligible');
console.log('✅ PASS: Legacy user is not auto-eligible');

// Case B: New user (onboardingCompleted: true, appTutorialEligible: true, version 0)
const newUser = { onboardingCompleted: true, appTutorialEligible: true, appTutorialVersion: 0 };
assert.equal(evaluateEligibility(newUser, false), true, 'New user must be auto-eligible once');
console.log('✅ PASS: New user is auto-eligible once');

// Case C: User who completed tutorial version 1
const completedUser = { onboardingCompleted: true, appTutorialEligible: true, appTutorialVersion: 1 };
assert.equal(evaluateEligibility(completedUser, false), false, 'Completed user must NOT be auto-eligible');
console.log('✅ PASS: Completed user is not auto-eligible');

// Case D: Replay mode (isReplay = true)
assert.equal(evaluateEligibility(newUser, true), false, 'Replay mode bypasses auto-start eligibility check');
console.log('✅ PASS: Replay mode bypasses auto-start eligibility check');

// 3. URLSearchParams Replay Query Cleaning Test
function cleanReplayUrl(urlStr: string): string {
  const url = new URL(urlStr);
  url.searchParams.delete('tutorial');
  return `${url.pathname}${url.search}${url.hash}`;
}

const testUrl1 = 'https://app.com/?ref=123&tutorial=replay#map';
assert.equal(cleanReplayUrl(testUrl1), '/?ref=123#map', 'Query cleaning removes tutorial=replay keeping other params & hash');
console.log('✅ PASS: URLSearchParams removes tutorial=replay preserving ref=123 and #map');

const testUrl2 = 'https://app.com/?tutorial=replay';
assert.equal(cleanReplayUrl(testUrl2), '/', 'Query cleaning removes solo tutorial=replay leaving root /');
console.log('✅ PASS: URLSearchParams removes solo tutorial=replay leaving /');

console.log('🎉 All Tutorial Logic Tests Passed!');
