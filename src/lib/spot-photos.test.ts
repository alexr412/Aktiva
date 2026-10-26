import assert from 'node:assert/strict';
import { test } from 'node:test';
import catalog from '../../data/spot-catalogs/bremerhaven-pilot.json';
import manifest from './spot-photos.json';
import { getSpotPhoto } from './spot-photos';
import { getSpotPhotoKind } from '../components/activa/spot-photo-kind';

test('reviewed photos belong to the exact catalog venue and retain reusable license metadata', () => {
  assert.equal(new Set(manifest.photos.map(photo => photo.placeId)).size, manifest.photos.length);
  for (const photo of manifest.photos) {
    const place = catalog.places.find(place => place.id === photo.placeId);
    assert.equal(place?.name, photo.placeName);
    assert.equal(getSpotPhoto({ id: photo.placeId })?.sourceUrl, photo.sourceUrl);
    assert.ok(['thumb.wikimedia.org', 'upload.wikimedia.org'].includes(new URL(photo.url).hostname));
    assert.equal(new URL(photo.url).protocol, 'https:');
    assert.equal(new URL(photo.sourceUrl).hostname, 'commons.wikimedia.org');
    assert.match(photo.license, /^CC BY(?:-SA)? [34]\.0$/);
    assert.equal(new URL(photo.licenseUrl).hostname, 'creativecommons.org');
    assert.ok(photo.author.trim());
  }
});

test('unknown IDs and a same-name place in a different city never inherit venue photos', () => {
  assert.equal(getSpotPhoto({ id: 'unreviewed-venue' }), undefined);
  assert.equal(getSpotPhoto({ id: 'buergerpark-bremen' }), undefined);
});

test('real venue photos take priority and category fallbacks stay explicitly marked as examples', () => {
  assert.equal(getSpotPhoto({ id: manifest.photos[0].placeId }, 'bowling')?.kind, 'venue');
  assert.equal(new Set(manifest.examples.map(photo => photo.exampleKind)).size, manifest.examples.length);
  for (const photo of manifest.examples) {
    const fallback = getSpotPhoto({ id: 'unreviewed-place' }, photo.exampleKind);
    assert.equal(fallback?.kind, 'example');
    assert.equal(fallback?.url, photo.url);
    assert.match(photo.license, /^(?:CC BY(?:-SA)? [34]\.0|CC0)$/);
    assert.ok(photo.author.trim());
    assert.equal(new URL(photo.sourceUrl).hostname, 'commons.wikimedia.org');
    assert.equal(new URL(photo.licenseUrl).hostname, 'creativecommons.org');
    assert.ok(['thumb.wikimedia.org', 'upload.wikimedia.org'].includes(new URL(photo.url).hostname));
  }
  assert.equal(getSpotPhoto({ id: 'buergerpark-bremen' }, 'park')?.kind, 'example');
});

test('the pilot catalog and legacy cards from the reported screenshot all have appropriate photo coverage', () => {
  for (const place of catalog.places) {
    assert.ok(getSpotPhoto(place, getSpotPhotoKind(place)), `Missing photo for ${place.name}`);
  }
  for (const place of [
    { id: 'legacy-deer', name: 'Tiergehege', categories: ['entertainment.zoo'] },
    { id: 'legacy-pool', name: 'BAD 2', categories: ['sport.swimming_pool'] },
    { id: 'legacy-bowling', name: 'fun Bowling', categories: ['entertainment.bowling_alley'] },
  ]) assert.equal(getSpotPhoto(place, getSpotPhotoKind(place))?.kind, 'example');
  assert.equal(getSpotPhotoKind({ name: 'Bremerhaven Boulder Club', categories: ['sport'] }), 'bouldering');
  assert.equal(getSpotPhotoKind({ name: 'Hot Court Padel', categories: ['sport'] }), 'padel');
  assert.equal(getSpotPhotoKind({ name: 'Snooker’s', categories: ['catering.bar'] }), 'billiards');
});
