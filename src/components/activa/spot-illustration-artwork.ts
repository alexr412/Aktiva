import type { Place } from '@/lib/types';
import { getSpotIllustrationKind } from './spot-illustration-kind';

export type SpotIllustrationArtwork = {
  src: string;
  label: { de: string; en: string };
  objectPosition: string;
  mobileObjectPosition: string;
};

const root = '/assets/spot-illustrations/modern-v2';
const artworks = {
  bowling: { src: `${root}/bowling.webp`, label: { de: 'Gemeinsam bowlen', en: 'Bowling with friends' }, objectPosition: '50% 32%', mobileObjectPosition: '50% 50%' },
  coffee: { src: `${root}/cafe.webp`, label: { de: 'Kaffee trinken mit Freunden', en: 'Coffee with friends' }, objectPosition: '50% 48%', mobileObjectPosition: '50% 50%' },
  pool: { src: `${root}/schwimmen.webp`, label: { de: 'Gemeinsam schwimmen', en: 'Swimming with friends' }, objectPosition: '50% 52%', mobileObjectPosition: '65% 50%' },
  padel: { src: `${root}/padel.webp`, label: { de: 'Gemeinsam Padel spielen', en: 'Playing padel with friends' }, objectPosition: '50% 10%', mobileObjectPosition: '70% 50%' },
  park: { src: `${root}/park.webp`, label: { de: 'Spaziergang mit Freunden im Park', en: 'A walk in the park with friends' }, objectPosition: '50% 18%', mobileObjectPosition: '53% 50%' },
  seal: { src: `${root}/zoo.webp`, label: { de: 'Besuch in einem Meereszoo', en: 'Visiting a marine zoo' }, objectPosition: '50% 50%', mobileObjectPosition: '65% 50%' },
} satisfies Record<string, SpotIllustrationArtwork>;

/** Selects category artwork only; it never changes discovery or place data. */
export function getSpotIllustrationArtwork(place: Pick<Place, 'name' | 'categories'>): SpotIllustrationArtwork | undefined {
  const kind = getSpotIllustrationKind(place);
  const text = `${place.name || ''} ${(place.categories || []).join(' ')}`.toLowerCase();

  // A padel scene must not stand in for every sport, nor a park for a beach.
  if (kind === 'sport') return /\bpadel\b/.test(text) ? artworks.padel : undefined;
  if (kind === 'park' && /beach|strand/.test(text)) return undefined;
  return kind in artworks ? artworks[kind as keyof typeof artworks] : undefined;
}
