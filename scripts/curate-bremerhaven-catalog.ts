import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareSpotCatalog } from './spot-catalog-publish';
import type { CatalogSpot } from '../src/lib/spot-catalog';

const directory = resolve('data/spot-catalogs');
const sourceReferences = [
  { label: 'Hot Court Padel: neue Halle und Adresse', url: 'https://www.bis-bremerhaven.de/de/news/gruender-bringen-padel-nach-bremerhaven/2103' },
  { label: 'HAVENGLOW: Schwarzlicht-Minigolf und Adresse', url: 'https://www.havenglow.de/' },
  { label: 'Zoo am Meer: Betreiber', url: 'https://zoo-am-meer-bremerhaven.de/' },
  { label: 'Beyond Bowling: heutiger Name und Adresse', url: 'https://beyondbowling.de/' },
  { label: 'Altes Eiswerk: KAIS, JUMPIN und EXIT mit separatem Eingang', url: 'https://www.alteseiswerk.de/ueber-uns/' },
  { label: "GLENN'S PLACE: Karaoke und Game Nights", url: 'https://linktr.ee/glennsplace.bhv' },
  { label: 'Boulder Club: öffentlicher Zugang und Öffnungszeiten', url: 'https://www.bremerhaven-boulderclub.de/' },
  { label: 'Übersee: Café und Bistro', url: 'https://www.bremerhaven-erleben.de/gastro/cafe-bistro-uebersee' },
  { label: "Grete's: Café am Kai (Tourismusbericht 2021)", url: 'https://www.logbuch-bremerhaven.de/dreamteam-gretes-und-fischkai57/' },
  { label: 'Restaurant-Auswahl: städtische Tourismusgesellschaft', url: 'https://www.bremerhaven-erleben.de/essen-und-trinken' },
  { label: 'Villa Seebeck: Restaurant und Adresse', url: 'https://www.villaseebeck.de/' },
  { label: 'Natusch: Restaurant und Adresse', url: 'https://www.natusch.de/kontakt/' },
  { label: 'Dock IV: Betreiber', url: 'https://dock4-restaurant.de/' },
  { label: 'Dat Fischhus: Betreiber', url: 'https://fischhus-bremerhaven.de/' },
  { label: 'Foodart: Betreiber und Adresse', url: 'https://www.cakesandbowls.de/about-1' },
];
let requests = 0;
async function request(path: string, parameters: Record<string, string>) {
  const key = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_GEOAPIFY_API_KEY is required.');
  if (++requests > 6) throw new Error('Supplement request limit reached.');
  const url = new URL(path, 'https://api.geoapify.com');
  Object.entries({ ...parameters, apiKey: key }).forEach(([name, value]) => url.searchParams.set(name, value));
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(30_000) }); }
  catch { throw new Error('Geoapify supplement request failed; no credentials logged.'); }
  if (!response.ok) throw new Error(`Geoapify supplement returned HTTP ${response.status}.`);
  return response.json();
}

async function locateAddress(name: string, street: string, number: string, id: string, categories: string[], postalCode = '27572'): Promise<CatalogSpot> {
  const data = await request('/v1/geocode/search', {
    text: `${street} ${number}, ${postalCode} Bremerhaven, Deutschland`, format: 'json', lang: 'de', limit: '1', filter: 'countrycode:de',
  });
  const p = data.results?.[0];
  if (!p || p.city !== 'Bremerhaven' || p.housenumber !== number || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) throw new Error(`Exact address could not be verified for ${name}.`);
  // Address geocoding IDs identify buildings, not these venues: give each curated venue its own stable ID.
  return { id, name, address: `${street} ${number}, ${postalCode} Bremerhaven, Deutschland`, lat: p.lat, lon: p.lon, categories };
}

