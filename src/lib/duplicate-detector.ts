import { calculateDistance } from './geo-utils';
import type { Place } from './types';

/**
 * Checks if two places are likely duplicates of each other using geographic proximity
 * and name similarity (substring + Jaccard similarity of word tokens).
 */
export function isDuplicate(p1: Place, p2: Place): boolean {
  // Guard check
  if (!p1.lat || !p1.lon || !p2.lat || !p2.lon || !p1.name || !p2.name) return false;

  // 1. Proximity Check (in meters)
  const distanceMeters = calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon) * 1000;
  
  // If they are more than 150m apart, they are not duplicates
  if (distanceMeters > 150) return false;

  // 2. Name Normalization
  const norm1 = p1.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const norm2 = p2.name.toLowerCase().replace(/[^a-z0-9]/g, '');

  // If names are identical after stripping non-alphanumeric and they are within 150m
  if (norm1 === norm2) return true;

  // Substring matching: e.g. "Starbucks Coffee" and "Starbucks" within 50m
  if (distanceMeters < 50 && (norm1.includes(norm2) || norm2.includes(norm1))) return true;

  // 3. Jaccard Similarity of Word Tokens
  const getWords = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const w1 = getWords(p1.name);
  const w2 = getWords(p2.name);
  if (w1.length > 0 && w2.length > 0) {
    const s1 = new Set(w1);
    const s2 = new Set(w2);
    const intersect = [...s1].filter(x => s2.has(x)).length;
    const union = new Set([...s1, ...s2]).size;
    const jaccard = intersect / union;

    // If name similarity is high (>= 0.5) and they are close (< 100m)
    if (jaccard >= 0.5 && distanceMeters < 100) return true;
  }

  return false;
}
