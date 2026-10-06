import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseLocalSearchIntent, normalizeSearchQuery } from './search-intent';

test('simple categories, synonym combinations and German decimal radius stay local', () => {
  assert.deepEqual(parseLocalSearchIntent('  KINO  ')?.categories, ['entertainment.cinema']);
  const combined = parseLocalSearchIntent('Museum oder Kino innerhalb von 2,5 km');
  assert.deepEqual(new Set(combined?.categories), new Set(['entertainment.museum', 'entertainment.cinema']));
  assert.equal(combined?.radiusKm, 2.5);
  assert.equal(parseLocalSearchIntent('Café in 500 m')?.radiusKm, 0.5);
  assert.deepEqual(parseLocalSearchIntent('theme park')?.categories, ['entertainment.theme_park']);
  assert.equal(normalizeSearchQuery('  ＫＩＮＯ   '), 'kino');
});
test('unsupported constraints, negations and conflicting/out-of-range distances are not silently ignored', () => {
  for (const query of ['kein Kino', 'Museum ohne Eintritt', 'Kino morgen', 'Kino in Berlin', 'Park in 200 km', 'Museum 5 km 10 km', 'Café 50 m']) {
    assert.equal(parseLocalSearchIntent(query), null, query);
  }
});
test('venue names do not match category substrings and can be looked up without AI', () => {
  for (const query of ['Cinestar', 'Parkhotel', 'Museumsinsel', 'Smiley’s']) {
    assert.equal(parseLocalSearchIntent(query)?.filterByName, true, query);
    assert.deepEqual(parseLocalSearchIntent(query)?.categories, []);
  }
  assert.equal(parseLocalSearchIntent('Zoo am Meer'), null);
});
