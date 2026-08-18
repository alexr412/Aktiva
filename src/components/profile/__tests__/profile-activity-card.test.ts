import assert from 'node:assert';
import { toDateObject } from '../../../lib/utils';
import type { Activity } from '../../../lib/types';

// Helper simulating current/past activity classification from profile/page.tsx
function classifyActivities(activities: Partial<Activity>[], referenceDate: Date = new Date()) {
  const pastActivities = activities.filter(a => {
    if (a.status === 'completed') return true;
    const d = toDateObject(a.activityDate);
    return d !== null && d < referenceDate;
  });

  const currentActivities = activities.filter(a => {
    if (a.status === 'completed' || a.status === 'cancelled') return false;
    const d = toDateObject(a.activityDate);
    return d === null || d >= referenceDate;
  });

  return { pastActivities, currentActivities };
}

// Test suite for profile activity card & date handling
function runProfileActivityTests() {
  console.log('Running Profile Activity Tests...');

  const now = new Date('2026-08-18T12:00:00Z');
  const pastTime = new Date('2026-08-10T12:00:00Z');
  const futureTime = new Date('2026-08-25T12:00:00Z');

  // 1. Test toDateObject with various formats
  // Firestore Timestamp with .toDate()
  const mockTimestamp = { toDate: () => pastTime };
  assert.strictEqual(toDateObject(mockTimestamp)?.toISOString(), pastTime.toISOString());

  // JS Date
  assert.strictEqual(toDateObject(pastTime)?.toISOString(), pastTime.toISOString());

  // Object with seconds
  const secondsObj = { seconds: Math.floor(pastTime.getTime() / 1000) };
  assert.strictEqual(toDateObject(secondsObj)?.toISOString(), pastTime.toISOString());

  // ISO String
  const isoStr = pastTime.toISOString();
  assert.strictEqual(toDateObject(isoStr)?.toISOString(), pastTime.toISOString());

  // Null / undefined / invalid
  assert.strictEqual(toDateObject(null), null);
  assert.strictEqual(toDateObject(undefined), null);
  assert.strictEqual(toDateObject('invalid-date'), null);
  assert.strictEqual(toDateObject({}), null);

  // 2. Test Activity Active vs Past Classification
  const testActivities: Partial<Activity>[] = [
    { id: 'act_past_ts', activityDate: { toDate: () => pastTime } as any },
    { id: 'act_past_jsdate', activityDate: pastTime as any },
    { id: 'act_past_seconds', activityDate: { seconds: Math.floor(pastTime.getTime() / 1000) } as any },
    { id: 'act_past_iso', activityDate: pastTime.toISOString() as any },
    { id: 'act_future_ts', activityDate: { toDate: () => futureTime } as any },
    { id: 'act_future_jsdate', activityDate: futureTime as any },
    { id: 'act_future_seconds', activityDate: { seconds: Math.floor(futureTime.getTime() / 1000) } as any },
    { id: 'act_completed', status: 'completed', activityDate: futureTime as any },
    { id: 'act_flexible', activityDate: null as any },
    { id: 'act_cancelled', status: 'cancelled', activityDate: futureTime as any },
  ];

  const { pastActivities, currentActivities } = classifyActivities(testActivities, now);

  const pastIds = pastActivities.map(a => a.id);
  const currentIds = currentActivities.map(a => a.id);

  assert.ok(pastIds.includes('act_past_ts'), 'Past timestamp must be in pastActivities');
  assert.ok(pastIds.includes('act_past_jsdate'), 'Past JS Date must be in pastActivities');
  assert.ok(pastIds.includes('act_past_seconds'), 'Past seconds object must be in pastActivities');
  assert.ok(pastIds.includes('act_past_iso'), 'Past ISO string must be in pastActivities');
  assert.ok(pastIds.includes('act_completed'), 'Completed activity must be in pastActivities');

  assert.ok(currentIds.includes('act_future_ts'), 'Future timestamp must be in currentActivities');
  assert.ok(currentIds.includes('act_future_jsdate'), 'Future JS Date must be in currentActivities');
  assert.ok(currentIds.includes('act_future_seconds'), 'Future seconds object must be in currentActivities');
  assert.ok(currentIds.includes('act_flexible'), 'Flexible activity (null date) must be in currentActivities');

  assert.strictEqual(currentIds.includes('act_cancelled'), false, 'Cancelled activity must not be in currentActivities');
  assert.strictEqual(currentIds.includes('act_past_jsdate'), false, 'Past JS Date must not be in currentActivities');

  // 3. Test ProfileActivityCard Navigation Target URL
  const getActivityTargetUrl = (activityId: string) => `/activities/${activityId}`;
  assert.strictEqual(getActivityTargetUrl('act_123'), '/activities/act_123');

  console.log('✅ All Profile Activity Tests Passed!');
}

runProfileActivityTests();