async function main() {
  const original = JSON.parse(await readFile(resolve(directory, 'bremerhaven.json'), 'utf8'));
  if (original.cityId !== 'bremerhaven') throw new Error('Expected the Bremerhaven catalog.');
  const cachePath = resolve(directory, 'bremerhaven-source-pilot-additions.json');
  let additions: { retrievedAt: string; places: CatalogSpot[] };
  try { additions = JSON.parse(await readFile(cachePath, 'utf8')); }
  catch (error: any) {
    if (error.code !== 'ENOENT') throw new Error('Cannot read supplement cache.');
    const boundary = JSON.parse(await readFile(resolve(directory, 'bremerhaven-source-city.json'), 'utf8')).results?.[0];
    if (!boundary?.place_id || boundary.name !== 'Bremerhaven') throw new Error('Missing verified Bremerhaven boundary.');
    const data = await request('/v2/places', { categories: 'entertainment.zoo,entertainment.miniature_golf,entertainment.bowling_alley', filter: `place:${boundary.place_id}`, lang: 'de', limit: '100' });
    if (!Array.isArray(data.features)) throw new Error('Invalid leisure supplement response.');
    const places: CatalogSpot[] = data.features.map((f: any) => f.properties).filter((p: any) => p.name && p.place_id && Array.isArray(p.categories) && Number.isFinite(p.lat) && Number.isFinite(p.lon) && !['private', 'no'].includes(p.datasource?.raw?.access)).map((p: any) => ({
      id: p.place_id, name: p.name, address: p.formatted ?? '', lat: p.lat, lon: p.lon, categories: p.categories,
      ...(typeof (p.opening_hours ?? p.datasource?.raw?.opening_hours) === 'string' ? { openingHours: p.opening_hours ?? p.datasource.raw.opening_hours } : {}),
    }));
    if (!places.some(p => /zoo am meer/i.test(p.name))) throw new Error('Zoo am Meer was not returned; review the source before continuing.');
    if (!places.some(p => /havenglow/i.test(p.name))) places.push(await locateAddress('HAVENGLOW Schwarzlicht-Minigolf', 'Herwigstraße', '24', 'catalog-bremerhaven-havenglow', ['entertainment', 'entertainment.miniature_golf']));
    places.push(await locateAddress('Hot Court Padel', 'Nordenhamer Straße', '6', 'catalog-bremerhaven-hot-court-padel', ['sport', 'sport.sports_centre']));
    additions = { retrievedAt: new Date().toISOString(), places };
    await writeFile(cachePath, JSON.stringify(additions, null, 2) + '\n', 'utf8');
  }
  if (!Array.isArray(additions.places)) throw new Error('Invalid supplement cache.');
  const combined = new Map<string, CatalogSpot>(original.places.map((p: CatalogSpot) => [p.id, p]));
  for (const spot of additions.places) combined.set(spot.id, spot);
  const foodCachePath = resolve(directory, 'bremerhaven-source-food-additions.json');
  let food: { retrievedAt: string; places: CatalogSpot[] };
  try { food = JSON.parse(await readFile(foodCachePath, 'utf8')); }
  catch (error: any) {
    if (error.code !== 'ENOENT') throw new Error('Cannot read food supplement cache.');
    const boundary = JSON.parse(await readFile(resolve(directory, 'bremerhaven-source-city.json'), 'utf8')).results?.[0];
    if (!boundary?.place_id || boundary.name !== 'Bremerhaven') throw new Error('Missing verified Bremerhaven boundary.');
    const data = await request('/v2/places', { categories: 'catering.restaurant', filter: `place:${boundary.place_id}`, lang: 'de', limit: '100' });
    if (!Array.isArray(data.features)) throw new Error('Invalid restaurant supplement response.');
    const places: CatalogSpot[] = data.features.map((f: any) => f.properties).filter((p: any) => p.name && p.place_id && Array.isArray(p.categories) && Number.isFinite(p.lat) && Number.isFinite(p.lon) && !['private', 'no'].includes(p.datasource?.raw?.access)).map((p: any) => ({
      id: p.place_id, name: p.name, address: p.formatted ?? '', lat: p.lat, lon: p.lon, categories: p.categories,
    }));
    food = { retrievedAt: new Date().toISOString(), places };
    await writeFile(foodCachePath, JSON.stringify(food, null, 2) + '\n', 'utf8');
  }
  if (!Array.isArray(food.places)) throw new Error('Invalid restaurant supplement cache.');
  for (const spot of food.places) if (!combined.has(spot.id)) combined.set(spot.id, spot);
  const venueCachePath = resolve(directory, 'bremerhaven-source-venue-additions.json');
  let venues: { retrievedAt: string; places: CatalogSpot[] };
  try { venues = JSON.parse(await readFile(venueCachePath, 'utf8')); }
  catch (error: any) {
    if (error.code !== 'ENOENT') throw new Error('Cannot read venue supplement cache.');
    const haven = [...combined.values()].find(p => p.id === 'catalog-bremerhaven-havenglow');
    if (!haven) throw new Error('Missing verified Altes Eiswerk address coordinates.');
    // These are independent venues at the same verified address, not duplicate POIs.
    const places: CatalogSpot[] = [
      { id: 'catalog-bremerhaven-jumpin', name: 'JUMPIN Trampolinpark', address: haven.address, lat: haven.lat, lon: haven.lon, categories: ['entertainment', 'entertainment.activity_park', 'entertainment.activity_park.trampoline'] },
      await locateAddress('EXIT Escape Room', 'Oststraße', '1', 'catalog-bremerhaven-exit', ['entertainment', 'entertainment.escape_game']),
      await locateAddress("GLENN'S PLACE – Karaoke & Game Nights", 'Moltkestraße', '17', 'catalog-bremerhaven-glenns-place', ['catering', 'catering.bar'], '27576'),
    ];
    venues = { retrievedAt: new Date().toISOString(), places };
    await writeFile(venueCachePath, JSON.stringify(venues, null, 2) + '\n', 'utf8');
  }
  if (!Array.isArray(venues.places)) throw new Error('Invalid venue supplement cache.');
  // KAIS now has a provider POI; avoid keeping a second address-based copy from an older draft.
  combined.delete('catalog-bremerhaven-kais');
  for (const spot of venues.places) if (spot.id !== 'catalog-bremerhaven-kais') combined.set(spot.id, spot);
  // Preserve the original POI ID so votes and existing activities stay attached after the rename.
  for (const [id, spot] of combined) {
    if (['überSEE', "Grete's - Café am Kai"].includes(spot.name)) {
      combined.set(id, { ...spot, categories: [...new Set([...spot.categories, 'catering.cafe'])] });
    }
    if (/^Bremerhaven Boulder Club$/i.test(spot.name)) {
      const { openingHours: _memberHours, ...rest } = spot;
      combined.set(id, rest); // Source 24/7 is member access, not the public opening schedule.
    }
    if (/^(fun bowling|beyond bowling)$/i.test(spot.name) && /134/.test(spot.address)) {
      const { openingHours: _oldHours, ...rest } = spot;
      combined.set(id, { ...rest, name: 'Beyond Bowling (ehemals Fun Bowling)', address: spot.address.replace(/^fun Bowling, /i, 'Beyond Bowling, ') });
    }
  }
  const prepared = prepareSpotCatalog({ ...original, places: [...combined.values()] });
  const places = prepared.pages.flatMap(page => page.places);
  const requested = [
    { label: 'Bürgerpark', match: /^bürgerpark$/i },
    { label: 'Snookers', match: /^snooker.?s$/i },
    { label: 'Hot Court Padel', match: /^hot court padel$/i },
    { label: 'BAD 3', match: /^bad\s?3$/i },
    { label: 'Das Beet', match: /^das beet$/i },
    { label: 'Café Lieblingsplatz', match: /^lieblingsplatz$/i },
    { label: 'Rüssel', match: /^rüssel$/i },
    { label: 'Karlsburg (Bar)', match: /^karlsburg$/i },
    { label: 'Deutsches Auswandererhaus', match: /^deutsches auswandererhaus$/i },
    { label: 'Klimahaus Bremerhaven', match: /^klimahaus bremerhaven$/i },
    { label: 'Minigolf: HAVENGLOW', match: /havenglow/i },
    { label: 'Zoo am Meer', match: /zoo am meer/i },
    { label: 'Bowling: Beyond Bowling', match: /^beyond bowling/i },
  ];
  const core = requested.map(item => {
    const matches = places.filter(p => item.match.test(p.name));
    if (matches.length !== 1) throw new Error(`Expected one verified match for ${item.label}, found ${matches.length}.`);
    return matches[0];
  });
  const selection = JSON.parse(await readFile(resolve(directory, 'bremerhaven-pilot-selection.json'), 'utf8')) as { groups: { label: string; names: string[] }[] };
  const selected = selection.groups.flatMap(group => group.names.map(name => {
    const matches = places.filter(p => p.name === name);
    if (matches.length !== 1) throw new Error(`Expected one match for ${name}, found ${matches.length}.`);
    return { label: name, group: group.label, spot: matches[0] };
  }));
  if (selected.length < 50 || selected.length > 100) throw new Error('Pilot must contain 50–100 spots.');
  if (new Set(selected.map(item => item.spot.id)).size !== selected.length) throw new Error('Duplicate pilot spot.');
  if (core.some(spot => !selected.some(item => item.spot.id === spot.id))) throw new Error('A core pilot spot is missing.');
  const pilot = { ...original, places: selected.map(item => item.spot) };
  const pilotPrepared = prepareSpotCatalog(pilot);
  const esc = (text: string) => text.replace(/\|/g, '\\|').replace(/[\r\n]/g, ' ');
  const table = (items: CatalogSpot[]) => '| Spot | Adresse | Karte |\n| --- | --- | --- |\n' + items.map(p => `| ${esc(p.name)} | ${esc(p.address)} | [OSM](https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}) |`).join('\n');
  const counts = selection.groups.map(group => ({ group: group.label, spots: group.names.length }));
  const notes = `Status: **lokaler Entwurf, nicht veröffentlicht**. Die ursprünglichen 13 Orte bleiben enthalten. Karlsburg meint die Bar in der Bürgermeister-Smidt-Straße 161. Die Auswahl ergänzt unterschiedliche Treffmöglichkeiten; sie ist keine gemessene Beliebtheitsliste.\n\nQuellen: [Geoapify / OpenStreetMap](https://www.geoapify.com/places-api/) und [OpenStreetMap-Mitwirkende, ODbL](https://www.openstreetmap.org/copyright); gezielte Betreiber-/Adressprüfung am 12.10.2026: ${sourceReferences.map(s => `[${s.label}](${s.url})`).join(', ')}. Ergänzungsdaten: Freizeit ${additions.retrievedAt}, Restaurants ${food.retrievedAt}, weitere Betreiber ${venues.retrievedAt}. Nicht jeder Eintrag wurde einzeln beim Betreiber bestätigt; die übrigen stammen aus öffentlichen Ortsdaten.\n\nNeue Orte ohne eigene Anbieter-POI-ID erhalten eine feste Katalog-ID. Die Koordinaten von Hot Court, HAVENGLOW, JUMPIN, EXIT und GLENN'S PLACE stammen aus einer Adress-Geokodierung: Vor dem Test den genauen Eingang/Treffpunkt prüfen. EXIT hat den Zugang an der Oststraße 1. Keine Vor-Ort-Prüfung durchgeführt. Eintritt, Reservierung, Zugang und Öffnungszeiten vor dem jeweiligen Treffen beim Betreiber prüfen. Veraltete Öffnungszeiten von Fun Bowling und der nur für Mitglieder geltende 24/7-Zugang des Boulder Clubs wurden entfernt. Karaoke-/Spieleabende sind Angebote des Orts, keine automatisch veröffentlichten Termine. Die vorübergehend geschlossene KIDSZONE ist nicht enthalten.\n\nAllgemeine Ideen wie Spazieren, Wandern, Radfahren, Shoppen und Brettspiele werden in der App lokal angeboten. Erst eine Person legt einen Treffpunkt und Termin fest und veröffentlicht damit eine echte Community-Aktivität. Diese Ideen brauchen keinen Eintrag als Ort und keine Mindest-Einwohnerzahl.\n\nTechnik: ${pilotPrepared.pages.length} Katalogseite; ${pilotPrepared.pages.reduce((sum, page) => sum + Buffer.byteLength(JSON.stringify(page), 'utf8'), 0)} Byte JSON. Ortsanzahl und Filterung erzeugen keine einzelnen Firestore-Reads pro Ort.\n`;
  const review = `# Bremerhaven: Pilot-Auswahl (${selected.length} Orte)\n\n${counts.map(item => `- ${item.group}: ${item.spots}`).join('\n')}\n\n${notes}\n${selection.groups.map(group => `## ${group.label} (${group.names.length})\n\n${table(selected.filter(item => item.group === group.label).map(item => item.spot))}`).join('\n\n')}\n`;
  await writeFile(resolve(directory, 'bremerhaven.json'), JSON.stringify({ ...original, places }, null, 2) + '\n', 'utf8');
  await writeFile(resolve(directory, 'bremerhaven-pilot.json'), JSON.stringify(pilot, null, 2) + '\n', 'utf8');
  await writeFile(resolve(directory, 'bremerhaven-pilot-review.md'), review, 'utf8');
  await writeFile(resolve(directory, 'bremerhaven-review.md'), review + `\n## Gesamter Vorschlagsbestand (${places.length} Orte)\n\nDieser Bestand enthält zusätzlich die übrigen, noch nicht kuratierten Import-Vorschläge.\n\n${table(places)}\n`, 'utf8');
  await writeFile(resolve(directory, 'bremerhaven-curation-report.json'), JSON.stringify({ status: 'draft', selected: selected.map(({ label, group, spot }) => ({ label, group, id: spot.id })), groups: counts, sources: sourceReferences, supplementRetrievedAt: { leisure: additions.retrievedAt, food: food.retrievedAt, venues: venues.retrievedAt }, requests, spots: places.length, pilotSpots: selected.length, version: pilotPrepared.city.version, sourceVersion: prepared.city.version, pages: pilotPrepared.pages.length }, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ cityId: 'bremerhaven', spots: places.length, pilotSpots: selected.length, requests, mode: 'local curation only' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
