export interface FormattedInterest {
  id: string;
  labelDe: string;
  labelEn: string;
  emoji: string;
}

export const INTEREST_MAP: Record<string, FormattedInterest> = {
  // Categories (From Onboarding & Available Tabs)
  Sights: { id: 'Sights', labelDe: 'Kultur', labelEn: 'Culture', emoji: '🏛️' },
  Museums: { id: 'Museums', labelDe: 'Museen', labelEn: 'Museums', emoji: '🖼️' },
  theater_cinema: { id: 'theater_cinema', labelDe: 'Kino & Theater', labelEn: 'Cinema & Theater', emoji: '🎬' },
  Nature: { id: 'Nature', labelDe: 'Natur & Parks', labelEn: 'Nature & Parks', emoji: '🌲' },
  Wellness: { id: 'Wellness', labelDe: 'Wellness & Spa', labelEn: 'Wellness & Spa', emoji: '🧘' },
  Water: { id: 'Water', labelDe: 'Wasser & Strand', labelEn: 'Water & Beach', emoji: '🏊' },
  Zoos: { id: 'Zoos', labelDe: 'Zoos & Aquarien', labelEn: 'Zoos & Aquaria', emoji: '🦁' },
  Sport: { id: 'Sport', labelDe: 'Sportanlagen', labelEn: 'Sports', emoji: '⚽' },
  ActivityParks: { id: 'ActivityParks', labelDe: 'Action & Freizeit', labelEn: 'Action & Parks', emoji: '⚡' },
  Restaurants: { id: 'Restaurants', labelDe: 'Restaurants', labelEn: 'Restaurants', emoji: '🍽️' },
  Cafes: { id: 'Cafes', labelDe: 'Cafés', labelEn: 'Cafes', emoji: '☕' },
  Nightlife: { id: 'Nightlife', labelDe: 'Bars & Pubs', labelEn: 'Bars & Pubs', emoji: '🍺' },
  Clubs: { id: 'Clubs', labelDe: 'Clubs & Discos', labelEn: 'Clubs & Party', emoji: '🎵' },
  Education: { id: 'Education', labelDe: 'Bildung & Wissen', labelEn: 'Education', emoji: '📚' },
  Shopping: { id: 'Shopping', labelDe: 'Shopping', labelEn: 'Shopping', emoji: '🛍️' },
  Viewpoints: { id: 'Viewpoints', labelDe: 'Aussichtspunkte', labelEn: 'Viewpoints', emoji: '🔭' },
  Religion: { id: 'Religion', labelDe: 'Religion & Glaube', labelEn: 'Religion', emoji: '⛪' },
  Attractions: { id: 'Attractions', labelDe: 'Attraktionen', labelEn: 'Attractions', emoji: '🎟️' },
  FastFood: { id: 'FastFood', labelDe: 'Fast Food', labelEn: 'Fast Food', emoji: '🍔' },
  IceCream: { id: 'IceCream', labelDe: 'Eisdielen', labelEn: 'Ice Cream', emoji: '🍦' },
  Coworking: { id: 'Coworking', labelDe: 'Coworking', labelEn: 'Coworking', emoji: '🏢' },

  // Tinder-style Hobbies
  sport: { id: 'sport', labelDe: 'Sport & Fitness', labelEn: 'Sports & Fitness', emoji: '⚽' },
  running: { id: 'running', labelDe: 'Laufen', labelEn: 'Running', emoji: '🏃' },
  hiking: { id: 'hiking', labelDe: 'Wandern', labelEn: 'Hiking', emoji: '🥾' },
  gaming: { id: 'gaming', labelDe: 'Gaming', labelEn: 'Gaming', emoji: '🎮' },
  movies: { id: 'movies', labelDe: 'Filme & Serien', labelEn: 'Movies & Shows', emoji: '🎬' },
  music: { id: 'music', labelDe: 'Musik', labelEn: 'Music', emoji: '🎵' },
  concerts: { id: 'concerts', labelDe: 'Konzerte', labelEn: 'Concerts', emoji: '🎤' },
  festivals: { id: 'festivals', labelDe: 'Festivals', labelEn: 'Festivals', emoji: '🎪' },
  cooking: { id: 'cooking', labelDe: 'Kochen', labelEn: 'Cooking', emoji: '🍳' },
  foodie: { id: 'foodie', labelDe: 'Foodie', labelEn: 'Foodie', emoji: '🍕' },
  coffee: { id: 'coffee', labelDe: 'Kaffee', labelEn: 'Coffee', emoji: '☕' },
  beer: { id: 'beer', labelDe: 'Bier', labelEn: 'Beer', emoji: '🍺' },
  wine: { id: 'wine', labelDe: 'Wein', labelEn: 'Wine', emoji: '🍷' },
  traveling: { id: 'traveling', labelDe: 'Reisen', labelEn: 'Traveling', emoji: '✈️' },
  photography: { id: 'photography', labelDe: 'Fotografie', labelEn: 'Photography', emoji: '📷' },
  camping: { id: 'camping', labelDe: 'Camping', labelEn: 'Camping', emoji: '⛺' },
  reading: { id: 'reading', labelDe: 'Lesen', labelEn: 'Reading', emoji: '📖' },
  art: { id: 'art', labelDe: 'Kunst & Malen', labelEn: 'Art & Painting', emoji: '🎨' },
  animals: { id: 'animals', labelDe: 'Tiere', labelEn: 'Animals', emoji: '🐶' },
  nature: { id: 'nature', labelDe: 'Natur', labelEn: 'Nature', emoji: '🌿' },
  shopping: { id: 'shopping', labelDe: 'Shopping', labelEn: 'Shopping', emoji: '🛍️' },
  fashion: { id: 'fashion', labelDe: 'Mode', labelEn: 'Fashion', emoji: '👗' },
  boardgames: { id: 'boardgames', labelDe: 'Brettspiele', labelEn: 'Board Games', emoji: '🎲' },
  dancing: { id: 'dancing', labelDe: 'Tanzen', labelEn: 'Dancing', emoji: '💃' },
  baking: { id: 'baking', labelDe: 'Backen', labelEn: 'Baking', emoji: '🧁' },
  wellness: { id: 'wellness', labelDe: 'Wellness', labelEn: 'Wellness', emoji: '🧘' },
  comedy: { id: 'comedy', labelDe: 'Stand-up Comedy', labelEn: 'Stand-up Comedy', emoji: '🎭' },
};

/**
 * Returns a formatted interest object with emoji & localized label.
 * If the key is not in the map, fallback nicely formatted without underscores.
 */
export function getFormattedInterest(key: string, language: 'de' | 'en' = 'de'): { label: string; emoji: string; full: string } {
  if (!key) return { label: '', emoji: '✨', full: '' };

  const entry = INTEREST_MAP[key] || INTEREST_MAP[key.toLowerCase()];
  if (entry) {
    const label = language === 'de' ? entry.labelDe : entry.labelEn;
    return {
      label,
      emoji: entry.emoji,
      full: `${entry.emoji} ${label}`,
    };
  }

  // Fallback formatting: replace underscores and camelCase
  const cleanLabel = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

  return {
    label: cleanLabel,
    emoji: '✨',
    full: `✨ ${cleanLabel}`,
  };
}
