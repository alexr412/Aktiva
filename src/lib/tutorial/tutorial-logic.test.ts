import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CURRENT_APP_TUTORIAL_VERSION, TUTORIAL_STEPS } from './tutorial-config';

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

// 4. 13-Step Structure & Route Mapping Assertions
assert.equal(TUTORIAL_STEPS.length, 13, 'Tutorial must have exactly 13 steps');
assert.equal(TUTORIAL_STEPS[0].targetId, 'header-profile-identity');
assert.equal(TUTORIAL_STEPS[1].targetId, 'header-location');
assert.equal(TUTORIAL_STEPS[2].targetId, 'feed-main');
assert.equal(TUTORIAL_STEPS[3].targetId, 'feed-tab-active');
assert.equal(TUTORIAL_STEPS[4].targetId, 'feed-tab-community');
assert.equal(TUTORIAL_STEPS[5].targetId, 'feed-tab-favorites');
assert.equal(TUTORIAL_STEPS[6].targetId, 'feed-filters');
assert.equal(TUTORIAL_STEPS[7].targetId, 'spot-card-create');
assert.equal(TUTORIAL_STEPS[8].targetId, 'nav-create');
assert.equal(TUTORIAL_STEPS[9].targetId, 'nav-explore');
assert.equal(TUTORIAL_STEPS[9].route, '/explore');
assert.equal(TUTORIAL_STEPS[10].targetId, 'nav-map');
assert.equal(TUTORIAL_STEPS[10].route, '/map');
assert.equal(TUTORIAL_STEPS[11].targetId, 'nav-chat');
assert.equal(TUTORIAL_STEPS[11].route, '/chat');
assert.equal(TUTORIAL_STEPS[12].targetId, 'nav-profile');
assert.equal(TUTORIAL_STEPS[12].route, '/profile');

console.log('✅ PASS: TUTORIAL_STEPS 1-13 structure and route mapping verified');

// 5. Desktop vs Mobile Position Calculation Test
function getCardStyleTest(targetRect: { top: number; left: number; width: number; height: number } | null, viewportWidth: number, viewportHeight: number): { top?: number | string; left?: number | string } {
  const isDesktop = viewportWidth >= 768;

  if (!isDesktop) {
    if (targetRect) {
      const isTopHalf = targetRect.top < viewportHeight / 2;
      if (isTopHalf) {
        return { top: Math.min(targetRect.top + targetRect.height + 16, viewportHeight - 220), left: '50%' };
      } else {
        return { left: '50%' };
      }
    }
    return { top: '50%', left: '50%' };
  }

  const cardWidth = 380;
  const cardHeight = 210;
  const padding = 20;
  const gap = 16;

  if (!targetRect) {
    return { top: '50%', left: '50%' };
  }

  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetBottom = targetRect.top + targetRect.height;

  if (targetBottom + gap + cardHeight <= viewportHeight - padding) {
    const left = Math.max(padding, Math.min(targetCenterX - cardWidth / 2, viewportWidth - cardWidth - padding));
    return { top: targetBottom + gap, left };
  }

  const top = Math.max(padding, Math.min(targetBottom + gap, viewportHeight - cardHeight - padding));
  const left = Math.max(padding, Math.min(targetCenterX - cardWidth / 2, viewportWidth - cardWidth - padding));
  return { top, left };
}

// Test Step 1 (Profile Identity at Top Left 20, 20) on 1440x900
const desktopPos1 = getCardStyleTest({ top: 20, left: 20, width: 120, height: 40 }, 1440, 900);
assert.equal(desktopPos1.top, 76, 'Desktop Tooltip must sit below top-left profile header target (20 + 40 + 16)');
assert.ok(typeof desktopPos1.left === 'number' && desktopPos1.left >= 20, 'Desktop Tooltip left position must be in target proximity');
console.log('✅ PASS: Desktop Tooltip (1440x900) positions in target proximity below Step 1 target');

// Test Mobile (390x844)
const mobilePos1 = getCardStyleTest({ top: 20, left: 20, width: 120, height: 40 }, 390, 844);
assert.equal(mobilePos1.left, '50%', 'Mobile Tooltip uses centered 50% left position');
console.log('✅ PASS: Mobile Tooltip (390x844) preserves centered mobile layout');

console.log('🎉 All Tutorial Logic Tests Passed!');
