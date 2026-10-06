import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Timestamp } from 'firebase/firestore';
import type { Activity } from '@/lib/types';
import { getPlaceActivityPreview } from './place-activity-preview-model';

const now = new Date(2026, 9, 5, 15, 30);
const activity = {
  title: 'Zusammen spazieren', activityDate: Timestamp.fromDate(new Date(2026, 9, 5)),
  isTimeFlexible: true, hostId: 'alex', hostName: 'Alex Meyer', participantIds: ['alex', 'kim', 'kim'],
  participantDetails: { kim: { displayName: 'Kim' } }, maxParticipants: 4,
} as unknown as Activity;

test('today all-day activity does not display a past midnight time; host and duplicates count once', () => {
  assert.deepEqual(getPlaceActivityPreview(activity, 'de', now), {
    title: 'Zusammen spazieren', schedule: 'Heute · ganztägig', availability: '2 Plätze frei', initials: ['AM', 'K'],
  });
});
test('timed activity, flexible range and English labels', () => {
  const tomorrow = Timestamp.fromDate(new Date(2026, 9, 6, 14));
  assert.equal(getPlaceActivityPreview({ ...activity, activityDate: tomorrow, isTimeFlexible: false }, 'en', now).schedule, 'Tomorrow · 14:00');
  assert.equal(getPlaceActivityPreview({ ...activity, activityEndDate: tomorrow, isDateFlexible: true }, 'de', now).schedule, 'Heute – Morgen · ganztägig');
});
test('missing legacy metadata remains safe without invented names or capacity', () => {
  const preview = getPlaceActivityPreview({ ...activity, activityDate: undefined, participantDetails: undefined, participantsPreview: undefined, hostName: null, maxParticipants: undefined } as unknown as Activity, 'de', now);
  assert.equal(preview.schedule, 'Termin flexibel');
  assert.equal(preview.availability, 'Offene Gruppe');
  assert.deepEqual(preview.initials, []);
  assert.equal(getPlaceActivityPreview({ ...activity, maxParticipants: 1 }, 'de', now).availability, '0 Plätze frei');
});
