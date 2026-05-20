const place = {
  id: 'some-id',
  name: 'Sankt Marien und historischer Friedhof',
  categories: ['tourism', 'tourism.attraction']
};

const getPrimaryIconData = (place, language = 'de') => {
  const rawTags = place.categories || place.category || place.tags || [];
  const tags = (Array.isArray(rawTags) ? rawTags.filter(Boolean) : (typeof rawTags === 'string' ? [rawTags] : [])).map((t) => t.trim().toLowerCase());
  const name = (place.name || '').toLowerCase();
  const n = name;

  // --- PRIORITÄT 0: Spezifische Entertainment-Kategorien ---
  if (tags.includes('entertainment.museum') || name.includes('museum')) {
    return 'museum';
  }
  if (tags.includes('entertainment.cinema') || name.includes('kino')) {
    return 'cinema';
  }
  if (tags.includes('entertainment.escape_game') || name.includes('quest') || name.includes('escape') || name.includes('rätsel')) {
    return 'escape';
  }
  if (tags.includes('entertainment.activity_park.trampoline') || name.includes('trampolin') || name.includes('sprung')) {
    return 'trampoline';
  }
  if (tags.some((t) => t.startsWith('entertainment.activity_park')) || name.includes('aktivitätspark') || name.includes('activity park')) {
    return 'activity park';
  }
  if (tags.includes('entertainment.miniature_golf') || name.includes('minigolf') || name.includes('adventure golf')) {
    return 'minigolf';
  }

  // --- SAKRALBAUTEN ---
  if (tags.includes('tourism.sights.place_of_worship.synagogue') || tags.includes('religion.place_of_worship.judaism') || n.includes('synagoge')) {
    return 'synagogue';
  }
  if (tags.includes('tourism.sights.place_of_worship.mosque') || tags.includes('religion.place_of_worship.islam') || n.includes('moschee')) {
    return 'mosque';
  }
  if (tags.includes('tourism.sights.place_of_worship.church') || tags.includes('tourism.sights.place_of_worship.cathedral') || tags.includes('tourism.sights.place_of_worship.chapel') || tags.includes('religion.place_of_worship.christianity') || n.includes('kirche') || n.includes('dom') || n.includes('kapelle')) {
    return 'church';
  }

  // --- MARITIM & ZOO ---
  if (tags.includes('entertainment.zoo') || name.includes('zoo') || name.includes('tierpark')) {
    return 'zoo';
  }
  if (tags.includes('tourism.attraction.ship') || name.includes('schiff') || name.includes('boot')) {
    return 'ship';
  }

  // --- WASSER & WELLNESS ---
  if (tags.includes('leisure.water_park') || tags.includes('entertainment.water_park') || name.includes('wasserpark')) {
    return 'water_park';
  }
  if (tags.includes('leisure.swimming_pool') || name.includes('bad') || name.includes('schwimm')) {
    return 'pool';
  }
  if (tags.includes('leisure.spa') || name.includes('wellness') || name.includes('sauna') || name.includes('therme')) {
    return 'spa';
  }

  // --- NATUR & SPIEL ---
  if (tags.includes('leisure.playground') || name.includes('spielplatz')) {
    return 'playground';
  }
  if (tags.includes('leisure.park') || tags.includes('pet.dog_park') || n.includes('wiese') || n.includes('park') || n.includes('garten')) {
    return 'park';
  }

  // --- KULTUR & FREIZEIT ---
  if (tags.includes('entertainment.culture.theatre') || name.includes('theater')) {
    return 'theatre';
  }
  if (tags.includes('entertainment.culture.arts_centre') || tags.includes('entertainment.culture.gallery') || name.includes('galerie') || name.includes('gallery')) {
    return 'gallery';
  }
  if (tags.some((t) => t.endsWith('.sculpture') || t.endsWith('.artwork') || t === 'sculpture' || t === 'artwork') || name.includes('skulptur') || name.includes('plastik') || name.includes('denkmal') || name.includes('sculpture')) {
    return 'sculpture';
  }
  if (tags.some((t) => t.endsWith('.attraction') || t === 'attraction') || name.includes('attraktion') || name.includes('attraction')) {
    return 'attraction';
  }
  if (tags.some((t) => t.startsWith('tourism.sights') || t.startsWith('building.historic'))) {
    return 'sight';
  }

  // --- GASTRONOMIE ---
  if (tags.some((t) => t.startsWith('catering.cafe') || t.startsWith('catering.bar') || name.includes('bar') || name.includes('pub'))) {
    return 'cafe';
  }
  if (tags.some((t) => t.startsWith('catering')) || name.includes('restaurant')) {
    return 'restaurant';
  }

  // --- FALLBACK ---
  return 'fallback';
};

console.log('Result:', getPrimaryIconData(place));
