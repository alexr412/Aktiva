// Exact replication of tag-config.tsx logic

const formatLabel = (label) => label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();

const getPrimaryIconData = (place, language = 'de') => {
  const rawTags = place.categories || place.category || place.tags || [];
  const tags = (
    Array.isArray(rawTags)
      ? rawTags.filter(Boolean)
      : (typeof rawTags === 'string' ? [rawTags] : [])
  ).map((t) => t.trim().toLowerCase());
  
  const name = (place.name || '').toLowerCase();
  const n = name;

  console.log('Tags received:', tags);

  // Check each condition in order:
  if (tags.includes('entertainment.museum') || name.includes('museum')) return 'museum';
  if (tags.includes('entertainment.cinema') || name.includes('kino')) return 'cinema';
  if (tags.includes('entertainment.escape_game') || name.includes('escape')) return 'escape';
  if (tags.includes('entertainment.activity_park.trampoline') || name.includes('trampolin')) return 'trampoline';
  if (tags.some((t) => t.startsWith('entertainment.activity_park'))) return 'activity_park';
  if (tags.includes('entertainment.miniature_golf') || name.includes('minigolf')) return 'minigolf';

  // Sakralbauten
  if (tags.includes('tourism.sights.place_of_worship.synagogue') || n.includes('synagoge')) return 'synagogue';
  if (tags.includes('tourism.sights.place_of_worship.mosque') || n.includes('moschee')) return 'mosque';
  if (
    tags.includes('tourism.sights.place_of_worship.church') ||
    tags.includes('tourism.sights.place_of_worship.cathedral') ||
    tags.includes('tourism.sights.place_of_worship.chapel') ||
    tags.includes('religion.place_of_worship.christianity') ||
    n.includes('kirche') || n.includes('dom') || n.includes('kapelle')
  ) return 'church';

  // Maritim & Zoo
  if (tags.includes('entertainment.zoo') || name.includes('zoo') || name.includes('tierpark')) return 'zoo';
  if (tags.includes('tourism.attraction.ship') || name.includes('schiff') || name.includes('boot')) return 'ship';

  // Wasser & Wellness
  if (tags.includes('leisure.water_park') || tags.includes('entertainment.water_park') || name.includes('wasserpark')) return 'water_park';
  if (tags.includes('leisure.swimming_pool') || name.includes('bad') || name.includes('schwimm')) return 'pool';
  if (tags.includes('leisure.spa') || name.includes('wellness') || name.includes('sauna')) return 'spa';

  // Natur & Spiel
  if (tags.includes('leisure.playground') || name.includes('spielplatz')) return 'playground';
  if (tags.includes('leisure.park') || n.includes('wiese') || n.includes('park') || n.includes('garten')) return 'park';

  // Kultur & Freizeit
  if (tags.includes('entertainment.culture.theatre') || name.includes('theater')) return 'theatre';
  if (tags.includes('entertainment.culture.arts_centre') || tags.includes('entertainment.culture.gallery')) return 'gallery';
  
  // Sculpture check
  if (tags.some((t) => t.endsWith('.sculpture') || t.endsWith('.artwork') || t === 'sculpture' || t === 'artwork') ||
      name.includes('skulptur') || name.includes('plastik') || name.includes('denkmal')) {
    return 'sculpture';
  }

  // Attraction check
  const attractionCheck = tags.some((t) => t.endsWith('.attraction') || t === 'attraction');
  console.log('Attraction check result:', attractionCheck);
  console.log('Tags tested:', tags.map(t => `"${t}" endsWith(".attraction")=${t.endsWith('.attraction')} or ==="attraction"=${t === 'attraction'}`));
  
  if (attractionCheck || name.includes('attraktion') || name.includes('attraction')) {
    return 'ATTRACTION';
  }

  if (tags.some((t) => t.startsWith('tourism.sights') || t.startsWith('building.historic'))) return 'sight';

  return 'FALLBACK';
};

// Test cases
const testCases = [
  { name: 'Empty categories', place: { name: 'Sankt Marien und historischer Friedhof', categories: [] } },
  { name: 'Only tourism', place: { name: 'Sankt Marien und historischer Friedhof', categories: ['tourism'] } },
  { name: 'tourism + tourism.attraction', place: { name: 'Sankt Marien und historischer Friedhof', categories: ['tourism', 'tourism.attraction'] } },
  { name: 'Church categories', place: { name: 'Sankt Marien und historischer Friedhof', categories: ['tourism', 'tourism.sights', 'tourism.sights.place_of_worship', 'tourism.sights.place_of_worship.church', 'religion', 'religion.place_of_worship', 'religion.place_of_worship.christianity'] } },
  { name: 'String category (not array)', place: { name: 'Sankt Marien und historischer Friedhof', categories: 'tourism.attraction' } },
];

for (const tc of testCases) {
  console.log('\n=== TEST:', tc.name, '===');
  const result = getPrimaryIconData(tc.place);
  console.log('RESULT:', result);
}
