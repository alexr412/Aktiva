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

// These depict the activity, never the venue. The UI must label every example.
const examples = [
  { key: 'deer', label: 'Tiergehege', file: 'Dama dama8.JPG' },
  { key: 'seal', label: 'Zoo und Aquarium', file: selections[0].file },
  { key: 'pool', label: 'Schwimmen', file: 'Karori swimming pool.jpg' },
  { key: 'bowling', label: 'Bowling', file: 'AMF bowling center.jpg' },
  { key: 'cinema', label: 'Kino', file: 'Auditorium at Maxim in May 2024.jpg' },
  { key: 'minigolf', label: 'Minigolf', file: 'Minigolf course at Hartvíkovická pláž camp near Hartvíkovice, Třebíč District.jpg' },
  { key: 'music', label: 'Musik und Ausgehen', file: 'The Den Nightclub Somerset New Jersey Dance Floor.jpg' },
  { key: 'coffee', label: 'Kaffee trinken', file: 'Espresso Coffee 01.jpg' },
  { key: 'bar', label: 'Bar und Pub', file: 'Sir Alexander Fleming pub interior, Paddington.jpg' },
  { key: 'billiards', label: 'Billard', file: 'Craigdarroch Castle Billiards Room.jpg' },
  { key: 'food', label: 'Essen gehen', file: 'DSCF0800 Quiet cafe nook framed by pink blossoms and lanterns overlooking a busy street beyond.jpg' },
  { key: 'culture', label: 'Museum', file: 'Oxford University Museum of Natural History, Oxford, UK - Diliff.jpg' },
  { key: 'park', label: 'Park', file: selections[1].file },
  { key: 'sport', label: 'Sport', file: 'Mejorset Full Panoramic Padel Court Delivered by SG Padel.jpg' },
  { key: 'padel', label: 'Padel', file: 'Mejorset Full Panoramic Padel Court Delivered by SG Padel.jpg' },
  { key: 'bouldering', label: 'Bouldern', file: 'Man climbing in bouldering gym.jpg' },
  { key: 'trampoline', label: 'Trampolinpark', file: 'Trampoline Park.jpg' },
  { key: 'escape', label: 'Escape Room', file: 'Escape Room - "The Expedition" (Escape Quest Bethesda).jpg' },
  { key: 'library', label: 'Bibliothek', file: 'Bookshelves in Hove Library 2025-08-20.jpg' },
  { key: 'skate', label: 'Skatepark', file: 'Bowl-Marseille2020-2.jpg' },
];

async function main() {
  const catalog = JSON.parse(await readFile(resolve('data/spot-catalogs/bremerhaven-pilot.json'), 'utf8'));
  const params = new URLSearchParams({
    action: 'query', format: 'json', prop: 'imageinfo',
    titles: [...new Set([...selections, ...examples].map(({ file }) => `File:${file}`))].join('|'),
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
    if (!info?.thumburl || !author || !/^(?:CC BY(?:-SA)? [34]\.0|CC0)$/.test(license ?? '') ||
      !licenseUrl?.startsWith('https://creativecommons.org/')) throw new Error(`Review incomplete photo metadata: ${file}`);
    const url = new URL(info.thumburl);
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(url.hostname)) throw new Error('Unexpected image host');
    return {
      url: url.href,
      sourceUrl: info.descriptionurl, author, license, licenseUrl,
      capturedAt: metadata.DateTimeOriginal?.value ?? null,
      objectPosition: position,
    };
  }
  const photos = selections.map(({ name, file, position }) => {
    const place = catalog.places.find((candidate: { name: string }) => candidate.name === name);
    if (!place) throw new Error(`Unknown catalog venue: ${name}`);
    return { placeId: place.id, placeName: name, kind: 'venue', ...imageMetadata(file, position) };
  });
  const examplePhotos = examples.map(({ key, label, file }) => ({
    exampleKind: key, placeId: `example:${key}`, placeName: label, kind: 'example', ...imageMetadata(file),
  }));
  await writeFile(resolve('src/lib/spot-photos.json'), JSON.stringify({
    retrievedAt: new Date().toISOString(), provider: 'Wikimedia Commons', photos, examples: examplePhotos,
  }, null, 2) + '\n');
  console.log(`Imported ${photos.length} venue photos and ${examplePhotos.length} labelled examples with attribution. No image binaries downloaded.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
