import type { Place } from '@/lib/types';
import { getSpotIllustrationSubject, type SpotIllustrationSubject } from './spot-illustration-subject';

export type SpotIllustrationArtwork = {
  src: string;
  label: { de: string; en: string };
  objectPosition: string;
  mobileObjectPosition: string;
};

const root = '/assets/spot-illustrations/modern-v4';
const correctedRoot = '/assets/spot-illustrations/modern-v5';
const extensionRoot = root;
const extra = (key: string, de: string, en: string, y = 40, x = 50): SpotIllustrationArtwork => ({
  src: `${extensionRoot}/${key}.webp`, label: { de, en },
  objectPosition: `50% ${y}%`, mobileObjectPosition: `${x}% 50%`,
});
const subtag = (key: string, de: string, en: string, y = 25, x = 50): SpotIllustrationArtwork => ({
  ...extra(key, de, en, y, x), src: `/assets/spot-illustrations/modern-v6/${key}.webp`,
});
const artworks = {
  bowling: { src: `${root}/bowling.webp`, label: { de: 'Gemeinsam bowlen', en: 'Bowling with friends' }, objectPosition: '50% 32%', mobileObjectPosition: '50% 50%' },
  coffee: { src: `${root}/cafe.webp`, label: { de: 'Kaffee trinken mit Freunden', en: 'Coffee with friends' }, objectPosition: '50% 48%', mobileObjectPosition: '50% 50%' },
  pool: { src: `${root}/schwimmen.webp`, label: { de: 'Gemeinsam schwimmen', en: 'Swimming with friends' }, objectPosition: '50% 52%', mobileObjectPosition: '65% 50%' },
  padel: { src: `${root}/padel.webp`, label: { de: 'Gemeinsam Padel spielen', en: 'Playing padel with friends' }, objectPosition: '50% 10%', mobileObjectPosition: '70% 50%' },
  park: { src: `${root}/park.webp`, label: { de: 'Spaziergang mit Freunden im Park', en: 'A walk in the park with friends' }, objectPosition: '50% 18%', mobileObjectPosition: '53% 50%' },
  seal: { src: `${root}/zoo.webp`, label: { de: 'Besuch in einem Meereszoo', en: 'Visiting a marine zoo' }, objectPosition: '50% 35%', mobileObjectPosition: '65% 50%' },
  cinema: { ...extra('cinema', "Kino", "Cinema"), src: `${correctedRoot}/cinema.webp` },
  minigolf: extra('minigolf', "Minigolf", "Minigolf", 20, 62),
  food: extra('food', "Restaurant & Essen", "Dining with friends", 50),
  bar: extra('bar', "Bar & Kneipe", "Bar and pub"),
  karaoke: extra('karaoke', "Karaoke", "Karaoke", 25),
  nightclub: extra('nightclub', "Club & Tanzen", "Dancing and nightlife"),
  billiards: extra('billiards', "Billard & Snooker", "Billiards and snooker", 30, 63),
  boardgames: { ...extra('boardgames', "Brettspiele", "Board games", 50), src: `${correctedRoot}/boardgames.webp` },
  climbing: extra('climbing', "Bouldern & Klettern", "Bouldering and climbing", 30),
  trampoline: extra('trampoline', "Trampolinhalle", "Trampoline park", 20),
  escape: extra('escape', "Escape Room", "Escape room"),
  arcade: extra('arcade', "Arcade & Gaming", "Arcade and gaming"),
  museum: extra('museum', "Museum & Ausstellungen", "Museums and exhibitions"),
  library: extra('library', "Bibliothek & Lesen", "Library and reading"),
  culture: extra('culture', "Theater, Kunst & Kultur", "Theatre, arts and culture"),
  sightseeing: extra('sightseeing', "Sehenswürdigkeiten", "Sightseeing"),
  fitness: extra('fitness', "Sport & Fitness", "Sports and fitness", 25),
  tennis: extra('tennis', "Tennis", "Tennis", 25),
  football: extra('football', "Fußball", "Football", 60),
  basketball: extra('basketball', "Basketball", "Basketball", 30),
  skatepark: extra('skatepark', "Skatepark & BMX", "Skatepark and BMX", 25),
  beach: extra('beach', "Strand & Wasser", "Beach and seaside", 20),
  hiking: extra('hiking', "Wandern", "Hiking", 20),
  cycling: extra('cycling', "Radfahren", "Cycling", 30),
  shopping: extra('shopping', "Shoppen", "Shopping", 20),
  deer: extra('deer', "Tiergehege & Landzoo", "Animal enclosure and land zoo"),
  playground: extra('playground', "Spielplatz", "Playground"),
  wellness: extra('wellness', "Wellness & Sauna", "Wellness and sauna", 25),
  camping: extra('camping', "Camping", "Camping", 25),
  icecream: extra('icecream', "Eis essen", "Ice cream", 25),
  maritime: extra('maritime', "Hafen & Maritimes", "Harbour and maritime places", 20),
  aquarium: extra('aquarium', "Aquarium", "Aquarium"),
  community: extra('community', "Gemeinsame Freizeit", "Shared leisure and meeting people", 30),
  coworking: subtag('coworking', 'Coworking', 'Coworking'),
  study: subtag('study', 'Gemeinsam lernen', 'Studying together'),
  iceskating: subtag('iceskating', 'Eislaufen', 'Ice skating', 5),
  planetarium: subtag('planetarium', 'Planetarium', 'Planetarium', 35),
  themepark: subtag('themepark', 'Freizeitpark', 'Amusement park', 25),
  activitypark: subtag('activitypark', 'Aktivitätspark', 'Outdoor activity park', 15),
  lake: subtag('lake', 'See & Flussufer', 'Lake and riverside', 30),
  gallery: subtag('gallery', 'Galerie & Ausstellung', 'Art gallery and exhibition', 25),
  biergarten: subtag('biergarten', 'Biergarten', 'Beer garden'),
  fastfood: subtag('fastfood', 'Burger & Streetfood', 'Burgers and street food', 30),
  bakery: subtag('bakery', 'Bäckerei & Gebäck', 'Bakery and pastries', 30),
  running: subtag('running', 'Laufen & Joggen', 'Running and jogging', 5),
  cooking: subtag('cooking', 'Gemeinsam kochen', 'Cooking together', 30),
  baking: subtag('baking', 'Gemeinsam backen', 'Baking together', 30),
  photography: subtag('photography', 'Fotografie', 'Photography', 25),
  painting: subtag('painting', 'Malen & Kreativworkshop', 'Painting and creative workshop'),
  travel: subtag('travel', 'Reisen & Ausflüge', 'Travel and day trips'),
  concert: subtag('concert', 'Konzert & Livemusik', 'Concert and live music', 25),
  festival: subtag('festival', 'Festival', 'Festival', 25),
  comedy: subtag('comedy', 'Comedy & Stand-up', 'Comedy and stand-up'),
  dogwalking: subtag('dogwalking-compact', 'Mit Hund unterwegs', 'Walking with a dog', 30),
  viewpoint: subtag('viewpoint', 'Aussichtspunkt', 'Scenic viewpoint', 25),
  pizza: subtag('pizza', 'Pizza & Pizzeria', 'Pizza restaurant', 30),
  sushi: subtag('sushi', 'Sushi', 'Sushi restaurant', 25),
  fish: subtag('fish', 'Fischrestaurant', 'Seafood restaurant', 30),
} satisfies Record<SpotIllustrationSubject, SpotIllustrationArtwork>;

/** Selects category artwork only; it never changes discovery or place data. */
export function getSpotIllustrationArtwork(place: Pick<Place, 'name' | 'categories' | 'category' | 'normalizedCategory'>): SpotIllustrationArtwork | undefined {
  return artworks[getSpotIllustrationSubject(place)];
}
