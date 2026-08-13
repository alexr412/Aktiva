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

// Combined helper matching Feed Info Panel logic:
function formatFeedInfoDateTime(activityDate?: any, activityEndDate?: any, isTimeFlexible?: boolean, language: 'de' | 'en' = 'de') {
  const dateRange = formatActivityDateRange(activityDate, activityEndDate, language);
  if (!dateRange) return '';
  const timeDisplay = formatActivityTimeDisplay(activityDate, isTimeFlexible, language);
  return `${dateRange} (${timeDisplay})`;
}

console.log('--- RUNNING DATE FORMATTING TESTS FOR ACTIVITY DETAIL & FEED INFO PANEL ---');

// 1. Nur Startdatum
const date_start_only = createMockTimestamp(new Date(2026, 7, 11, 14, 0)); // Tuesday, 11.08.2026 14:00

// 1a. Nur Startdatum, date range:
const res_start_only_range = formatActivityDateRange(date_start_only, undefined, 'de');
console.log('Test 1a (Nur Startdatum - Date Range):', res_start_only_range);
assert.strictEqual(res_start_only_range, 'Di., 11. Aug.');

// 1b. Nur Startdatum, Feed Info Panel (isTimeFlexible = true):
const res_start_only_feed_flex = formatFeedInfoDateTime(date_start_only, undefined, true, 'de');
console.log('Test 1b (Nur Startdatum - Feed Info flexibel):', res_start_only_feed_flex);
assert.strictEqual(res_start_only_feed_flex, 'Di., 11. Aug. (Flexibel)');

// 1c. Nur Startdatum, Feed Info Panel (isTimeFlexible = false, 14:00):
const res_start_only_feed_fixed = formatFeedInfoDateTime(date_start_only, undefined, false, 'de');
console.log('Test 1c (Nur Startdatum - Feed Info feste Uhrzeit):', res_start_only_feed_fixed);
assert.strictEqual(res_start_only_feed_fixed, 'Di., 11. Aug. (14:00)');


// 2. Startdatum = Enddatum (am selben Tag)
const date_same_start = createMockTimestamp(new Date(2026, 7, 11, 10, 0));
const date_same_end = createMockTimestamp(new Date(2026, 7, 11, 18, 0));

// 2a. Startdatum = Enddatum, date range:
const res_same_range = formatActivityDateRange(date_same_start, date_same_end, 'de');
console.log('Test 2a (Start = Ende - Date Range):', res_same_range);
assert.strictEqual(res_same_range, 'Di., 11. Aug.');

// 2b. Startdatum = Enddatum, Feed Info Panel (isTimeFlexible = true):
const res_same_feed_flex = formatFeedInfoDateTime(date_same_start, date_same_end, true, 'de');
console.log('Test 2b (Start = Ende - Feed Info flexibel):', res_same_feed_flex);
assert.strictEqual(res_same_feed_flex, 'Di., 11. Aug. (Flexibel)');

// 2c. Startdatum = Enddatum, Feed Info Panel (isTimeFlexible = false, 10:00):
const res_same_feed_fixed = formatFeedInfoDateTime(date_same_start, date_same_end, false, 'de');
console.log('Test 2c (Start = Ende - Feed Info feste Uhrzeit):', res_same_feed_fixed);
assert.strictEqual(res_same_feed_fixed, 'Di., 11. Aug. (10:00)');


// 3. Startdatum != Enddatum
const date_diff_start = createMockTimestamp(new Date(2026, 7, 11, 14, 0)); // Tuesday, 11.08.2026
const date_diff_end = createMockTimestamp(new Date(2026, 7, 15, 18, 0)); // Saturday, 15.08.2026

// 3a. Startdatum != Enddatum, date range:
const res_diff_range = formatActivityDateRange(date_diff_start, date_diff_end, 'de');
console.log('Test 3a (Start != Ende - Date Range):', res_diff_range);
assert.strictEqual(res_diff_range, 'Di., 11. Aug. – Sa., 15. Aug.');

// 3b. Startdatum != Enddatum, Feed Info Panel (isTimeFlexible = true):
const res_diff_feed_flex = formatFeedInfoDateTime(date_diff_start, date_diff_end, true, 'de');
console.log('Test 3b (Start != Ende - Feed Info flexibel):', res_diff_feed_flex);
assert.strictEqual(res_diff_feed_flex, 'Di., 11. Aug. – Sa., 15. Aug. (Flexibel)');

// 3c. Startdatum != Enddatum, Feed Info Panel (isTimeFlexible = false, 14:00):
const res_diff_feed_fixed = formatFeedInfoDateTime(date_diff_start, date_diff_end, false, 'de');
console.log('Test 3c (Start != Ende - Feed Info feste Uhrzeit):', res_diff_feed_fixed);
assert.strictEqual(res_diff_feed_fixed, 'Di., 11. Aug. – Sa., 15. Aug. (14:00)');


console.log('--- ALL TEST CASES PASSED SUCCESSFULLY ---');
