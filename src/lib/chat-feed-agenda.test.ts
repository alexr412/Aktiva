import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase/firestore';
import type { Chat } from './types';
import { matchesChatSearch } from './chat-search';
import { formatActivityInvitation } from './activity-invitation';
import { normalizeFeedPreferences } from './feed-preferences';
import { needsLocationForRoute } from './location-gate-routes';

const dm = { participantIds: ['me', 'friend'], participantDetails: { me: { username: 'myself' }, friend: { username: 'Alex42' } } } as unknown as Chat;
test('person search matches the displayed username, with @, spaces and mixed case', () => {
  for (const term of ['alex', '@Alex42', '  ALEX42  ']) assert.equal(matchesChatSearch(dm, 'me', term), true);
  assert.equal(matchesChatSearch(dm, 'me', 'myself'), false);
  assert.equal(matchesChatSearch({ ...dm, participantDetails: undefined } as unknown as Chat, 'me', 'alex'), false);
});
test('activity search matches the place; blank search matches all chats', () => {
  const room = { ...dm, activityId: 'room', placeName: 'Zoo am Meer' };
  assert.equal(matchesChatSearch(room, 'me', 'Meer'), true);
  assert.equal(matchesChatSearch(room, 'me', 'alex'), false);
  assert.equal(matchesChatSearch(dm, 'me', ' '), true);
});
const stamp = (day: number, hour = 0) => Timestamp.fromDate(new Date(2026, 9, day, hour));
test('all-day invitation includes the date without a midnight start', () => {
  const text = formatActivityInvitation({ activityDate: stamp(5), activityEndDate: stamp(5, 23), isTimeFlexible: true }, 'Zoo', 3, 'de');
  assert.match(text, /5\. Okt\. 2026, ganztägig/);
  assert.doesNotMatch(text, /00:00/);
});
test('all-day ranges preserve both dates', () => {
  const text = formatActivityInvitation({ activityDate: stamp(5), activityEndDate: stamp(7, 23), isTimeFlexible: true }, 'Ausflug', 3, 'de');
  assert.match(text, /5\. Okt\. 2026 – 7\. Okt\. 2026, ganztägig/);
});
test('fixed ranges preserve the end time and English date labels', () => {
  const text = formatActivityInvitation({ activityDate: stamp(5, 14), activityEndDate: stamp(6, 18) }, 'Trip', -1, 'en');
  assert.match(text, /5 Oct 2026, 14:00 – 6 Oct 2026, 18:00/);
  assert.match(text, /0 spots left/);
});
test('missing activity dates do not produce invalid or empty date fragments', () => {
  assert.equal(formatActivityInvitation({}, 'Zoo', 2, 'de'), 'Komm dazu: Zoo. Noch 2 Plätze frei.');
});
test('preferences reject invalid sorting and unknown/duplicate category IDs', () => {
  assert.deepEqual(normalizeFeedPreferences({ sortBy: 'distance', hiddenCategoryIds: ['food', 'food', 'bad', 42] }, ['food']), { sortBy: 'distance', hiddenCategoryIds: ['food'] });
  assert.deepEqual(normalizeFeedPreferences({ sortBy: 'invalid', hiddenCategoryIds: {} }, ['food']), { sortBy: 'recommended', hiddenCategoryIds: [] });
  assert.deepEqual(normalizeFeedPreferences(null, ['food']), { sortBy: 'recommended', hiddenCategoryIds: [] });
});
test('chats and profiles work without geolocation; discovery still asks for an origin', () => {
  for (const path of ['/chat', '/chat/room', '/profile', '/profile/settings', '/settings', '/users/friend', '/onboarding']) assert.equal(needsLocationForRoute(path), false);
  for (const path of ['/', '/map', '/explore', '/chatty']) assert.equal(needsLocationForRoute(path), true);
});
