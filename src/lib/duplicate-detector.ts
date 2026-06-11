import { calculateDistance } from './geo-utils';
import type { Place } from './types';

/**
 * Safe name normalizer: Extract string, lowercase, normalize diacritics, and keep alphanumeric characters.
 */
export function normalizePlaceName(name: any): string {
  if (!name) return '';
  let str = '';
  if (typeof name === 'string') {
    str = name;
  } else if (typeof name === 'object') {
    str = name.de || name.en || Object.values(name).find(v => typeof v === 'string') || '';
  } else {
    str = String(name);
  }
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9]/g, ''); // keep alphanumeric only
}

/**
 * Address normalizer: lowercase and keep alphanumeric only.
 */
export function normalizeAddress(address: string | null | undefined): string {
  if (!address) return '';
  return address
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Calculates distance in meters between two places.
 */
export function getDistanceMeters(p1: { lat: number; lon: number }, p2: { lat: number; lon: number }): number {
  if (!p1.lat || !p1.lon || !p2.lat || !p2.lon) return Infinity;
  return calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon) * 1000;
}

/**
 * Helper to safely extract raw string name from name value/object.
 */
function getRawNameString(name: any): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  if (typeof name === 'object') {
    return name.de || name.en || Object.values(name).find(v => typeof v === 'string') || '';
  }
  return String(name);
}

/**
 * Checks if two places are identity duplicates using the 4 matching rules:
 * 1. Exact normalizedName match within 150m.
 * 2. Substring name match within 50m.
 * 3. Rounded coordinates to 3 decimal places plus Name-Token Jaccard-Similarity >= 0.4.
 * 4. Normalized address match within 300m (if both are present and at least one is a tourism/attraction/zoo/etc.).
 */
export function isIdentityDuplicate(p1: any, p2: any): boolean {
  if (!p1 || !p2 || !p1.lat || !p1.lon || !p2.lat || !p2.lon) return false;

  const distMeters = getDistanceMeters(p1, p2);

  const name1 = p1.name;
  const name2 = p2.name;
  const normName1 = normalizePlaceName(name1);
  const normName2 = normalizePlaceName(name2);

  // Rule 1: Exact normalizedName-Match within 150m
  if (normName1 && normName2 && normName1 === normName2 && distMeters <= 150) {
    return true;
  }

  // Rule 2: Substring-Name-Match within 50m
  if (normName1 && normName2 && distMeters <= 50 && (normName1.includes(normName2) || normName2.includes(normName1))) {
    return true;
  }

  // Rule 3: Gerundete Koordinaten auf 3 Dezimalstellen plus Name-Token-Jaccard-Similarity >= 0.4
  const lat1Rounded = Math.round(p1.lat * 1000) / 1000;
  const lon1Rounded = Math.round(p1.lon * 1000) / 1000;
  const lat2Rounded = Math.round(p2.lat * 1000) / 1000;
  const lon2Rounded = Math.round(p2.lon * 1000) / 1000;
  
  if (lat1Rounded === lat2Rounded && lon1Rounded === lon2Rounded) {
    // Jaccard similarity of word tokens
    const getWords = (s: string) => {
      if (!s) return [];
      return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    };
    const rawName1 = getRawNameString(name1);
    const rawName2 = getRawNameString(name2);
    const w1 = getWords(rawName1);
    const w2 = getWords(rawName2);
    if (w1.length > 0 && w2.length > 0) {
      const s1 = new Set(w1);
      const s2 = new Set(w2);
      const intersect = [...s1].filter(x => s2.has(x)).length;
      const union = new Set([...s1, ...s2]).size;
      const jaccard = intersect / union;
      if (jaccard >= 0.4) {
        return true;
      }
    }
  }

  // Rule 4: Normalisierte Adress-Übereinstimmung innerhalb von 300m, falls beide Adressen vorhanden sind und mind. einer ein Zoo/Museum/etc. ist
  const addr1 = p1.address || p1.address_line2 || '';
  const addr2 = p2.address || p2.address_line2 || '';
  const normAddr1 = normalizeAddress(addr1);
  const normAddr2 = normalizeAddress(addr2);
  
  const isValidAddress = (addr: string) => {
    return addr.length > 5 &&
      !addr.includes('keineadresse') &&
      !addr.includes('noaddress') &&
      !addr.includes('unknown');
  };

  if (isValidAddress(normAddr1) && isValidAddress(normAddr2) && normAddr1 === normAddr2 && distMeters <= 300) {
    const isAttractionOrZoo = (p: any): boolean => {
      if (!p.categories) return false;
      return p.categories.some((cat: string) => 
        cat.includes('zoo') ||
        cat.includes('attraction') ||
        cat.includes('theme_park') ||
        cat.includes('aquarium') ||
        cat.includes('museum') ||
        cat.includes('sights') ||
        cat.includes('park') ||
        cat.startsWith('tourism') ||
        cat.startsWith('entertainment')
      );
    };

    if (isAttractionOrZoo(p1) || isAttractionOrZoo(p2)) {
      return true;
    }
  }

  return false;
}

/**
 * Fallback / backward compatibility interface delegating to isIdentityDuplicate.
 */
export function isDuplicate(p1: Place, p2: Place): boolean {
  return isIdentityDuplicate(p1, p2);
}
