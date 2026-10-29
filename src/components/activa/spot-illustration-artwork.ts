import type { Place } from '@/lib/types';
import { getSpotIllustrationSubject } from './spot-illustration-subject';

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
} satisfies Record<string, SpotIllustrationArtwork>;

/** Selects category artwork only; it never changes discovery or place data. */
export function getSpotIllustrationArtwork(place: Pick<Place, 'name' | 'categories'>): SpotIllustrationArtwork | undefined {
  return artworks[getSpotIllustrationSubject(place)];
}
