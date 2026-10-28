import type { Place } from '@/lib/types';

/** Artwork selection only; discovery, place categories and ranking stay separate. */
export function getSpotIllustrationSubject(place: Pick<Place, 'name' | 'categories'>) {
  const name = (place.name || '').toLowerCase();
  const tags = (place.categories || []).map(tag => tag.toLowerCase());
  const tagged = (pattern: RegExp) => tags.some(tag => pattern.test(tag));
  const named = (pattern: RegExp) => pattern.test(name);
  const has = (pattern: RegExp) => named(pattern) || tagged(pattern);
  const gastronomy = tagged(/^catering(?:\.|$)/);

  // Specific activities take priority over broad sport, catering or park roots.
  if (has(/minigolf|mini_golf|miniature_golf|adventure golf/)) return 'minigolf';
  if (has(/bowling|kegel/)) return 'bowling';
  if (has(/escape|escaperoom|rätselraum/)) return 'escape';
  if (has(/trampolin|trampoline/)) return 'trampoline';
  if (has(/boulder|climbing|kletter/)) return 'climbing';
  if (has(/snooker|billard|billiard|pool_table/)) return 'billiards';
  if (has(/karaoke/)) return 'karaoke';
  if (has(/arcade|spielhalle/)) return 'arcade';
  if (has(/brettspiel|board[ _-]?(game|gaming)|gesellschaftsspiel|spielabend|game[ _-]?bar|games?[ _-]?nights?/)) return 'boardgames';
  if (has(/\bpadel\b/)) return 'padel';
  if (has(/\btennis\b/)) return 'tennis';
  if (has(/soccer|football|fußball|fussball/)) return 'football';
  if (has(/basketball/)) return 'basketball';
  if (has(/skatepark|skateboard|rollsport|\bbmx\b/)) return 'skatepark';
  if (has(/cinema|kino|cinemotion|filmpalast/)) return 'cinema';
  if (tagged(/museum/) || (!gastronomy && named(/museum|auswandererhaus|klimahaus|phänomenta|phaenomenta/))) return 'museum';
  if (tagged(/library/) || (!gastronomy && named(/library|bibliothek|bücherei|buecherei|\blesen\b|\breading\b/))) return 'library';
  if (tagged(/aquarium/) || (!gastronomy && named(/aquarium/))) return 'aquarium';
  if (tagged(/zoo|animal|tierpark/) || (!gastronomy && named(/zoo|tierpark|tiergehege/))) return named(/meer|marine|sea[ _-]?life/) ? 'seal' : 'deer';
  if (has(/swimming|water_park|waterpark|aquatic|schwimmbad|\bbad\s?\d\b|lehrbecken|hallenbad|freibad|freizeitbad/)) return 'pool';
  if (has(/wellness|sauna|thermal|therme|\bspa\b/)) return 'wellness';
  if (has(/nightclub|nachtclub|disco|dance_club|kühlhouse|kuehlhouse|\bparty\b/)) return 'nightclub';
  if (has(/ice_cream|eisdiele|\beis essen\b|toddy.s eis/)) return 'icecream';

  // Venue tags outrank ambiguous names such as "Bootshaus Bürgerpark".
  if (tagged(/catering\.cafe/)) return 'coffee';
  if (tagged(/restaurant|fast_food|food_court|bakery|biergarten/)) return 'food';
  if (tagged(/catering\.(bar|pub)/)) return 'bar';
  if (named(/café|\bcafe\b|coffee/)) return 'coffee';
  if (named(/\bbar\b|\bpub\b|rüssel|russel|karlsburg/)) return 'bar';
  if (tagged(/^catering(?:\.|$)|food_and_drink/)) return 'food';

  if (has(/theater|theatre|gallery|galerie|arts_centre|\bkultur\b|\bculture\b/)) return 'culture';
  if (has(/spielplatz|playground/)) return 'playground';
  if (has(/hiking|wandern|wanderweg|wanderung/)) return 'hiking';
  if (has(/cycling|radfahren|rad fahren|fahrrad|cycle_path|bicycle/)) return 'cycling';
  if (has(/camping|camp_site|caravan_site|zeltplatz/)) return 'camping';
  if (has(/beach|strand|badeufer/)) return 'beach';
  if (has(/harbour|harbor|marina|\bhafen\b|schiff|\bship\b|\bboot\b|\bboat\b|promenade/)) return 'maritime';
  if (has(/park|garden|garten|nature|national_park|natural\.|\boutdoor\b|spazieren/)) return 'park';
  if (has(/shopping|shoppen/) || tagged(/^shop(?:\.|$)|^commercial(?:\.|$)/)) return 'shopping';
  if (has(/fitness|\bgym\b|yoga/) || tagged(/^(sport|sports)(\.|$)|sports_centre|activity_park/) || named(/\bsport\b/)) return 'fitness';
  if (has(/gaming|videogame|video_game/)) return 'arcade';
  if (has(/sights|sightseeing|historic|heritage|attraction|artwork|sculpture|denkmal|sehensw|viewpoint|religion|church|mosque|synagogue/)) return 'sightseeing';

  // A neutral modern scene covers unknown meeting places without inventing a sport.
  return 'community';
}

export type SpotIllustrationSubject = ReturnType<typeof getSpotIllustrationSubject>;
