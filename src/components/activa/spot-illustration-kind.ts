import type { Place } from '@/lib/types';

/** Only chooses artwork; it does not change the place's category or ranking. */
export function getSpotIllustrationKind(place: Pick<Place, 'name' | 'categories'>) {
  const text = `${place.name || ''} ${(place.categories || []).join(' ')}`.toLowerCase();
  if (/minigolf|mini_golf|miniature_golf|adventure golf/.test(text)) return 'minigolf';
  if (/bowling|kegel/.test(text)) return 'bowling';
  if (/nightclub|nachtclub|disco|karaoke|kühlhouse|kuehlhouse/.test(text)) return 'music';
  if (/zoo|animal|tierpark|tiergehege/.test(text)) return /meer|aquarium/.test(text) ? 'seal' : 'deer';
  if (/swimming|water_park|aquatic|schwimmbad|\bbad\s?\d|hallenbad|freibad/.test(text)) return 'pool';
  if (/cinema|kino|cinemotion|filmpalast/.test(text)) return 'cinema';
  if (/catering\.bar|catering\.pub|snooker|billard|rüssel|karlsburg|game bar/.test(text)) return 'bar';
  if (/catering\.cafe|café|coffee/.test(text)) return 'coffee';
  if (/catering|restaurant|cafe|café/.test(text)) return 'food';
  if (/museum|culture|theatre|library|historic|auswandererhaus|klimahaus/.test(text)) return 'culture';
  if (/sport|activity_park|fitness|padel|tennis/.test(text)) return 'sport';
  if (/park|garden|nature|beach|strand/.test(text)) return 'park';
  return 'explore';
}
