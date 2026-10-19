import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSpotIllustrationKind } from './spot-illustration-kind';

test('nightlife and leisure venues receive their own artwork', () => {
  assert.equal(getSpotIllustrationKind({name:'Kühlhouse',categories:['entertainment.nightclub']}),'music');
  assert.equal(getSpotIllustrationKind({name:'Am Spadener See',categories:['sport.minigolf']}),'minigolf');
  assert.equal(getSpotIllustrationKind({name:'Am Spadener See',categories:['entertainment.miniature_golf']}),'minigolf');
  assert.equal(getSpotIllustrationKind({name:'Beyond Bowling',categories:['entertainment.bowling_alley']}),'bowling');
  assert.equal(getSpotIllustrationKind({name:'Bar Karlsburg',categories:['catering.bar']}),'bar');
});
test('animal, water, food and culture venues keep distinct motifs', () => {
  assert.equal(getSpotIllustrationKind({name:'Tiergehege',categories:['entertainment.zoo']}),'deer');
  assert.equal(getSpotIllustrationKind({name:'Zoo am Meer',categories:['entertainment.zoo']}),'seal');
  assert.equal(getSpotIllustrationKind({name:'BAD 2',categories:[]}),'pool');
  assert.equal(getSpotIllustrationKind({name:'Bootshaus Bürgerpark',categories:['catering.restaurant']}),'food');
  assert.equal(getSpotIllustrationKind({name:'Deutsches Auswandererhaus',categories:['entertainment.museum']}),'culture');
});
test('unknown venues do not silently become parks', () => {
  assert.equal(getSpotIllustrationKind({name:'Neuer Treffpunkt',categories:[]}),'explore');
  assert.equal(getSpotIllustrationKind({name:'Bürgerpark',categories:['leisure.park']}),'park');
});
