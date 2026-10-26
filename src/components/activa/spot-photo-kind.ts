import type { Place } from '@/lib/types';
import { getSpotIllustrationKind } from './spot-illustration-kind';

/** Presentation only. Never changes the category, ranking or actual venue-photo match. */
export function getSpotPhotoKind(place: Pick<Place, 'name' | 'categories'>): string {
  const text = `${place.name || ''} ${(place.categories || []).join(' ')}`.toLowerCase();
  if (/boulder|climbing|kletter/.test(text)) return 'bouldering';
  if (/padel/.test(text)) return 'padel';
  if (/trampolin|trampoline/.test(text)) return 'trampoline';
  if (/escape/.test(text)) return 'escape';
  if (/bibliothek|library/.test(text)) return 'library';
  if (/skate|rollsport|bmx/.test(text)) return 'skate';
  if (/snooker|billard|billiard/.test(text)) return 'billiards';
  return getSpotIllustrationKind(place);
}
