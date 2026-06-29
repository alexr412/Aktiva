import assert from 'assert';
import {
  MIN_USERNAME_LENGTH,
  RESERVED_USERNAMES,
  normalizeUsername,
  normalizeUsernameStrict,
  isReservedUsername,
} from './reserved-usernames';

console.log('--- RUNNING RESERVED USERNAME TESTS ---');

function testNormalizeUsername() {
  console.log('Running testNormalizeUsername...');
  assert.strictEqual(normalizeUsername(' Älex '), 'alex');
  assert.strictEqual(normalizeUsername('  ADMIN  '), 'admin');
  assert.strictEqual(normalizeUsername('Straße'), 'strasse');
  console.log('✅ testNormalizeUsername passed');
}

function testNormalizeUsernameStrict() {
  console.log('Running testNormalizeUsernameStrict...');
  assert.strictEqual(normalizeUsernameStrict('a.l_e-x'), 'alex');
  assert.strictEqual(normalizeUsernameStrict('ad.min_1'), 'admin1');
  console.log('✅ testNormalizeUsernameStrict passed');
}

function testIsReservedUsername() {
  console.log('Running testIsReservedUsername...');

  // Reserved names — should be blocked
  assert.strictEqual(isReservedUsername('alex'), true);
  assert.strictEqual(isReservedUsername('a.l_e-x'), true);
  assert.strictEqual(isReservedUsername('admin'), true);
  assert.strictEqual(isReservedUsername('admin1'), true);
  assert.strictEqual(isReservedUsername('support24'), true);
  assert.strictEqual(isReservedUsername('ADMIN'), true);
  assert.strictEqual(isReservedUsername('  Alex  '), true);

  // NOT reserved
  assert.strictEqual(isReservedUsername('alexander'), false);
  assert.strictEqual(isReservedUsername('alexr412'), false);
  assert.strictEqual(isReservedUsername('myadmin'), false);
  assert.strictEqual(isReservedUsername('realadmin'), false);
  assert.strictEqual(isReservedUsername('coolguy'), false);
  assert.strictEqual(isReservedUsername('abc'), false);
  assert.strictEqual(isReservedUsername(''), false);

  console.log('✅ testIsReservedUsername passed');
}

function testSetIntegrity() {
  console.log('Running testSetIntegrity...');

  // No entry in the set should be shorter than MIN_USERNAME_LENGTH
  for (const entry of RESERVED_USERNAMES) {
    assert.ok(
      entry.length >= MIN_USERNAME_LENGTH,
      `Reserved set contains entry shorter than ${MIN_USERNAME_LENGTH}: "${entry}"`,
    );
  }

  // Spot-check expected entries
  const expectedEntries = [
    'admin', 'aktiva', 'alex', 'hamburg', 'instagram', 'firebase',
    'support', 'official', 'verified',
  ];
  for (const name of expectedEntries) {
    assert.ok(
      RESERVED_USERNAMES.has(name),
      `Expected "${name}" to be in the reserved set`,
    );
  }

  console.log('✅ testSetIntegrity passed');
}

// Run all test groups
try {
  testNormalizeUsername();
  testNormalizeUsernameStrict();
  testIsReservedUsername();
  testSetIntegrity();
  console.log('🎉 ALL RESERVED USERNAME TESTS PASSED SUCCESSFULLY! 🎉');
} catch (error) {
  console.error('❌ RESERVED USERNAME TEST FAILED:', error);
  process.exit(1);
}
