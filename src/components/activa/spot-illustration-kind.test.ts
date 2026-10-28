import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSpotIllustrationKind } from './spot-illustration-kind';
import { getSpotIllustrationArtwork } from './spot-illustration-artwork';
import { getSpotIllustrationSubject } from './spot-illustration-subject';

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

test('modern illustrations do not substitute unrelated sports or animal habitats', () => {
  assert.ok(getSpotIllustrationArtwork({name:'Hot Court Padel',categories:['sport.tennis']}));
  assert.ok(getSpotIllustrationArtwork({name:'Zoo am Meer',categories:['entertainment.zoo']}));
  assert.equal(getSpotIllustrationSubject({name:'Bremerhaven Boulder Club',categories:['sport.activity_park']}),'climbing');
  assert.equal(getSpotIllustrationSubject({name:'Tiergehege',categories:['entertainment.zoo']}),'deer');
  assert.equal(getSpotIllustrationSubject({name:'Am Spadener See',categories:['sport.minigolf']}),'minigolf');
});

test('park artwork does not replace beaches or restaurants with a park in their name', () => {
  assert.ok(getSpotIllustrationArtwork({name:'Bürgerpark',categories:['leisure.park']}));
  assert.equal(getSpotIllustrationSubject({name:'Weserstrand',categories:['beach']}),'beach');
  assert.equal(getSpotIllustrationSubject({name:'Bootshaus Bürgerpark',categories:['catering.restaurant']}),'food');
});
