/** Pure rules shared by the search preview and server. No network requests. */
export const SEARCH_CATEGORIES = {
  cinema: ['entertainment.cinema', 'Kino', 'Cinema', 'kino|kinos|cinema|movies'],
  museum: ['entertainment.museum', 'Museen', 'Museums', 'museum|museen|museums'],
  zoo: ['entertainment.zoo', 'Zoo & Tierpark', 'Zoo', 'zoo|zoos|tierpark|tiergehege'],
  aquarium: ['entertainment.aquarium', 'Aquarium', 'Aquarium', 'aquarium|aquarien'],
  minigolf: ['entertainment.miniature_golf', 'Minigolf', 'Minigolf', 'minigolf|miniature golf'],
  bowling: ['entertainment.bowling_alley', 'Bowling', 'Bowling', 'bowling|kegeln'],
  escape: ['entertainment.escape_game', 'Escape Room', 'Escape room', 'escape room|escape rooms'],
  action: ['entertainment.activity_park', 'Action & Freizeit', 'Activity park', 'action|kletterpark|trampolin|trampoline'],
  themepark: ['entertainment.theme_park', 'Freizeitpark', 'Theme park', 'freizeitpark|theme park'],
  waterpark: ['entertainment.water_park', 'Wasserpark', 'Water park', 'wasserpark|water park'],
  swimming: ['sport.swimming_pool', 'Schwimmen', 'Swimming', 'schwimmen|schwimmbad|freibad|hallenbad|swimming'],
  sport: ['sport', 'Sport', 'Sports', 'sport|sports'],
  park: ['leisure.park', 'Parks', 'Parks', 'park|parks|spazieren|spaziergang|walk'],
  garden: ['leisure.garden', 'Gärten', 'Gardens', 'garten|gärten|garden|gardens'],
  nature: ['leisure.nature_reserve', 'Natur', 'Nature', 'natur|nature|naturschutzgebiet'],
  playground: ['leisure.playground', 'Spielplätze', 'Playgrounds', 'spielplatz|spielplätze|playground'],
  beach: ['beach', 'Strand', 'Beach', 'strand|beach'],
  food: ['catering.restaurant', 'Essen', 'Food', 'essen|restaurant|restaurants|food'],
  cafe: ['catering.cafe', 'Cafés', 'Cafes', 'café|cafe|cafés|cafes|kaffee|coffee'],
  bar: ['catering.bar', 'Bars', 'Bars', 'bar|bars|cocktails'],
  pub: ['catering.pub', 'Pubs', 'Pubs', 'pub|pubs|kneipe|kneipen'],
  fastfood: ['catering.fast_food', 'Imbiss', 'Fast food', 'imbiss|fast food|schnellimbiss'],
  icecream: ['catering.ice_cream', 'Eis', 'Ice cream', 'eis|eisdiele|ice cream'],
  club: ['adult.nightclub', 'Clubs & Discos', 'Clubs', 'club|clubs|disco|discos|tanzen|dancing'],
  sights: ['tourism.sights', 'Sehenswürdigkeiten', 'Sights', 'sehenswürdigkeiten|sightseeing|sights'],
  attraction: ['tourism.attraction', 'Attraktionen', 'Attractions', 'attraktion|attraktionen|attractions'],
  historic: ['building.historic', 'Historische Orte', 'Historic places', 'historisch|historic'],
  religion: ['religion', 'Religion & Glaube', 'Religion', 'kirche|kirchen|religion|moschee|church'],
  shopping: ['commercial.shopping_mall', 'Shopping', 'Shopping', 'shopping|einkaufen|einkaufszentrum'],
} as const;
export const VALID_SEARCH_TAGS: string[] = Object.values(SEARCH_CATEGORIES).map(entry => entry[0]);
export interface SearchIntent {
  categories: string[]; filterByName: boolean; nameQuery?: string; radiusKm?: number | null;
  source?: 'local' | 'ai' | 'cache' | 'fallback';
}
export function normalizeSearchQuery(query: string): string {
  return query.normalize('NFKC').trim().toLocaleLowerCase('de').replace(/\s+/g, ' ');
}
export function searchCategoryLabel(tag: string, language: string): string {
  const entry = Object.values(SEARCH_CATEGORIES).find(entry => entry[0] === tag);
  return entry ? entry[language === 'de' ? 1 : 2] : tag;
}
/** Accept only fully understood phrases; names, negations and extra constraints go to AI. */
export function parseLocalSearchIntent(query: string): SearchIntent | null {
  let remaining = normalizeSearchQuery(query);
  if (!remaining) return { categories: [], filterByName: false, radiusKm: null, source: 'local' };
  if (/\b(kein\w*|nicht|ohne|not|without|except)\b/.test(remaining)) return null;
  let radiusKm: number | null = null;
  remaining = remaining.replace(/\b(\d+(?:[.,]\d+)?)\s*(km|kilometer|kilometres|kilometers|m|meter|metres|meters)\b/g, (_, value, unit) => {
    const parsed = Number(value.replace(',', '.')) / (unit === 'm' || unit.startsWith('meter') || unit.startsWith('metre') ? 1000 : 1);
    if (radiusKm !== null || parsed < 0.1 || parsed > 100) return 'invalidradius';
    radiusKm = parsed; return ' ';
  });
  const categories: string[] = [];
  const aliases = Object.values(SEARCH_CATEGORIES).flatMap(entry => entry[3].split('|').map(alias => ({ alias, tag: entry[0] })))
    .sort((a, b) => b.alias.length - a.alias.length);
  for (const { alias, tag } of aliases) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${alias}(?=$|[^\\p{L}\\p{N}])`, 'gu');
    remaining = remaining.replace(pattern, (_, prefix) => { categories.push(tag); return prefix + ' '; });
  }
  remaining = remaining.replace(/\b(ich|wir|möchte|möchten|will|wollen|suche|suchen|finde|find|show|me|want|to|i|we|oder|und|or|and|im|in|der|die|das|ein|eine|einen|mit|von|bis|zu|umkreis|radius|innerhalb|entfernung|near|within|around|nähe|nahe|bitte|please|gehen|machen|besuchen)\b/gu, ' ')
    .replace(/[\s,.!?;:]+/g, '');
  if (!categories.length && /^[\p{L}\p{N}'’-]{2,80}$/u.test(normalizeSearchQuery(query))) {
    return { categories: [], filterByName: true, nameQuery: query.trim(), radiusKm: null, source: 'local' };
  }
  if (remaining || categories.length === 0) return null;
  return { categories: [...new Set(categories)], filterByName: false, radiusKm, source: 'local' };
}
