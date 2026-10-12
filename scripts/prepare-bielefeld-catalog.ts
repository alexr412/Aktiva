import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { calculateDistanceKm } from '../src/lib/geo-utils';
import { prepareSpotCatalog } from './spot-catalog-publish';
import type { CatalogSpot } from '../src/lib/spot-catalog';

// A bounded, local draft import. No Firebase access and no popularity claims.
const output = resolve('data/spot-catalogs');
const cityArgument = process.argv.indexOf('--city');
const cityId = cityArgument < 0 ? 'bielefeld' : process.argv[cityArgument + 1];
const cityNames: Record<string, string> = { bielefeld: 'Bielefeld', bremerhaven: 'Bremerhaven' };
const cityName = cityNames[cityId];
const buckets = [
  { key: 'outdoor', label: 'Parks und draußen', categories: 'leisure.park,leisure.picnic', take: 40 },
  { key: 'sport-specific', label: 'Sport und Bewegung', categories: 'sport.fitness,sport.sports_centre,sport.swimming_pool,sport.pitch,sport.skateboard,sport.sports_hall', take: 60 },
  { key: 'cafe', label: 'Cafés', categories: 'catering.cafe', take: 75 },
  { key: 'night', label: 'Bars und Pubs', categories: 'catering.bar,catering.pub', take: 40 },
  { key: 'culture-specific', label: 'Kultur und Freizeit', categories: 'entertainment.cinema,entertainment.culture,entertainment.museum,entertainment.bowling_alley,entertainment.escape_game,entertainment.activity_park,education.library', take: 35 },
];
const refresh = process.argv.includes('--refresh');
let requests = 0;

async function cachedRequest(label: string, path: string, parameters: Record<string, string>) {
  const cachePath = resolve(output, `${cityId}-source-${label}.json`);
  if (!refresh) {
    try { return JSON.parse(await readFile(cachePath, 'utf8')); }
    catch (error: any) { if (error.code !== 'ENOENT') throw new Error(`Cannot read source cache ${label}.`); }
  }
  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
  if (!apiKey) throw new Error('NEXT_PUBLIC_GEOAPIFY_API_KEY is required in the local environment.');
  if (++requests > 6) throw new Error('Import request limit reached.');
  const url = new URL(path, 'https://api.geoapify.com');
  Object.entries({ ...parameters, apiKey }).forEach(([key, value]) => url.searchParams.set(key, value));
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(30_000) }); }
  catch { throw new Error(`Geoapify request failed (${label}); no credentials logged.`); }
  if (!response.ok) throw new Error(`Geoapify returned HTTP ${response.status} (${label}).`);
  const data = await response.json();
  // Persist public place fields only. No request URL, API key or contact details.
  const cache = label === 'city' ? {
    retrievedAt: new Date().toISOString(),
    results: data.results?.map((p: any) => ({ name: p.city ?? p.name, lat: p.lat, lon: p.lon, place_id: p.place_id, country_code: p.country_code, result_type: p.result_type })),
  } : {
    retrievedAt: new Date().toISOString(),
    features: data.features?.map((f: any) => {
      const p = f.properties ?? {};
      return { properties: {
        place_id: p.place_id, name: p.name, formatted: p.formatted,
        lat: p.lat, lon: p.lon, categories: p.categories,
        opening_hours: p.opening_hours ?? p.datasource?.raw?.opening_hours,
        access: p.datasource?.raw?.access,
      } };
    }),
  };
  await writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n', 'utf8');
  return cache;
}

