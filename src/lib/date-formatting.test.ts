import assert from 'node:assert';
import { formatActivityDateRange, formatActivityTimeDisplay } from './utils';

// Helper mock for Firestore Timestamp
function createMockTimestamp(date: Date) {
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
}

console.log('--- RUNNING DATE FORMATTING TESTS FOR ACTIVITY DETAIL OVERVIEW ---');

// Case A:
// Start: 11.08.2026
// Ende: nicht vorhanden
// -> DATUM: „Di., 11. Aug.“
const dateA_start = createMockTimestamp(new Date(2026, 7, 11, 14, 0)); // August 11, 2026
const resA_datum = formatActivityDateRange(dateA_start, undefined, 'de');
console.log('Case A (Start only):', resA_datum);
assert.strictEqual(resA_datum, 'Di., 11. Aug.');

// Case B:
// Start: 11.08.2026
// Ende: 11.08.2026
// -> DATUM: „Di., 11. Aug.“
const dateB_start = createMockTimestamp(new Date(2026, 7, 11, 10, 0));
const dateB_end = createMockTimestamp(new Date(2026, 7, 11, 18, 0));
const resB_datum = formatActivityDateRange(dateB_start, dateB_end, 'de');
console.log('Case B (Same Start and End):', resB_datum);
assert.strictEqual(resB_datum, 'Di., 11. Aug.');

// Case C:
// Start: 20.07.2026
// Ende: 11.08.2026
// -> DATUM: „Mo., 20. Juli – Di., 11. Aug.“
const dateC_start = createMockTimestamp(new Date(2026, 6, 20, 9, 0)); // July 20, 2026
const dateC_end = createMockTimestamp(new Date(2026, 7, 11, 17, 0)); // August 11, 2026
const resC_datum = formatActivityDateRange(dateC_start, dateC_end, 'de');
console.log('Case C (Different Start and End):', resC_datum);
assert.strictEqual(resC_datum, 'Mo., 20. Juli – Di., 11. Aug.');

// Case D:
// Start + Ende unterschiedlich
// flexible = true
// -> vollständiger Zeitraum im DATUM-Feld („Mo., 20. Juli – Di., 11. Aug.“)
// -> „Flexibel“ im ZEIT-Feld
const dateD_start = createMockTimestamp(new Date(2026, 6, 20, 9, 0));
const dateD_end = createMockTimestamp(new Date(2026, 7, 11, 17, 0));
const resD_datum = formatActivityDateRange(dateD_start, dateD_end, 'de');
const resD_zeit = formatActivityTimeDisplay(dateD_start, true, 'de');
console.log('Case D (Different Start/End, flexible time):', { DATUM: resD_datum, ZEIT: resD_zeit });
assert.strictEqual(resD_datum, 'Mo., 20. Juli – Di., 11. Aug.');
assert.strictEqual(resD_zeit, 'Flexibel');

// Case E:
// Start + Ende unterschiedlich
// feste Uhrzeit vorhanden
// -> vollständiger Zeitraum im DATUM-Feld („Mo., 20. Juli – Di., 11. Aug.“)
// -> feste Uhrzeit im ZEIT-Feld (z.B. „14:00“)
const dateE_start = createMockTimestamp(new Date(2026, 6, 20, 14, 0));
const dateE_end = createMockTimestamp(new Date(2026, 7, 11, 17, 0));
const resE_datum = formatActivityDateRange(dateE_start, dateE_end, 'de');
const resE_zeit = formatActivityTimeDisplay(dateE_start, false, 'de');
console.log('Case E (Different Start/End, fixed time 14:00):', { DATUM: resE_datum, ZEIT: resE_zeit });
assert.strictEqual(resE_datum, 'Mo., 20. Juli – Di., 11. Aug.');
assert.strictEqual(resE_zeit, '14:00');

console.log('--- ALL 5 TEST CASES PASSED SUCCESSFULLY ---');
