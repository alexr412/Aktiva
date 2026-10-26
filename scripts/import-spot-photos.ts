import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { SpotPhoto } from '../src/lib/spot-photos';

// Reviewed venue/file pairs. Search results must never be assigned automatically.
const selections = [
  { name: 'Zoo am Meer', file: 'Ursus maritimus - Zoo am Meer - Bremerhaven 01.jpg', position: '50% 45%' },
  { name: 'Bürgerpark', file: 'Bürgerpark - Bremerhaven 02.jpg', position: '50% 50%' },
  { name: 'Klimahaus Bremerhaven', file: 'Klimahaus Bremerhaven 01.jpg', position: '50% 50%' },
  { name: 'Deutsches Auswandererhaus', file: 'Bremerhaven, Deutsches Auswandererhaus -- 2024 -- 2240.jpg', position: '50% 50%' },
  { name: 'Deutsches Schifffahrtsmuseum', file: 'Deutsches Schiffahrtsmuseum.jpg', position: '50% 50%' },
  { name: 'Beyond Bowling (ehemals Fun Bowling)', file: 'Bowlingcenter Bremerhaven.JPG', position: '50% 50%', aliases: ['fun Bowling', 'Beyond Bowling'], caption: 'Außenaufnahme von 2017, vor dem Umbau zu Beyond Bowling.' },
  { name: 'Speckenbütteler Park', file: 'Bhv-park-allee hg.jpg', position: '50% 50%' },
  { name: 'Thieles Garten', file: 'Bremerhaven Thiele 1.jpg', position: '50% 50%' },
  { name: 'Villa Seebeck', file: 'Seebeck Villa Geeste.JPG', position: '50% 50%' },
];

async function main() {
  const catalog = JSON.parse(await readFile(resolve('data/spot-catalogs/bremerhaven-pilot.json'), 'utf8'));
  const params = new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo',
    titles: selections.map(({ file }) => `File:${file}`).join('|'),
    iiprop: 'url|extmetadata', iiurlwidth: '640',
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'AktivaPhotoPilot/1.0 (https://github.com/alexr412/Aktiva)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Commons returned HTTP ${response.status}`);
  const data = await response.json();
  const pages = Object.values(data.query?.pages ?? {}) as any[];
  function imageMetadata(file: string, position = '50% 50%') {
    const info = pages.find(page => page.title === `File:${file}`)?.imageinfo?.[0];
    const metadata = info?.extmetadata;
    const author = metadata?.Artist?.value?.replace(/<[^>]*>/g, '').trim();
    const license = metadata?.LicenseShortName?.value;
    const licenseUrl = metadata?.LicenseUrl?.value?.replace(/^http:\/\//, 'https://');
    if (!info?.thumburl || !author || !/^CC BY(?:-SA)? [34]\.0(?: de)?$/.test(license ?? '') ||
      !licenseUrl?.startsWith('https://creativecommons.org/')) throw new Error(`Review incomplete photo metadata: ${file}`);
    const url = new URL(info.thumburl);
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname)) throw new Error('Unexpected image host');
    return {
      url: url.href,
      provider: 'Wikimedia Commons', title: file,
      sourceUrl: info.descriptionurl, author, license, licenseUrl,
      capturedAt: metadata.DateTimeOriginal?.value ?? null,
      objectPosition: position,
    };
  }
  const photos: SpotPhoto[] = selections.map(({ name, file, position, aliases, caption }): SpotPhoto => {
    const place = catalog.places.find((candidate: { name: string }) => candidate.name === name);
    if (!place) throw new Error(`Unknown catalog venue: ${name}`);
    return { placeId: place.id, placeName: name, kind: 'venue', ...imageMetadata(file, position),
      match: { names: [name, ...(aliases ?? [])], lat: place.lat, lon: place.lon, radiusMeters: 150 },
      ...(caption ? { caption } : {}),
    };
  });
  const editorial = JSON.parse(await readFile(resolve('data/spot-catalogs/bremerhaven-venue-photo-sources.json'), 'utf8'));
  for (const source of editorial) {
    const place = catalog.places.find((candidate: { name: string }) => candidate.name === source.catalogName);
    if (!source.licenseEvidence || source.license !== 'CC BY 4.0' || !source.author ||
      !['img.destination.one', 'img.oastatic.com'].includes(new URL(source.url).hostname) ||
      !['www.bremerhaven-erleben.de', 'www.outdooractive.com'].includes(new URL(source.sourceUrl).hostname)) throw new Error('Unreviewed editorial source');
    photos.push({ placeId: place?.id ?? source.placeId, placeName: source.placeName, kind: 'venue',
      url: source.url, sourceUrl: source.sourceUrl, provider: source.provider, author: source.author,
      title: source.title, alt: source.alt, license: source.license, licenseUrl: source.licenseUrl,
      capturedAt: null, objectPosition: source.objectPosition,
      match: { names: source.names, lat: source.lat, lon: source.lon, radiusMeters: 150 },
      ...(source.caption ? { caption: source.caption } : {}),
    });
  }
  await writeFile(resolve('src/lib/spot-photos.json'), JSON.stringify({
    retrievedAt: new Date().toISOString(), provider: 'Reviewed venue sources', photos,
  }, null, 2) + '\n');
  console.log(`Imported ${photos.length} verified venue photos. No generic examples or image binaries downloaded.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
