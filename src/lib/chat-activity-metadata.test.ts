import assert from 'node:assert/strict';
import type { Activity, Chat } from './types';
import { hydrateActivityChatMetadata } from './chat-activity-metadata';

async function main() {
  const legacy = { id: 'room', activityId: 'room', participantIds: ['host'], participantDetails: {} } as Chat;
  const activity = { title: 'Tiergehege', placeId: 'provider-place', placeCategories: ['entertainment.zoo'], creationSource: 'place_activity' } as Partial<Activity>;
  const fixed = await hydrateActivityChatMetadata(legacy, async () => activity);
  assert.equal(fixed.placeName, 'Tiergehege');
  assert.deepEqual(fixed.placeCategories, ['entertainment.zoo']);
  assert.equal(fixed.creationSource, 'place_activity');
  assert.strictEqual(fixed.participantIds, legacy.participantIds);
  assert.strictEqual(fixed.participantDetails, legacy.participantDetails);
  let reads = 0;
  const reader = async () => { reads++; return activity; };
  assert.strictEqual(await hydrateActivityChatMetadata(fixed, reader), fixed);
  const direct = { ...legacy, activityId: undefined };
  assert.strictEqual(await hydrateActivityChatMetadata(direct, reader), direct);
  assert.equal(reads, 0);
  assert.strictEqual(await hydrateActivityChatMetadata(legacy, async () => null), legacy);
  const custom = await hydrateActivityChatMetadata(legacy, async () => ({ title: 'Spieleabend', category: 'Gaming', isCustomActivity: true }));
  assert.equal(custom.placeName, 'Spieleabend');
  assert.equal(custom.creationSource, 'community');
  assert.deepEqual(custom.categories, ['Gaming']);
  assert.deepEqual(custom.placeCategories, []);
  const named = await hydrateActivityChatMetadata({ ...legacy, placeName: 'Eigener Name' }, async () => activity);
  assert.equal(named.placeName, 'Eigener Name');
  console.log('Chat display metadata: legacy, complete, direct, missing and custom activity checks passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
