import assert from 'assert';
import {
  normalizeModerationText,
  containsBlockedWord,
  validateUsername,
  validateChatMessage,
  CHAT_BLACKLIST,
  USERNAME_BLACKLIST,
  PARTIAL_MATCH_BLACKLIST
} from './blacklist';

console.log('--- RUNNING AKTIVA MODERATION SYSTEM TESTS ---');

// Helper to assert throws or fails
function testNormalization() {
  console.log('Running testNormalization...');
  // Normalization removes spaces and special chars
  assert.strictEqual(normalizeModerationText('f.i.c.k'), 'fick');
  assert.strictEqual(normalizeModerationText('h*u*r*e'), 'hure');
  assert.strictEqual(normalizeModerationText('n-a-z-i'), 'nazi');
  assert.strictEqual(normalizeModerationText('ÄÖÜäöüß'), 'aouaouss'); // Unicode normalization removes accents, ß becomes ss
  console.log('✅ testNormalization passed');
}

function testLeetspeakMapping() {
  console.log('Running testLeetspeakMapping...');
  // 1 -> i/l, 3 -> e, 4 -> a, 5 -> s, 0 -> o, @ -> a, $ -> s, ! -> i
  assert.strictEqual(normalizeModerationText('f1ck'), 'fick');
  assert.strictEqual(normalizeModerationText('n4z1'), 'nazi');
  assert.strictEqual(normalizeModerationText('b!tch'), 'bitch');
  assert.strictEqual(normalizeModerationText('h0rny'), 'horny');
  assert.strictEqual(normalizeModerationText('hurens0hn'), 'hurensohn');
  assert.strictEqual(normalizeModerationText('adm1n'), 'admin');
  assert.strictEqual(normalizeModerationText('@dm!n'), 'admin');
  assert.strictEqual(normalizeModerationText('b1tch$$'), 'bitchss');
  console.log('✅ testLeetspeakMapping passed');
}

function testPartialMatches() {
  console.log('Running testPartialMatches...');
  // Substring matches
  assert.strictEqual(containsBlockedWord('Was für ein hurensohn'), true);
  assert.strictEqual(containsBlockedWord('Du bist eine f1ckbitch'), true);
  assert.strictEqual(containsBlockedWord('Hass-nazi propaganda'), true);
  console.log('✅ testPartialMatches passed');
}

function testUsernameValidation() {
  console.log('Running testUsernameValidation...');
  // Reserved words
  assert.strictEqual(validateUsername('admin'), false);
  assert.strictEqual(validateUsername('support'), false);
  assert.strictEqual(validateUsername('system'), false);
  assert.strictEqual(validateUsername('official'), false);
  assert.strictEqual(validateUsername('moderator'), false);
  assert.strictEqual(validateUsername('verified'), false);

  // Toxic usernames
  assert.strictEqual(validateUsername('f1ckbitch'), false);
  assert.strictEqual(validateUsername('n4zi_123'), false);
  assert.strictEqual(validateUsername('hure'), false);
  assert.strictEqual(validateUsername('b!tch'), false);
  
  // Valid usernames
  assert.strictEqual(validateUsername('alexr412'), true);
  assert.strictEqual(validateUsername('aktiva_fan'), true);
  assert.strictEqual(validateUsername('hannes'), true);
  console.log('✅ testUsernameValidation passed');
}

function testChatValidation() {
  console.log('Running testChatValidation...');
  assert.strictEqual(validateChatMessage('Hallo wie geht es dir?'), true);
  assert.strictEqual(validateChatMessage('Du dummer wichser!'), false);
  assert.strictEqual(validateChatMessage('Nazi scheissdreck'), false);
  assert.strictEqual(validateChatMessage('Lass uns treffen'), true);
  console.log('✅ testChatValidation passed');
}

function testFalsePositivePrevention() {
  console.log('Running testFalsePositivePrevention...');
  // Normal curses should NOT be blocked (App requirements: scheiße, shit, damn are allowed)
  assert.strictEqual(validateChatMessage('scheiße'), true);
  assert.strictEqual(validateChatMessage('shit'), true);
  assert.strictEqual(validateChatMessage('damn'), true);
  assert.strictEqual(validateChatMessage('Das ist doch scheiße gelaufen'), true);

  // Random normal words that might contain clean substrings should NOT be blocked
  assert.strictEqual(validateUsername('national'), true); // contains 'nat' but not 'nazi'
  assert.strictEqual(validateUsername('spaß'), true); // contains 'spaß' which shouldn't match 'spast'
  assert.strictEqual(validateChatMessage('Ich habe viel Spaß!'), true);
  console.log('✅ testFalsePositivePrevention passed');
}

function testSpamCooldownLogic() {
  console.log('Running testSpamCooldownLogic...');
  // Chat Cooldown simulation: max 5 messages in 10 seconds
  const timestamps: number[] = [];
  const limit = 5;
  const windowMs = 10000;

  function canSendMessage(now: number): boolean {
    const tenSecAgo = now - windowMs;
    const recent = timestamps.filter(t => t > tenSecAgo);
    return recent.length < limit;
  }

  // Simulate sending 5 messages instantly
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(canSendMessage(t0), true);
    timestamps.push(t0);
  }
  // 6th message should be blocked
  assert.strictEqual(canSendMessage(t0), false);
  
  // 6th message after 11 seconds should be allowed
  assert.strictEqual(canSendMessage(t0 + 11000), true);
  console.log('✅ testSpamCooldownLogic passed');
}

// Run all test groups
try {
  testNormalization();
  testLeetspeakMapping();
  testPartialMatches();
  testUsernameValidation();
  testChatValidation();
  testFalsePositivePrevention();
  testSpamCooldownLogic();
  console.log('🎉 ALL MODERATION TESTS PASSED SUCCESSFULLY! 🎉');
} catch (error) {
  console.error('❌ MODERATION TEST FAILED:', error);
  process.exit(1);
}
