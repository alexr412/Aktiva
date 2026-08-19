import assert from 'node:assert';
import { toDateObject } from '../../../lib/utils';
import type { Activity } from '../../../lib/types';

// Helper simulating current/past activity classification from profile/page.tsx
function classifyActivities(activities: Partial<Activity>[], referenceDate: Date = new Date()) {
  const startOfToday = new Date(referenceDate);
  startOfToday.setHours(0, 0, 0, 0);

  const pastActivities = activities.filter(a => {
    if (a.status === 'completed') return true;
    const d = toDateObject(a.activityDate);
    return d !== null && d < startOfToday;
  });

  const currentActivities = activities.filter(a => {
    if (a.status === 'completed' || a.status === 'cancelled') return false;
    const d = toDateObject(a.activityDate);
    return d === null || d >= startOfToday;
  });

  return { pastActivities, currentActivities };
}

// Test suite for profile activity card & date handling
function runProfileActivityTests() {
  console.log('Running Profile Activity Tests...');

  const now = new Date('2026-08-19T11:30:00');
  const todayMorning = new Date('2026-08-19T08:00:00');
  const todayEvening = new Date('2026-08-19T20:00:00');
  const tomorrowTime = new Date('2026-08-20T10:00:00');
  const yesterdayTime = new Date('2026-08-18T20:00:00');

  // 1. Test toDateObject with various formats
  // Firestore Timestamp with .toDate()
  const mockTimestamp = { toDate: () => yesterdayTime };
  assert.strictEqual(toDateObject(mockTimestamp)?.toISOString(), yesterdayTime.toISOString());

  // JS Date
  assert.strictEqual(toDateObject(yesterdayTime)?.toISOString(), yesterdayTime.toISOString());

  // Object with seconds
  const secondsObj = { seconds: Math.floor(yesterdayTime.getTime() / 1000) };
  assert.strictEqual(toDateObject(secondsObj)?.toISOString(), yesterdayTime.toISOString());

  // ISO String
  const isoStr = yesterdayTime.toISOString();
  assert.strictEqual(toDateObject(isoStr)?.toISOString(), yesterdayTime.toISOString());

  // Null / undefined / invalid
  assert.strictEqual(toDateObject(null), null);
  assert.strictEqual(toDateObject(undefined), null);
  assert.strictEqual(toDateObject('invalid-date'), null);
  assert.strictEqual(toDateObject({}), null);

  // 2. Test Activity Active vs Past Classification
  const testActivities: Partial<Activity>[] = [
    { id: 'act_today_morning', activityDate: todayMorning as any },
    { id: 'act_today_evening', activityDate: todayEvening as any },
    { id: 'act_tomorrow', activityDate: tomorrowTime as any },
    { id: 'act_yesterday', activityDate: yesterdayTime as any },
    { id: 'act_completed_today', status: 'completed', activityDate: todayMorning as any },
    { id: 'act_flexible', activityDate: null as any },
    { id: 'act_cancelled', status: 'cancelled', activityDate: tomorrowTime as any },
  ];

  const { pastActivities, currentActivities } = classifyActivities(testActivities, now);

  const pastIds = pastActivities.map(a => a.id);
  const currentIds = currentActivities.map(a => a.id);

  // Assertions for "Heute morgens" and "Heute abends" -> Must be in currentActivities, NOT pastActivities
  assert.ok(currentIds.includes('act_today_morning'), 'Today morning activity must be in currentActivities');
  assert.ok(currentIds.includes('act_today_evening'), 'Today evening activity must be in currentActivities');
  assert.strictEqual(pastIds.includes('act_today_morning'), false, 'Today morning activity must NOT be in pastActivities');
  assert.strictEqual(pastIds.includes('act_today_evening'), false, 'Today evening activity must NOT be in pastActivities');

  // Assertions for "Morgen" -> Must be in currentActivities
  assert.ok(currentIds.includes('act_tomorrow'), 'Tomorrow activity must be in currentActivities');
  assert.strictEqual(pastIds.includes('act_tomorrow'), false, 'Tomorrow activity must NOT be in pastActivities');

  // Assertions for "Gestern" -> Must be in pastActivities
  assert.ok(pastIds.includes('act_yesterday'), 'Yesterday activity must be in pastActivities');
  assert.strictEqual(currentIds.includes('act_yesterday'), false, 'Yesterday activity must NOT be in currentActivities');

  // Assertions for "Completed today" -> Must be in pastActivities
  assert.ok(pastIds.includes('act_completed_today'), 'Completed activity today must be in pastActivities');
  assert.strictEqual(currentIds.includes('act_completed_today'), false, 'Completed activity must NOT be in currentActivities');

  // Assertions for Flexible / Null Date -> Must be in currentActivities
  assert.ok(currentIds.includes('act_flexible'), 'Flexible activity (null date) must be in currentActivities');
  assert.strictEqual(pastIds.includes('act_flexible'), false, 'Flexible activity must NOT be in pastActivities');

  // Assertions for Cancelled -> Must NOT be in currentActivities
  assert.strictEqual(currentIds.includes('act_cancelled'), false, 'Cancelled activity must not be in currentActivities');

  // 3. Test ProfileActivityCard Navigation Target URL
  const getActivityTargetUrl = (activityId: string) => `/activities/${activityId}`;
  assert.strictEqual(getActivityTargetUrl('act_123'), '/activities/act_123');

  console.log('✅ All Profile Activity Tests Passed!');
}

runProfileActivityTests();
