import assert from 'node:assert/strict';
import { test } from 'node:test';
import catalog from '../../../data/spot-catalogs/bremerhaven-pilot.json';
import { getSpotIllustrationSubject } from './spot-illustration-subject';
import { getSpotIllustrationArtwork } from './spot-illustration-artwork';

test('distinct leisure activities get their own subjects despite shared parent tags', () => {
  const cases = [
    ["Snooker's", ['catering.bar'], 'billiards'],
    ["Kim's Karaoke Bar", ['catering.bar'], 'karaoke'],
    ['One Up Game Bar', ['catering.bar'], 'boardgames'],
    ['Karlsburg', ['catering.bar'], 'bar'],
    ['Bremerhaven Boulder Club', ['entertainment.activity_park', 'entertainment.activity_park.climbing', 'sport'], 'climbing'],
    ['JUMPIN', ['entertainment.activity_park.trampoline'], 'trampoline'],
    ['EXIT', ['entertainment.escape_game'], 'escape'],
    ['Rollsportanlage am Bürgerpark', ['sport.sports_centre'], 'skatepark'],
    ['BMX-Park', ['sport.pitch'], 'skatepark'],
    ['Stadtbibliothek', ['education.library'], 'library'],
    ['Toddy\'s Eis', ['catering.cafe', 'catering.ice_cream'], 'icecream'],
    ['Kühlhouse', ['adult.nightclub'], 'nightclub'],
  ] as const;
  for (const [name, categories, subject] of cases) {
    assert.equal(getSpotIllustrationSubject({name,categories:[...categories]}),subject,name);
  }
});

test('common sports and outdoor tags never inherit the padel or park scene incorrectly', () => {
  const cases = [
    ['sport.tennis', 'tennis'], ['sport.soccer', 'football'], ['sport.basketball', 'basketball'],
    ['sport.fitness', 'fitness'], ['sport.padel', 'padel'], ['beach', 'beach'],
    ['camping.camp_site', 'camping'], ['activity.hiking', 'hiking'], ['activity.cycling', 'cycling'],
    ['leisure.playground', 'playground'], ['leisure.spa', 'wellness'], ['entertainment.aquarium', 'aquarium'],
    ['commercial.shopping_mall', 'shopping'], ['tourism.sights', 'sightseeing'],
  ];
  for (const [category,subject] of cases) {
    assert.equal(getSpotIllustrationSubject({name:'Treffpunkt',categories:[category]}),subject,category);
  }
});

test('all 75 pilot venues have a specific modern illustration without changing their data', () => {
  const before = JSON.stringify(catalog);
  for (const place of catalog.places) {
    assert.notEqual(getSpotIllustrationSubject(place),'community',place.name);
    assert.match(getSpotIllustrationArtwork(place)!.src,/^\/assets\/spot-illustrations\/modern-v[456]\//,place.name);
  }
  assert.equal(JSON.stringify(catalog),before);
});

test('specific names and subtags beat general catering, sport and park categories', () => {
  const cases = [
    ["Käpt'n Sushi", ['catering', 'catering.restaurant', 'catering.restaurant.asian'], 'sushi'],
    ['Dat Fischhus', ['catering.restaurant', 'catering.restaurant.fish'], 'fish'],
    ['B Burger Bar', ['catering.restaurant', 'catering.restaurant.burger'], 'fastfood'],
    ['Pizzeria am Park', ['catering.restaurant', 'leisure.park'], 'pizza'],
    ['Biergarten am See', ['catering.restaurant', 'natural.water'], 'biergarten'],
    ['Treffpunkt', ['catering.cafe', 'catering.cafe.ice_cream'], 'icecream'],
    ['Treffpunkt', ['catering.cafe', 'commercial.food_and_drink.bakery'], 'bakery'],
    ['Freizeitpark', ['entertainment.theme_park', 'leisure.park'], 'themepark'],
    ['Treffpunkt', ['entertainment.activity_park', 'entertainment.activity_park.climbing'], 'climbing'],
    ['Treffpunkt', ['entertainment.activity_park'], 'activitypark'],
    ['Kunsthalle', ['entertainment.culture', 'entertainment.culture.gallery'], 'gallery'],
    ['Treffpunkt', ['leisure.park', 'natural.water'], 'lake'],
    ['Treffpunkt', ['tourism.attraction', 'tourism.attraction.viewpoint'], 'viewpoint'],
    ['Treffpunkt', ['education.university'], 'study'],
    ['Treffpunkt', ['office.coworking'], 'coworking'],
    ['Treffpunkt', ['leisure.ice_rink'], 'iceskating'],
    ['Treffpunkt', ['entertainment.planetarium'], 'planetarium'],
    ['Treffpunkt', ['leisure.park', 'pet.dog_park'], 'dogwalking'],
  ] as const;
  for (const [name, categories, subject] of cases) {
    for (const tags of [[...categories], [...categories].reverse(), [...categories, ...categories, 'wheelchair.yes', 'internet_access.free', 'dogs.yes']]) {
      assert.equal(getSpotIllustrationSubject({ name, categories: tags }), subject, `${name}: ${tags.join(',')}`);
    }
  }
});

test('German activity names and manually supplied activity categories are supported', () => {
  const cases = [
    ['Kaffee trinken', 'coffee'], ['Tanzen', 'nightclub'], ['Gemeinsam kochen', 'cooking'],
    ['Backen', 'baking'], ['Fotowalk', 'photography'], ['Malen', 'painting'],
    ['Lauftreff', 'running'], ['Hunderunde', 'dogwalking'], ['Konzert', 'concert'],
    ['Festival', 'festival'], ['Stand-up Comedy', 'comedy'], ['Reisen', 'travel'],
  ] as const;
  for (const [name, subject] of cases) assert.equal(getSpotIllustrationSubject({name,categories:[]}),subject,name);
  assert.equal(getSpotIllustrationSubject({ name: 'Treffpunkt', categories: ['outdoor'], category: 'running' }), 'running');
  assert.equal(getSpotIllustrationSubject({ name: 'Treffpunkt', categories: [], normalizedCategory: 'cooking' }), 'cooking');
});

test('ambiguous place names do not turn restaurants into landscapes or cultural venues', () => {
  for (const name of ['Restaurant am See', 'Restaurant Bürgerpark', 'Museumscafé', 'Café am Theater']) {
    const categories = name.includes('Restaurant') ? ['catering.restaurant'] : ['catering.cafe'];
    assert.equal(getSpotIllustrationSubject({ name, categories }), name.includes('Restaurant') ? 'food' : 'coffee', name);
  }
  assert.equal(getSpotIllustrationSubject({name:'Burgermeister Schmitzz',categories:['catering.restaurant']}),'fastfood');
  assert.equal(getSpotIllustrationSubject({name:'Bürgerpark',categories:['leisure.park']}),'park');
});

test('venue tags override ambiguous names and optional metadata does not choose the activity', () => {
  assert.equal(getSpotIllustrationSubject({name:'Bootshaus Bürgerpark',categories:['catering.restaurant']}),'food');
  assert.equal(getSpotIllustrationSubject({name:'Museumscafé',categories:['catering.cafe']}),'coffee');
  assert.equal(getSpotIllustrationSubject({name:'Cafe de Fiets',categories:['catering.pub']}),'bar');
  const base={name:'Neuer Treffpunkt',categories:[]};
  assert.equal(getSpotIllustrationSubject(base),'community');
  assert.equal(getSpotIllustrationSubject({...base,categories:['wheelchair.yes','fee.no','internet_access.free','vegetarian.only']}),'community');
});
