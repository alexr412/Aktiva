import assert from 'node:assert';
import {
  ACTIVA_APP_URL,
  getReferralLink,
  extractReferralCode,
  storePendingReferralCode,
  getPendingReferralCode,
  clearPendingReferralCode,
  shareOrCopyReferralLink,
  isPermanentReferralError,
} from './referral';

// Mock storage environment for Node testing
class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) ?? null; }
  key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, String(value)); }
}

const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();

(globalThis as any).window = globalThis;
(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).sessionStorage = mockSessionStorage;

function resetStorage() {
  mockLocalStorage.clear();
  mockSessionStorage.clear();
}

async function runTests() {
  console.log('=== Running Activa Referral System Tests ===\n');

  // Test 1: getReferralLink generates correct personal invite link (/invite/CODE)
  console.log('Test 1: getReferralLink() produces central domain invite link (/invite/CODE)');
  resetStorage();
  const link1 = getReferralLink('ABC123');
  assert.strictEqual(link1, `${ACTIVA_APP_URL}/invite/ABC123`);
  console.log('  ✅ Passed');

  // Test 2: extractReferralCode extracts legacy ?ref= and new /invite/CODE correctly
  console.log('Test 2: extractReferralCode() parses legacy ?ref= and new /invite/CODE parameters');
  const extractedLegacy = extractReferralCode('https://aktiva-six.vercel.app/?ref=XYZ789');
  assert.strictEqual(extractedLegacy, 'XYZ789');
  const extractedNewPath = extractReferralCode('https://aktiva-six.vercel.app/invite/7ZEACNG8');
  assert.strictEqual(extractedNewPath, '7ZEACNG8');
  const extractedPathOnly = extractReferralCode('/invite/INVITE_CODE_1');
  assert.strictEqual(extractedPathOnly, 'INVITE_CODE_1');
  const params2 = new URLSearchParams('ref=TESTCODE1');
  assert.strictEqual(extractReferralCode(params2), 'TESTCODE1');
  console.log('  ✅ Passed');

  // Test 3: Normalization and invalid/empty values
  console.log('Test 3: Normalization (uppercase, trim) and invalid value filtering');
  assert.strictEqual(extractReferralCode('  abc123  '), 'ABC123');
  assert.strictEqual(extractReferralCode('?ref=  lower123 '), 'LOWER123');
  assert.strictEqual(extractReferralCode('/invite/lower456'), 'LOWER456');
  assert.strictEqual(extractReferralCode('?ref='), null);
  assert.strictEqual(extractReferralCode('?ref=a'), null); // too short (<3)
  assert.strictEqual(extractReferralCode('?ref=<script>'), null); // invalid chars
  console.log('  ✅ Passed');

  // Test 4: Pending referral remains in storage
  console.log('Test 4: Pending referral remains stored across Storage reads');
  resetStorage();
  storePendingReferralCode('REFCODE123');
  assert.strictEqual(getPendingReferralCode(), 'REFCODE123');
  assert.strictEqual(getPendingReferralCode(), 'REFCODE123'); // second read
  console.log('  ✅ Passed');

  // Test 5: Overwriting old pending code with new code
  console.log('Test 5: New referral code replaces old pending code in storage');
  resetStorage();
  storePendingReferralCode('CODE_OLD');
  assert.strictEqual(getPendingReferralCode(), 'CODE_OLD');
  storePendingReferralCode('CODE_NEW');
  assert.strictEqual(getPendingReferralCode(), 'CODE_NEW');
  // Storing same code again doesn't break
  storePendingReferralCode('CODE_NEW');
  assert.strictEqual(getPendingReferralCode(), 'CODE_NEW');
  console.log('  ✅ Passed');

  // Test 6: Onboarding referral retrieval and clearing
  console.log('Test 6: Referral code retrieval and clearing for onboarding flow');
  resetStorage();
  storePendingReferralCode('ONBOARDING_REF');
  const retrieved = getPendingReferralCode();
  assert.strictEqual(retrieved, 'ONBOARDING_REF');
  clearPendingReferralCode();
  assert.strictEqual(getPendingReferralCode(), null);
  console.log('  ✅ Passed');

  // Test 7: Invalid code does not block onboarding
  console.log('Test 7: Invalid code produces permanent error identification');
  const notFoundErr = { code: 'not-found', message: 'Der eingegebene Referral-Code ist ungültig.' };
  assert.strictEqual(isPermanentReferralError(notFoundErr), true);
  console.log('  ✅ Passed');

  // Test 8: Self-referral error is recognized as permanent
  console.log('Test 8: Self-referral error is recognized as permanent');
  const selfRefErr = { code: 'failed-precondition', message: 'Du kannst dich nicht selbst werben.' };
  assert.strictEqual(isPermanentReferralError(selfRefErr), true);
  console.log('  ✅ Passed');

  // Test 9: Clipboard fallback copies full referral invite link
  console.log('Test 9: Clipboard fallback receives exact full referral invite link');
  let lastCopiedText = '';
  (globalThis as any).navigator = {
    clipboard: {
      writeText: async (text: string) => {
        lastCopiedText = text;
      }
    }
  };
  const copyRes = await shareOrCopyReferralLink({ referralCode: 'MYCODE123', language: 'de' });
  assert.strictEqual(copyRes.action, 'copy');
  assert.strictEqual(copyRes.success, true);
  assert.strictEqual(lastCopiedText, `${ACTIVA_APP_URL}/invite/MYCODE123`);
  console.log('  ✅ Passed');

  // Test 10: navigator.share options
  console.log('Test 10: navigator.share receives title, text, and full invite url');
  let sharedPayload: any = null;
  (globalThis as any).navigator = {
    share: async (data: any) => {
      sharedPayload = data;
    }
  };
  const shareRes = await shareOrCopyReferralLink({ referralCode: 'SHARECODE', language: 'de' });
  assert.strictEqual(shareRes.action, 'share');
  assert.strictEqual(shareRes.success, true);
  assert.strictEqual(sharedPayload.title, 'Activa');
  assert.strictEqual(sharedPayload.text, 'Komm zu Activa und entdecke Aktivitäten, Orte und neue Leute in deiner Nähe.');
  assert.strictEqual(sharedPayload.url, `${ACTIVA_APP_URL}/invite/SHARECODE`);
  console.log('  ✅ Passed');

  // Test 11: AbortError during share does NOT trigger clipboard fallback
  console.log('Test 11: AbortError on share does NOT trigger clipboard fallback');
  lastCopiedText = '';
  (globalThis as any).navigator = {
    share: async () => {
      const err: any = new Error('Share canceled');
      err.name = 'AbortError';
      throw err;
    },
    clipboard: {
      writeText: async (text: string) => {
        lastCopiedText = text;
      }
    }
  };
  const abortRes = await shareOrCopyReferralLink({ referralCode: 'ABORTCODE', language: 'de' });
  assert.strictEqual(abortRes.action, 'share');
  assert.strictEqual(abortRes.success, false);
  assert.strictEqual((abortRes as any).isAbort, true);
  assert.strictEqual(lastCopiedText, ''); // Clipboard was NOT touched
  console.log('  ✅ Passed');

  // Test 12: Technical share error falls back to clipboard
  console.log('Test 12: Technical share error falls back to clipboard copy');
  lastCopiedText = '';
  (globalThis as any).navigator = {
    share: async () => {
      throw new Error('NotSupportedError');
    },
    clipboard: {
      writeText: async (text: string) => {
        lastCopiedText = text;
      }
    }
  };
  const fallbackRes = await shareOrCopyReferralLink({ referralCode: 'FALLBACK1', language: 'de' });
  assert.strictEqual(fallbackRes.action, 'copy');
  assert.strictEqual(fallbackRes.success, true);
  assert.strictEqual(lastCopiedText, `${ACTIVA_APP_URL}/invite/FALLBACK1`);
  console.log('  ✅ Passed');

  // Test 13: Temporary network error keeps pending code
  console.log('Test 13: Temporary network/timeout error returns isPermanentReferralError = false');
  const tempErr1 = { code: 'unavailable', message: 'Network request failed' };
  const tempErr2 = { code: 'deadline-exceeded', message: 'Timeout' };
  assert.strictEqual(isPermanentReferralError(tempErr1), false);
  assert.strictEqual(isPermanentReferralError(tempErr2), false);
  console.log('  ✅ Passed');

  // Test 14: Permanent referral error returns isPermanentReferralError = true
  console.log('Test 14: Permanent business logic error returns isPermanentReferralError = true');
  const permErr1 = { code: 'already-exists', message: 'Du hast bereits einen Referral-Code angewendet.' };
  const permErr2 = { code: 'invalid-argument', message: 'A valid referral code is required.' };
  assert.strictEqual(isPermanentReferralError(permErr1), true);
  assert.strictEqual(isPermanentReferralError(permErr2), true);
  console.log('  ✅ Passed');

  // Test 15: Central URL configuration verification
  console.log('Test 15: Single central URL configuration controls generated link format');
  assert.ok(ACTIVA_APP_URL.length > 0);
  assert.ok(getReferralLink('CENTRAL_TEST').startsWith(`${ACTIVA_APP_URL}/invite/`));
  console.log('  ✅ Passed');

  console.log('\n🎉 All 15 Activa Referral Tests Passed Successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
