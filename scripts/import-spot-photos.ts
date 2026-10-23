import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Reviewed venue/file pairs. Search results must never be assigned automatically.
const selections = [
  { name: 'Zoo am Meer', file: 'Ursus maritimus - Zoo am Meer - Bremerhaven 01.jpg', position: '50% 45%' },
  { name: 'Bürgerpark', file: 'Bürgerpark - Bremerhaven 02.jpg', position: '50% 50%' },
  { name: 'Klimahaus Bremerhaven', file: 'Klimahaus Bremerhaven 01.jpg', position: '50% 50%' },
  { name: 'Deutsches Auswandererhaus', file: 'Bremerhaven, Deutsches Auswandererhaus -- 2024 -- 2240.jpg', position: '50% 50%' },
  { name: 'Deutsches Schifffahrtsmuseum', file: 'Deutsches Schiffahrtsmuseum.jpg', position: '50% 50%' },
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
  const photos = selections.map(({ name, file, position }) => {
    const place = catalog.places.find((candidate: { name: string }) => candidate.name === name);
    const info = pages.find(page => page.title === `File:${file}`)?.imageinfo?.[0];
    const metadata = info?.extmetadata;
    const author = metadata?.Artist?.value?.replace(/<[^>]*>/g, '').trim();
    const license = metadata?.LicenseShortName?.value;
    const licenseUrl = metadata?.LicenseUrl?.value?.replace(/^http:\/\//, 'https://');
    if (!place || !info?.thumburl || !author || !/^CC BY(?:-SA)? [34]\.0$/.test(license ?? '') ||
      !licenseUrl?.startsWith('https://creativecommons.org/')) throw new Error(`Review incomplete photo metadata: ${name}`);
    const url = new URL(info.thumburl);
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname)) throw new Error('Unexpected image host');
    return {
      placeId: place.id, placeName: name, kind: 'venue', url: url.href,
      sourceUrl: info.descriptionurl, author, license, licenseUrl,
      capturedAt: metadata.DateTimeOriginal?.value ?? null,
      objectPosition: position,
    };
  });
  await writeFile(resolve('src/lib/spot-photos.json'), JSON.stringify({
    retrievedAt: new Date().toISOString(), provider: 'Wikimedia Commons', photos,
  }, null, 2) + '\n');
  console.log(`Imported ${photos.length} reviewed venue photos with attribution. No image binaries downloaded.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
