import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isFeedCategoryHidden, parseHiddenFeedCategories } from './feed-category-visibility';
import { sortFeedPlaces } from './feed-sort';

test('religion is excluded from a mixed feed even when tagged as an attraction too', () => {
  assert.equal(isFeedCategoryHidden(['tourism.sights', 'religion.place_of_worship.church'], ['religion']), true);
  assert.equal(isFeedCategoryHidden(['entertainment.museum'], ['religion']), false);
  assert.equal(isFeedCategoryHidden(['religion'], ['religion']), true);
});

test('exact category boundaries exclude descendants without matching sibling names', () => {
  assert.equal(isFeedCategoryHidden(['catering.restaurant.pizza'], ['catering.restaurant']), true);
  assert.equal(isFeedCategoryHidden(['catering.fast_food'], ['catering.restaurant']), false);
  assert.equal(isFeedCategoryHidden(['entertainment.museum_shop'], ['entertainment.museum']), false);
  assert.equal(isFeedCategoryHidden([], ['religion']), false);
});

test('several hidden categories apply before both sorts and pagination, then can be restored', () => {
  const input = [
    { id: 'church', categories: ['religion.place_of_worship'], distance: 0.1, relevanceScore: 99 },
    { id: 'museum', categories: ['entertainment.museum.art'], distance: 0.2, relevanceScore: 80 },
    { id: 'park', categories: ['leisure.park'], distance: 1, relevanceScore: 60 },
    { id: 'cinema', categories: ['entertainment.cinema'], distance: 2, relevanceScore: 70 },
  ];
  const visible = input.filter(place => !isFeedCategoryHidden(place.categories, ['religion', 'entertainment.museum']));
  assert.deepEqual(sortFeedPlaces(visible, 'distance').slice(0, 1).map(place => place.id), ['park']);
  assert.deepEqual(sortFeedPlaces(visible, 'recommended').slice(0, 1).map(place => place.id), ['cinema']);
  assert.equal(input.filter(place => !isFeedCategoryHidden(place.categories, [])).length, 4);
  assert.equal(input.length, 4);
});

test('stored preferences keep known IDs only, deduplicate and recover from invalid storage', () => {
  const known = ['Religion', 'Museums', 'Restaurants'];
  assert.deepEqual(parseHiddenFeedCategories('["Religion","Religion",null,123,"Unknown","Restaurants"]', known), ['Religion', 'Restaurants']);
  for (const invalid of [null, '', '{', '{}', 'null', '"Religion"']) {
    assert.deepEqual(parseHiddenFeedCategories(invalid, known), []);
  }
});
