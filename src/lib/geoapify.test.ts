import assert from 'node:assert';
import { test } from 'node:test';
import {
  buildCircleFilter,
  buildProximityBias,
  buildGeoapifyCategoriesParam,
  buildGeoapifyPlacesUrl,
  sanitizeUrlForLogging,
  safeFetchGeoapify,
} from './geoapify';

test('1. Circle filter construction', () => {
  const circle = buildCircleFilter(8.5222, 52.0261, 25000);
  assert.strictEqual(circle, 'filter=circle:8.5222,52.0261,25000');
});

test('2. Correct lon,lat order in circle filter and bias', () => {
  const lon = 8.522215;
  const lat = 52.026097;
  const filter = buildCircleFilter(lon, lat, 10000);
  const bias = buildProximityBias(lon, lat);

  assert.strictEqual(filter, `filter=circle:${lon},${lat},10000`);
  assert.strictEqual(bias, `bias=proximity:${lon},${lat}`);
  // Verify longitude comes first before latitude
  assert.ok(filter.indexOf(`${lon},${lat}`) > 0);
  assert.ok(bias.indexOf(`${lon},${lat}`) > 0);
});

test('3. Categories serialization (repeated parameters, no single comma-joined string)', () => {
  const arrayCats = ['catering', 'heritage'];
  const stringCats = 'entertainment.zoo,entertainment.cinema,entertainment.water_park';

  const serializedArray = buildGeoapifyCategoriesParam(arrayCats);
  const serializedString = buildGeoapifyCategoriesParam(stringCats);

  assert.strictEqual(serializedArray, 'categories=catering&categories=heritage');
  assert.strictEqual(
    serializedString,
    'categories=entertainment.zoo&categories=entertainment.cinema&categories=entertainment.water_park'
  );
  // Ensure no comma remains in the categories param string
  assert.strictEqual(serializedArray.includes('%2C'), false);
  assert.strictEqual(serializedString.includes('%2C'), false);
});

test('4. Radius parameter in URL', () => {
  const url = buildGeoapifyPlacesUrl({
    lat: 52.026,
    lon: 8.522,
    radiusMeters: 25000,
    apiKey: 'test-key',
  });
  assert.ok(url.includes('filter=circle:8.522,52.026,25000'));
});

test('5. Limit parameter in URL', () => {
  const url = buildGeoapifyPlacesUrl({
    lat: 52.026,
    lon: 8.522,
    radiusMeters: 10000,
    limit: 30,
    apiKey: 'test-key',
  });
  assert.ok(url.includes('limit=30'));
});

test('6. Offset parameter in URL', () => {
  const url = buildGeoapifyPlacesUrl({
    lat: 52.026,
    lon: 8.522,
    radiusMeters: 10000,
    offset: 50,
    apiKey: 'test-key',
  });
  assert.ok(url.includes('offset=50'));
});

test('7 & 8. Geoapify 400 response and response body processing', async () => {
  const mockErrorBody = JSON.stringify({
    statusCode: 400,
    error: 'Bad Request',
    message: 'Invalid parameters.',
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => mockErrorBody,
    } as Response;
  }) as typeof fetch;

  try {
    await safeFetchGeoapify('https://api.geoapify.com/v2/places?apiKey=secret_key_123');
    assert.fail('Expected safeFetchGeoapify to throw');
  } catch (err: any) {
    assert.strictEqual(err.status, 400);
    assert.ok(err.message.includes('400'));
    assert.ok(err.message.includes('Invalid parameters'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('9. API key is sanitized and not leaked in logs/URLs', () => {
  const secretKey = 'my_super_secret_api_key_999';
  const rawUrl = `https://api.geoapify.com/v2/places?categories=catering&apiKey=${secretKey}`;
  const sanitized = sanitizeUrlForLogging(rawUrl);

  assert.strictEqual(sanitized.includes(secretKey), false);
  assert.ok(sanitized.includes('apiKey=***'));
});

test('10. Successful request remains fully functional', async () => {
  const mockSuccessBody = {
    type: 'FeatureCollection',
    features: [
      {
        properties: {
          name: 'Test Place',
          place_id: '12345',
        },
      },
    ],
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => mockSuccessBody,
    } as Response;
  }) as typeof fetch;

  try {
    const data = await safeFetchGeoapify('https://api.geoapify.com/v2/places?apiKey=test_key');
    assert.strictEqual(data.type, 'FeatureCollection');
    assert.strictEqual(data.features.length, 1);
    assert.strictEqual(data.features[0].properties.name, 'Test Place');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('11. Regression test: multi-bucket categories generate valid repeated query parameters', () => {
  const bucket1 =
    'entertainment.zoo,entertainment.cinema,entertainment.water_park,sport.swimming_pool,entertainment.miniature_golf,entertainment.bowling_alley,entertainment.aquarium,entertainment.escape_game,entertainment.activity_park,entertainment.activity_park.trampoline,entertainment.amusement_arcade';
  const bucket2 = 'entertainment,leisure,adult.nightclub,sport,tourism';
  const bucket3 = 'catering,heritage';

  const url1 = buildGeoapifyPlacesUrl({ lat: 52.026, lon: 8.522, radiusMeters: 25000, categories: bucket1 });
  const url2 = buildGeoapifyPlacesUrl({ lat: 52.026, lon: 8.522, radiusMeters: 25000, categories: bucket2 });
  const url3 = buildGeoapifyPlacesUrl({ lat: 52.026, lon: 8.522, radiusMeters: 25000, categories: bucket3 });

  // Ensure no comma separator in categories query strings
  assert.strictEqual(url1.includes('categories=entertainment.zoo%2C'), false);
  assert.strictEqual(url1.includes('categories=entertainment.zoo,'), false);
  assert.ok(url1.includes('categories=entertainment.zoo&categories=entertainment.cinema'));

  assert.ok(url2.includes('categories=entertainment&categories=leisure'));
  assert.ok(url3.includes('categories=catering&categories=heritage'));
});
