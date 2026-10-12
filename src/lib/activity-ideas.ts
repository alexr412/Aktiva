import type { ActivityCategory } from './types';

export interface ActivityIdea {
  id: 'walk' | 'hike' | 'cycle' | 'shopping' | 'boardgames' | 'coffee';
  labelDe: string;
  labelEn: string;
  titleDe: string;
  titleEn: string;
  category: ActivityCategory;
}

// Static ideas work in every city. A host chooses a real meeting point and date.
export const ACTIVITY_IDEAS: readonly ActivityIdea[] = [
  { id: 'walk', labelDe: 'Spazieren', labelEn: 'Go for a walk', titleDe: 'Gemeinsam spazieren gehen', titleEn: 'Go for a walk together', category: 'Outdoor' },
  { id: 'hike', labelDe: 'Wandern', labelEn: 'Hiking', titleDe: 'Gemeinsam wandern', titleEn: 'Go hiking together', category: 'Outdoor' },
  { id: 'cycle', labelDe: 'Radfahren', labelEn: 'Cycling', titleDe: 'Gemeinsam Fahrrad fahren', titleEn: 'Go cycling together', category: 'Sport' },
  { id: 'shopping', labelDe: 'Shoppen', labelEn: 'Shopping', titleDe: 'Gemeinsam shoppen gehen', titleEn: 'Go shopping together', category: 'Sonstiges' },
  { id: 'boardgames', labelDe: 'Brettspiele', labelEn: 'Board games', titleDe: 'Gemeinsam Brettspiele spielen', titleEn: 'Play board games together', category: 'Gaming' },
  { id: 'coffee', labelDe: 'Kaffee trinken', labelEn: 'Have a coffee', titleDe: 'Gemeinsam Kaffee trinken', titleEn: 'Have a coffee together', category: 'Networking' },
];