const escape = (value: string) => value.replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
async function main() {
  if (cityId !== 'bielefeld' && cityId !== 'bremerhaven') throw new Error('--city must be bielefeld or bremerhaven.');
  await mkdir(output, { recursive: true });
  const citySource = await cachedRequest('city', '/v1/geocode/search', { text: `${cityName}, Deutschland`, format: 'json', limit: '1', lang: 'de', filter: 'countrycode:de' });
  const city = citySource.results?.[0];
  if (!city?.place_id || city.country_code !== 'de' || city.name !== cityName || !Number.isFinite(city.lat) || !Number.isFinite(city.lon)) throw new Error(`${cityName} city boundary could not be verified.`);
  const places: CatalogSpot[] = [];
  const sections: string[] = [];
  const rejected: { name: string; reason: string }[] = [];
  const sources: { bucket: string; retrievedAt: string; returned: number; selected: number }[] = [];
  const ids = new Set<string>();
  for (const bucket of buckets) {
    const source = await cachedRequest(bucket.key, '/v2/places', {
      categories: bucket.categories, filter: `place:${city.place_id}`,
      bias: `proximity:${city.lon},${city.lat}`, limit: '100', lang: 'de',
    });
    if (!Array.isArray(source.features)) throw new Error(`Invalid source response (${bucket.key}).`);
    const chosen: CatalogSpot[] = [];
    for (const feature of source.features) {
      const p = feature.properties;
      const name = typeof p.name === 'string' ? p.name.trim() : '';
      const distance = calculateDistanceKm(city.lat, city.lon, p.lat, p.lon);
      let reason = '';
      if (!name || !p.place_id || !Array.isArray(p.categories) || !p.categories.length || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) reason = 'Name/ID/Kategorien/Koordinaten fehlen';
      else if (['private', 'no'].includes(p.access)) reason = 'Zugang laut Quelle eingeschränkt';
      else if (bucket.key === 'sport-specific' && /gymnasium|berufskolleg/i.test(name)) reason = 'Schulangebot ohne bestätigten öffentlichen Zugang';
      else if (bucket.key === 'culture-specific' && /archiv/i.test(name)) reason = 'Archiv statt Treffpunkt';
      else if (distance === null || distance > 20) reason = 'Außerhalb des Pilot-Radius';
      else if (ids.has(p.place_id)) reason = 'Gleiche Quellen-ID bereits enthalten';
      else if (places.some(other => other.name.toLocaleLowerCase('de') === name.toLocaleLowerCase('de') && (calculateDistanceKm(other.lat, other.lon, p.lat, p.lon) ?? Infinity) < 0.04)) reason = 'Gleicher Name innerhalb von 40 m';
      else if (chosen.length >= bucket.take) reason = 'Kategorie-Limit für ausgewogenen Pilot erreicht';
      if (reason) { rejected.push({ name: name || '(ohne Namen)', reason }); continue; }
      const spot: CatalogSpot = { id: p.place_id, name, address: p.formatted ?? '', lat: p.lat, lon: p.lon, categories: [...new Set<string>(p.categories)].sort() };
      if (typeof p.opening_hours === 'string') spot.openingHours = p.opening_hours;
      ids.add(spot.id); places.push(spot); chosen.push(spot);
    }
    sources.push({ bucket: bucket.key, retrievedAt: source.retrievedAt, returned: source.features.length, selected: chosen.length });
    sections.push(`## ${bucket.label} (${chosen.length})\n\n| Spot | Adresse | Öffnungszeiten laut Quelle | Karte |\n| --- | --- | --- | --- |\n` + chosen.map(p => `| ${escape(p.name)} | ${escape(p.address)} | ${escape(p.openingHours ?? 'fehlen – prüfen')} | [OSM](https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}) |`).join('\n'));
    console.log(`${bucket.key}: ${chosen.length} selected from ${source.features.length}`);
  }
  if (!places.length) throw new Error('No valid named spots found.');
  const catalog = { cityId, name: cityName, lat: city.lat, lon: city.lon, radiusMeters: 20_000, places };
  const prepared = prepareSpotCatalog(catalog);
  await writeFile(resolve(output, `${cityId}.json`), JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  await writeFile(resolve(output, `${cityId}-import-report.json`), JSON.stringify({ status: 'draft', cityId, sources, requests, rejected, version: prepared.city.version, pages: prepared.pages.length }, null, 2) + '\n', 'utf8');
  const review = `# ${cityName}: Spot-Vorschläge für den Pilot\n\nStatus: **Entwurf, nicht veröffentlicht**. ${places.length} benannte Orte, ${prepared.pages.length} Katalogseite(n).\n\nQuelle: [Geoapify Places API](https://www.geoapify.com/places-api/) auf Basis von [OpenStreetMap-Mitwirkenden, ODbL](https://www.openstreetmap.org/copyright). Abfragen auf die von Geoapify gelieferte Stadtgrenze von ${cityName} beschränkt. Die Auswahl ist nach Entfernung zum Stadtzentrum und Kategorie begrenzt, keine Beliebtheitsrangliste und kein vollständiges Verzeichnis. Der Katalog dient der Vorschlagsanzeige im 20-km-Pilotgebiet, enthält aber nur Orte innerhalb der Stadtgrenze; Randgebiete und Nachbarstädte werden nicht vollständig abgedeckt.\n\nVor Veröffentlichung bitte die Auswahl auf Eignung für Treffen, tatsächlichen Zugang, geschlossene Orte und doppelte Einträge prüfen. Eintritt, Mitgliedschaft, Reservierung und Barrierefreiheit sind nicht verifiziert. Fehlende Öffnungszeiten bleiben unbekannt; vorhandene Angaben stammen aus der Quelle. Keine Vor-Ort-Prüfung durchgeführt.\n\nZuerst 15–20 passende Orte rund um Hochschule und Innenstadt auswählen und mit den ersten Testern prüfen. Die endgültige Auswahl in ${cityId}.json bearbeiten und erneut lokal validieren. Beliebtheit erst aus tatsächlicher App-Nutzung bestimmen.\n\n| Bereich | Quellendatum (UTC) | Gefunden | Im Entwurf |\n| --- | --- | --- | --- |\n${sources.map(s => `| ${s.bucket} | ${s.retrievedAt} | ${s.returned} | ${s.selected} |`).join('\n')}\n\n${sections.join('\n\n')}\n\nDie verworfenen Kandidaten und Gründe stehen in ${cityId}-import-report.json. Geoapify-IDs bleiben erhalten, damit Abstimmungen und Aktivitäten ihre Zuordnung behalten.\n`;
  await writeFile(resolve(output, `${cityId}-review.md`), review, 'utf8');
  console.log(JSON.stringify({ cityId, spots: places.length, pages: prepared.pages.length, requests, mode: 'local draft only' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
