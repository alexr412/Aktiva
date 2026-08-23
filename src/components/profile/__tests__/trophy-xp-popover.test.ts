import assert from 'node:assert';
import { LEVEL_THRESHOLDS, getLevelTitle, getLevelTierInfo } from '../../../lib/levels';

function runTrophyXpPopoverTests() {
  console.log('Running Trophy XP Popover Tests...');

  // 1. Test Level thresholds & titles
  assert.strictEqual(LEVEL_THRESHOLDS[0], 0);
  assert.strictEqual(typeof LEVEL_THRESHOLDS[1], 'number');
  assert.ok(LEVEL_THRESHOLDS[1] > 0);

  // 2. Test tier info
  const tier1 = getLevelTierInfo(1);
  assert.strictEqual(tier1.titleDe, 'Starter');

  const tier5 = getLevelTierInfo(5);
  assert.strictEqual(tier5.titleDe, 'Entdecker');

  const tier10 = getLevelTierInfo(10);
  assert.strictEqual(tier10.titleDe, 'Aktivist');

  const tier20 = getLevelTierInfo(20);
  assert.strictEqual(tier20.titleDe, 'Stammmitglied');

  const tier35 = getLevelTierInfo(35);
  assert.strictEqual(tier35.titleDe, 'Pionier');

  const tier50 = getLevelTierInfo(50);
  assert.strictEqual(tier50.titleDe, 'Aktiva Legende');

  // 3. Test getLevelTitle
  assert.strictEqual(getLevelTitle(1, 'de'), 'Starter');
  assert.strictEqual(getLevelTitle(5, 'en'), 'Explorer');
  assert.strictEqual(getLevelTitle(10, 'de'), 'Aktivist');

  console.log('✅ All Trophy XP Popover Tests Passed!');
}

runTrophyXpPopoverTests();
