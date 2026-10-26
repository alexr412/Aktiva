import assert from 'node:assert/strict';
import { test } from 'node:test';
import catalog from '../../data/spot-catalogs/bremerhaven-pilot.json';
import manifest from './spot-photos.json';
import { getSpotPhoto } from './spot-photos';

test('the active catalog contains only reviewed real venue photos with source and license metadata', () => {
  assert.ok(!('examples' in manifest));
  assert.equal(new Set(manifest.photos.map(photo => photo.placeId)).size, manifest.photos.length);
  for (const photo of manifest.photos) {
    assert.equal(photo.kind, 'venue');
    const place = catalog.places.find(place => place.id === photo.placeId);
    assert.ok(place || ['editorial-bremerhaven-tiergehege', 'editorial-bremerhaven-bad2'].includes(photo.placeId));
    assert.equal(getSpotPhoto({ id: photo.placeId })?.sourceUrl, photo.sourceUrl);
    assert.ok(['thumb.wikimedia.org', 'upload.wikimedia.org', 'img.destination.one', 'img.oastatic.com'].includes(new URL(photo.url).hostname));
    assert.equal(new URL(photo.url).protocol, 'https:');
    assert.ok(['commons.wikimedia.org', 'www.bremerhaven-erleben.de', 'www.outdooractive.com'].includes(new URL(photo.sourceUrl).hostname));
    assert.match(photo.license, /^CC BY(?:-SA)? [34]\.0(?: de)?$/);
    assert.equal(new URL(photo.licenseUrl).hostname, 'creativecommons.org');
    assert.ok(photo.author.trim());
    assert.ok(photo.title.trim());
    assert.ok(photo.match.radiusMeters <= 150);
  }
});

test('verified names and nearby venue coordinates resolve legacy IDs, without a category fallback', () => {
  for (const place of [
    { id: 'legacy-deer', name: 'Tiergehege', lat:53.541911, lon:8.602070 },
    { id: 'legacy-pool', name: 'BAD 2', lat:53.52219, lon:8.5961852 },
    { id: 'legacy-bowling', name: 'fun Bowling', lat:53.5794079, lon:8.5984379 },
    { id: 'legacy-cafe', name: 'Café Lieblingsplatz', lat:53.552279, lon:8.57219 },
  ]) assert.equal(getSpotPhoto(place)?.kind, 'venue', place.name);
  assert.equal(getSpotPhoto({ id:'unknown-cinema', name:'CineMotion', lat:53.54, lon:8.58 }), undefined);
});

test('same names in other cities, nearby different venues and missing or invalid coordinates never inherit a venue photo', () => {
  assert.equal(getSpotPhoto({ id:'other-city', name:'BAD 2', lat:48.137, lon:11.575 }), undefined);
  assert.equal(getSpotPhoto({ id:'nearby', name:'BAD 1', lat:53.52219, lon:8.5961852 }), undefined);
  assert.equal(getSpotPhoto({ id:'missing-coordinates', name:'BAD 2' }), undefined);
  assert.equal(getSpotPhoto({ id:'invalid-coordinates', name:'BAD 2', lat:NaN, lon:8.5961852 }), undefined);
  assert.equal(getSpotPhoto({ id:'unreviewed-venue' }), undefined);
  assert.equal(getSpotPhoto({ id:'buergerpark-bremen', name:'Bürgerpark', lat:53.08, lon:8.83 }), undefined);
});
