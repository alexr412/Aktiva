import assert from 'node:assert/strict';
import type { Activity } from '@/lib/types';
import { hasRoomActivityEnded } from './room-activity-state';

process.env.TZ = 'Europe/Berlin';

const room = (start: string, end?: string, flexible = true) => ({
  status: 'active', isTimeFlexible: flexible,
  activityDate: { toDate: () => new Date(start) },
  activityEndDate: end ? { toDate: () => new Date(end) } : undefined,
} as Activity);
const now = new Date('2026-10-06T15:00:00+02:00');
assert.equal(hasRoomActivityEnded(room('2026-10-06T00:00:00+02:00', '2026-10-06T23:59:59.999+02:00'), now), false);
assert.equal(hasRoomActivityEnded(room('2026-10-04T00:00:00+02:00', '2026-10-08T23:59:59.999+02:00'), now), false);
assert.equal(hasRoomActivityEnded(room('2026-10-05T00:00:00+02:00', '2026-10-05T23:59:59.999+02:00'), now), true);
assert.equal(hasRoomActivityEnded(room('2026-10-06T00:00:00+02:00'), now), false);
assert.equal(hasRoomActivityEnded(room('2026-10-05T00:00:00+02:00'), now), true);
assert.equal(hasRoomActivityEnded(room('2026-10-06T12:00:00+02:00', undefined, false), now), false);
assert.equal(hasRoomActivityEnded(room('2026-10-05T12:00:00+02:00', undefined, false), now), true);
assert.equal(hasRoomActivityEnded(room('2026-10-06T12:00:00+02:00', '2026-10-06T15:00:00+02:00', false), now), true);
assert.equal(hasRoomActivityEnded({ ...room('2026-10-08T00:00:00+02:00'), status: 'completed' }, now), true);
assert.equal(hasRoomActivityEnded(null, now), false);
for (const [start, before, after] of [
  ['2026-03-29T00:00:00+01:00', '2026-03-29T23:59:00+02:00', '2026-03-30T00:00:00+02:00'],
  ['2026-10-25T00:00:00+02:00', '2026-10-25T23:59:00+01:00', '2026-10-26T00:00:00+01:00'],
]) {
  assert.equal(hasRoomActivityEnded(room(start), new Date(before)), false);
  assert.equal(hasRoomActivityEnded(room(start), new Date(after)), true);
}
console.log('Room activity state: all-day, ranges, fixed times, legacy records and DST checks passed');
