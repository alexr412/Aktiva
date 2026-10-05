import * as assert from 'assert';
import { parseAndNormalizeIso8601Date, validateActivityCreationDates } from './activities';
import { HttpsError } from 'firebase-functions/v2/https';

console.log('Running date-normalization.test.ts...');

// 1. Valid ISO-8601 dates with timezone offsets
const validUtc = parseAndNormalizeIso8601Date('2026-05-15T12:00:00Z', 'startDate');
assert.strictEqual(validUtc.iso, '2026-05-15T12:00:00.000Z');
assert.strictEqual(typeof validUtc.ms, 'number');

const validOffset = parseAndNormalizeIso8601Date('2026-05-15T14:00:00+02:00', 'startDate');
assert.strictEqual(validOffset.iso, '2026-05-15T12:00:00.000Z');

const validMillis = parseAndNormalizeIso8601Date('2026-05-15T12:00:00.123Z', 'startDate');
assert.strictEqual(validMillis.iso, '2026-05-15T12:00:00.123Z');

// 2. Reject missing timezone offset
assert.throws(
  () => parseAndNormalizeIso8601Date('2026-05-15T12:00:00', 'startDate'),
  (err: any) => err instanceof HttpsError && err.code === 'invalid-argument' && err.message.includes('timezone offset')
);

// 3. Reject invalid date strings
assert.throws(
  () => parseAndNormalizeIso8601Date('not-a-date', 'startDate'),
  (err: any) => err instanceof HttpsError && err.code === 'invalid-argument'
);

assert.throws(
  () => parseAndNormalizeIso8601Date(123456789, 'startDate'),
  (err: any) => err instanceof HttpsError && err.code === 'invalid-argument'
);

// 4. Reject invalid calendar days (e.g. Feb 31st or Feb 29th on non-leap year)
assert.throws(
  () => parseAndNormalizeIso8601Date('2026-02-31T12:00:00Z', 'startDate'),
  (err: any) => err instanceof HttpsError && err.code === 'invalid-argument' && err.message.includes('invalid calendar day')
);

assert.throws(
  () => parseAndNormalizeIso8601Date('2026-02-29T12:00:00Z', 'startDate'),
  (err: any) => err instanceof HttpsError && err.code === 'invalid-argument' && err.message.includes('invalid calendar day')
);

const now = Date.parse('2026-10-05T12:00:00+02:00');
const todayStart = Date.parse('2026-10-05T00:00:00+02:00');
const todayEnd = Date.parse('2026-10-05T23:59:59.999+02:00');
assert.doesNotThrow(() => validateActivityCreationDates(todayStart, todayEnd, true, now));
assert.throws(() => validateActivityCreationDates(todayStart - 86400000, todayEnd - 86400000, true, now), /Vergangenheit/);
assert.throws(() => validateActivityCreationDates(todayStart, todayEnd, false, now), /Vergangenheit/);
assert.throws(() => validateActivityCreationDates(todayStart, undefined, true, now), /Vergangenheit/);
assert.doesNotThrow(() => validateActivityCreationDates(now - 5 * 60000, undefined, false, now));
assert.throws(() => validateActivityCreationDates(now - 5 * 60000 - 1, undefined, false, now), /Vergangenheit/);
assert.doesNotThrow(() => validateActivityCreationDates(now + 3600000, undefined, false, now));
assert.throws(() => validateActivityCreationDates(todayStart, todayStart, true, now), /nach dem Startdatum/);
assert.throws(() => validateActivityCreationDates(todayStart, todayStart - 1, true, now), /nach dem Startdatum/);
assert.throws(() => validateActivityCreationDates(todayStart, todayStart + 31 * 86400000, true, now), /maximal 30 Tage/);

console.log('✅ date-normalization.test.ts PASSED!');
