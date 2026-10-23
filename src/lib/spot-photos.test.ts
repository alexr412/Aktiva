import assert from 'node:assert/strict';
import { test } from 'node:test';
import catalog from '../../data/spot-catalogs/bremerhaven-pilot.json';
import manifest from './spot-photos.json';
import { getSpotPhoto } from './spot-photos';

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
