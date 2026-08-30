import assert from 'assert';

console.log('🧪 Starting Aktiva Support Ticket Backend & Validation Unit Tests...\n');

// 1. Validation Logic Helper
function validateSupportTicketInput(input: {
  category?: string;
  subject?: string;
  message?: string;
  appVersion?: string;
  platform?: string;
}): { valid: boolean; error?: string; cleanSubject?: string; cleanMessage?: string } {
  const ALLOWED_CATEGORIES = ['bug', 'feedback', 'account', 'safety', 'other'];

  if (!input.category || typeof input.category !== 'string' || !ALLOWED_CATEGORIES.includes(input.category)) {
    return { valid: false, error: 'invalid-category' };
  }

  const cleanSubject = typeof input.subject === 'string' ? input.subject.trim() : '';
  if (cleanSubject.length < 3 || cleanSubject.length > 100) {
    return { valid: false, error: 'invalid-subject' };
  }

  const cleanMessage = typeof input.message === 'string' ? input.message.trim() : '';
  if (cleanMessage.length < 10 || cleanMessage.length > 2000) {
    return { valid: false, error: 'invalid-message' };
  }

  return { valid: true, cleanSubject, cleanMessage };
}

// Test 1: Valid Ticket Input
console.log('Test 1: Valid Support Ticket Inputs');
const res1 = validateSupportTicketInput({
  category: 'bug',
  subject: 'Map does not render tiles',
  message: 'When I navigate to /map on iOS Safari, the map tiles remain blank. Stack: Error at Map.render()',
});
assert.strictEqual(res1.valid, true);
console.log('  ✅ Valid support ticket input passed');

// Test 2: Category Whitelist
console.log('\nTest 2: Category Whitelist Validation');
assert.strictEqual(validateSupportTicketInput({ category: 'invalid_cat', subject: 'Valid subject', message: 'Valid message content 123456789' }).error, 'invalid-category');
assert.strictEqual(validateSupportTicketInput({ category: 'bug', subject: 'Valid subject', message: 'Valid message content 123456789' }).valid, true);
console.log('  ✅ Category whitelist validation passed');

// Test 3: Subject Length Boundaries
console.log('\nTest 3: Subject Length Boundaries (3 - 100 chars)');
assert.strictEqual(validateSupportTicketInput({ category: 'bug', subject: 'ab', message: 'Valid message content 123456789' }).error, 'invalid-subject');
assert.strictEqual(validateSupportTicketInput({ category: 'bug', subject: 'a'.repeat(101), message: 'Valid message content 123456789' }).error, 'invalid-subject');
assert.strictEqual(validateSupportTicketInput({ category: 'bug', subject: '   abc   ', message: 'Valid message content 123456789' }).valid, true);
console.log('  ✅ Subject length boundary validation passed');

// Test 4: Message Length & Whitespace Handling
console.log('\nTest 4: Message Length & Whitespace Rejection (10 - 2000 chars)');
assert.strictEqual(validateSupportTicketInput({ category: 'bug', subject: 'Valid subject', message: 'Short' }).error, 'invalid-message');
assert.strictEqual(validateSupportTicketInput({ category: 'bug', subject: 'Valid subject', message: '          ' }).error, 'invalid-message');
assert.strictEqual(validateSupportTicketInput({ category: 'bug', subject: 'Valid subject', message: 'x'.repeat(2001) }).error, 'invalid-message');
console.log('  ✅ Message length & whitespace rejection passed');

// Test 5: Non-Destructive Code & URL Preservation
console.log('\nTest 5: Non-Destructive Payload Preservation (URLs, Code, Stack Traces)');
const techMessage = 'Error at https://api.activa.app/v1/geo?lat=53.5&lng=8.5. Stack: TypeError: Cannot read property <x> of null';
const resTech = validateSupportTicketInput({ category: 'bug', subject: 'Technical issue', message: techMessage });
assert.strictEqual(resTech.valid, true);
assert.strictEqual(resTech.cleanMessage, techMessage, 'URLs, code snippets, and stack traces must NOT be stripped or altered');
console.log('  ✅ Non-destructive payload preservation passed');

// Test 6: Rate Limiter Enforcement (1-5 Allowed, 6 Blocked with resource-exhausted)
console.log('\nTest 6: Rate Limiter Enforcement (1-5 Allowed, 6 Blocked with resource-exhausted)');
function simulateRateLimiter(
  attemptsHistory: number[],
  now: number,
  maxAttempts: number = 5,
  windowSeconds: number = 3600
): { allowed: boolean; newHistory: number[]; error?: string } {
  const validAttempts = attemptsHistory.filter((ts) => now - ts < windowSeconds * 1000);
  if (validAttempts.length >= maxAttempts) {
    return { allowed: false, newHistory: validAttempts, error: 'resource-exhausted' };
  }
  validAttempts.push(now);
  return { allowed: true, newHistory: validAttempts };
}

let history: number[] = [];
const now = Date.now();

for (let i = 1; i <= 5; i++) {
  const res = simulateRateLimiter(history, now, 5, 3600);
  assert.strictEqual(res.allowed, true, `Request ${i} must be allowed`);
  history = res.newHistory;
  console.log(`  ✅ Request ${i} -> allowed`);
}

const req6 = simulateRateLimiter(history, now, 5, 3600);
assert.strictEqual(req6.allowed, false, 'Request 6 must be blocked');
assert.strictEqual(req6.error, 'resource-exhausted', 'Request 6 error must be resource-exhausted');
console.log('  ✅ Request 6 -> resource-exhausted');

console.log('\n🎉 All Support Ticket Validation & Rate Limit Tests Passed!');
