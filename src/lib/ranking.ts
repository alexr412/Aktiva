'use client';

import { calculateDistance } from './geo-utils';
import { availableTabs } from '../components/aktiva/category-filters-data';
import { debugLog } from './debug';

// Dynamically derive categoryIdToQueries from availableTabs.
// This mapping matches tab.id (e.g. Sights) to tag prefix patterns (e.g. tourism.sights)
// and must be kept in sync via category-filters-data.
const categoryIdToQueries: Record<string, string[]> = availableTabs.reduce((acc, tab) => {
  acc[tab.id] = tab.query || [];
  return acc;
}, {} as Record<string, string[]>);

export function getPlaceAffinities(categories: string[], categoryAffinities: Record<string, number> | undefined): number {
  if (!categoryAffinities) return 1.0;
  
  const matchedAffinities: number[] = [];
  
  for (const [catId, queries] of Object.entries(categoryIdToQueries)) {
    const isMatch = categories.some(tag => 
      queries.some(q => tag === q || tag.startsWith(q + '.'))
    );
    if (isMatch) {
      const weight = categoryAffinities[catId];
      if (typeof weight === 'number') {
        matchedAffinities.push(weight);
      }
    }
  }
  
  if (matchedAffinities.length === 0) return 1.0;
  
  // Return the maximum affinity to prioritize user's high-interest matches.
  return Math.max(...matchedAffinities);
}


export interface RankingScores {
  basePrior: number;
  distanceDecay: number;
  personalizationBoost: number;
  communityQuality: number;
  diversityPenalty: number;
  geoPenalty: number;
  consecutivePenalty?: number;
  jitterApplied: number;
  finalRelevance: number;
}

export interface RankingContext {
  placeId: string;
  scores: RankingScores;
  metadata: {
    distanceKm: number;
    primaryCategory: string;
    upvotes?: number;
    downvotes?: number;
  };
}

const tagRules = [
  // Tier 1: Absolute Highlights (80)
  { pattern: /^entertainment\.zoo(\..*)?$/, score: 80 },
  { pattern: /^entertainment\.theme_park(\..*)?$/, score: 80 },
  { pattern: /^entertainment\.planetarium(\..*)?$/, score: 80 },
  { pattern: /^entertainment\.cinema(\..*)?$/, score: 80 },

  // Tier 2: Aktives Entertainment & Fun-Spots (72)
  { pattern: /^entertainment\.(miniature_golf|bowling_alley|escape_game|aquarium|water_park|amusement_arcade|activity_park)(\..*)?$/, score: 72 },
  { pattern: /^sport\.ice_rink(\..*)?$/, score: 72 },
  { pattern: /laser_tag|paintball|trampoline|climbing|bouldering|karting|arcade|bowling/, score: 72 },
  { pattern: /^leisure\.spa(\..*)?$/, score: 72 },
  { pattern: /^adult\.nightclub(\..*)?$/, score: 72 },

  // Tier 3: Sport & generisches Entertainment (62)
  { pattern: /^sport\.stadium(\..*)?$/, score: 62 },
  { pattern: /^entertainment(\..*)?$/, score: 62 },

  // Tier 4: Kultur & Passiv (50)
  { pattern: /^tourism(\..*)?$/, score: 50 },
  { pattern: /^sport(\..*)?$/, score: 50 },
  { pattern: /^leisure(\..*)?$/, score: 50 }
];

/**
 * Calculates a lightweight FNV-1a hash to ensure deterministic jitter.
 */
export function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Phase 1.1: Compute static category tier score.
 */
export function computeBasePrior(categories: string[]): number {
  if (!categories || categories.length === 0) return 50;
  for (let i = 0; i < tagRules.length; i++) {
    const rule = tagRules[i];
    if (categories.some(cat => rule.pattern.test(cat))) {
      return rule.score;
    }
  }
  return 50; // Fallback / Tier 4 score
}

/**
 * Legacy support for geoapify.ts base scoring
 */
export function calculateRelevanceScore(tags: string[]): number {
  return computeBasePrior(tags);
}

/**
 * Phase 1.2: Rational Quadratic Distance Decay.
 * D(x, sigma_u) = 1 / (1 + lambda_0 * (x / sigma_u)^2)
 */
export function computeDistanceDecay(distance: number, densityRadius: number): number {
  const lambda_0 = 0.5;
  const sigma = densityRadius <= 0 ? 5.0 : densityRadius;
  const xNormalized = distance / sigma;
  return 1.0 / (1.0 + lambda_0 * xNormalized * xNormalized);
}

/**
 * Phase 1.3: Soft Personalization matching with tanh limit and strict clamp.
 */
export function computePersonalizationMultiplier(categories: string[], profile: any): number {
  if (!profile) return 1.0;
  const likedTags = profile.likedTags || [];
  const dislikedTags = profile.dislikedTags || [];
  const tinderInterests = profile.tinderInterests || profile.interests || [];

  let matchesLikes = 0;
  let matchesDislikes = 0;
  let matchesTinder = 0;

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    if (likedTags.some((tag: string) => cat.includes(tag) || tag.includes(cat))) {
      matchesLikes++;
    }
    if (dislikedTags.some((tag: string) => cat.includes(tag) || tag.includes(cat))) {
      matchesDislikes++;
    }
    if (tinderInterests.some((interest: string) => cat.includes(interest.toLowerCase()) || interest.toLowerCase().includes(cat))) {
      matchesTinder++;
    }
  }

  const wLikes = 0.5;
  const wDislikes = 1.2;
  const wTinder = 0.3;
  const alphaPers = 0.15;

  const rawAffinity = wLikes * matchesLikes - wDislikes * matchesDislikes + wTinder * matchesTinder;
  const tanhVal = Math.tanh(rawAffinity);
  const multiplier = 1.0 + tanhVal * alphaPers;

  return Math.max(0.85, Math.min(1.15, multiplier));
}

/**
 * Phase 1.4: Bayesian Average for community scoring.
 * Scomm = (weightedUpvotes + C * mu) / (weightedUpvotes + weightedDownvotes + C)
 */
export function computeCommunityScore(upvotes: number = 0, downvotes: number = 0): number {
  const C = 5;
  const mu = 0.75;

  const u = Math.max(0, upvotes);
  const d = Math.max(0, downvotes);

  const denominator = u + d + C;
  if (denominator <= 0) return mu;

  return (u + C * mu) / denominator;
}

/**
 * Phase 1.5: Final Base Score.
 */
export function computeBaseScore(
  prior: number,
  decay: number,
  commScore: number,
  personalization: number
): number {
  const wcomm = 20;
  const base = prior * decay + wcomm * commScore;
  return base * personalization;
}

/**
 * Calculate density radius sigma_u (median distance to the nearest K spots).
 */
export function calculateMedianDistanceToNearestK(
  places: any[],
  userLocation: { lat: number; lng: number } | null,
  k: number = 30
): number {
  if (!places || places.length < k || !userLocation) {
    return 5.0; // Fallback if < K spots are present
  }

  const distances = places
    .map(p => {
      if (typeof p.distance === 'number') return p.distance;
      if (typeof p.lat === 'number' && typeof p.lon === 'number') {
        return calculateDistance(userLocation.lat, userLocation.lng, p.lat, p.lon);
      }
      return null;
    })
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);

  if (distances.length === 0) return 5.0;

  const nearestDistances = distances.slice(0, Math.min(k, distances.length));
  const len = nearestDistances.length;
  if (len === 0) return 5.0;

  const mid = Math.floor(len / 2);
  if (len % 2 !== 0) {
    return nearestDistances[mid];
  } else {
    return (nearestDistances[mid - 1] + nearestDistances[mid]) / 2;
  }
}

/**
 * Phase 2.1: Greedy Category Diversity Reranking with positional pressure.
 */
export function applyCategoryDiversityRerank(
  candidates: any[],
  deltaTop: number = 0.70,
  alphaDiv: number = 0.15
): any[] {
  const placed: any[] = [];
  const remaining = [...candidates];

  const getPrimaryCategory = (item: any): string => {
    const cats: string[] = item.categories || [];
    return cats[0] || 'unknown';
  };

  const categoryCounts: Record<string, number> = {};
  for (let i = 0; i < candidates.length; i++) {
    const cat = getPrimaryCategory(candidates[i]);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const placedCategoryCounts: Record<string, number> = {};

  while (remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    const k = placed.length;
    const deltaK = deltaTop + (1 - deltaTop) * (1 - Math.exp(-alphaDiv * k));

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const cat = getPrimaryCategory(item);

      let score = item.relevanceScore;
      const totalInRegion = categoryCounts[cat] || 0;
      let penaltyMultiplier = 1.0;

      if (totalInRegion >= 3) {
        const n = placedCategoryCounts[cat] || 0;
        penaltyMultiplier = Math.pow(deltaK, n);
        score = score * penaltyMultiplier;
      }

      item.scores = item.scores || {};
      item.scores.diversityPenalty = penaltyMultiplier;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) break;

    const selected = remaining.splice(bestIndex, 1)[0];
    const cat = getPrimaryCategory(selected);
    placedCategoryCounts[cat] = (placedCategoryCounts[cat] || 0) + 1;

    selected.relevanceScore = bestScore;
    placed.push(selected);
  }

  return placed;
}

/**
 * Phase 2.2: Greedy Geo Diversity Penalty.
 */
export function applyGeoDiversityPenalty(
  candidates: any[],
  threshold: number = 0.2, // 200m in km
  betaGeo: number = 0.50
): any[] {
  const placed: any[] = [];
  const remaining = [...candidates];

  while (remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      let score = item.relevanceScore;

      let minGeoPenalty = 1.0;

      for (let j = 0; j < placed.length; j++) {
        const p = placed[j];
        let d = 0;
        if (typeof item.lat === 'number' && typeof item.lon === 'number' &&
            typeof p.lat === 'number' && typeof p.lon === 'number') {
          d = calculateDistance(item.lat, item.lon, p.lat, p.lon);
        }

        if (d < threshold) {
          const penalty = betaGeo + (1 - betaGeo) * (d / threshold);
          if (penalty < minGeoPenalty) {
            minGeoPenalty = penalty;
          }
        }
      }

      score = score * minGeoPenalty;

      item.scores = item.scores || {};
      item.scores.geoPenalty = minGeoPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) break;

    const selected = remaining.splice(bestIndex, 1)[0];
    selected.relevanceScore = bestScore;
    placed.push(selected);
  }

  return placed;
}

/**
 * Diversity Shift: Penalizes consecutive spots of the same category with a 0.95 multiplier.
 */
export function applyDiversityShift(
  candidates: any[],
  penaltyFactor: number = 0.95
): any[] {
  if (!candidates || candidates.length === 0) return [];

  const placed: any[] = [];
  const remaining = [...candidates];

  const getPrimaryCategory = (item: any): string => {
    const cats: string[] = item.categories || [];
    return cats[0] || 'unknown';
  };

  // Initialize consecutivePenalty for all candidates to 1.0
  for (const item of remaining) {
    item.scores = item.scores || {};
    item.scores.consecutivePenalty = 1.0;
  }

  while (remaining.length > 0) {
    // Sort remaining by relevanceScore descending
    remaining.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const lastPlaced = placed[placed.length - 1];

    if (lastPlaced) {
      const catLast = getPrimaryCategory(lastPlaced);
      let checkedCount = 0;
      const initialLength = remaining.length;

      while (remaining.length > 0 && checkedCount < initialLength) {
        const nextItem = remaining[0];
        const catNext = getPrimaryCategory(nextItem);

        if (catNext === catLast) {
          if (nextItem.scores.consecutivePenalty !== penaltyFactor) {
            nextItem.relevanceScore *= penaltyFactor;
            nextItem.scores.consecutivePenalty = penaltyFactor;
            remaining.sort((a, b) => b.relevanceScore - a.relevanceScore);
          } else {
            // Already penalized, cannot avoid consecutive placement
            break;
          }
        } else {
          break;
        }
        checkedCount++;
      }
    }

    const selected = remaining.shift();
    if (selected) {
      placed.push(selected);
    }
  }

  return placed;
}

/**
 * Phase 3.1: Deterministic Jitter Hash.
 */
export function applyDeterministicJitter(
  userId: string,
  placeId: string,
  sessionEpoch: number,
  variance: number = 0.015
): number {
  const input = `${userId}:${placeId}:${sessionEpoch}`;
  const seed = fnv1a(input);
  const percent = (seed % 2000) / 1000 - 1.0; // [-1.0, 1.0]
  return 1.0 + percent * variance;
}

/**
 * Phase 3.2: Deterministic Tie-Breaker.
 */
export function applyTieBreaker(a: any, b: any): number {
  const distA = typeof a.distance === 'number' ? a.distance : 9999;
  const distB = typeof b.distance === 'number' ? b.distance : 9999;
  if (Math.abs(distA - distB) > 0.0001) {
    return distA - distB;
  }

  const commA = a.scores?.communityQuality || 0;
  const commB = b.scores?.communityQuality || 0;
  if (Math.abs(commA - commB) > 0.0001) {
    return commB - commA;
  }

  const idA = a.id || '';
  const idB = b.id || '';
  return idA.localeCompare(idB);
}

/**
 * Helper to build the debug/telemetry RankingContext object.
 */
export function buildRankingContext(place: any, scores: RankingScores): RankingContext {
  const cats: string[] = place.categories || [];
  const primaryCategory = cats[0] || 'unknown';

  return {
    placeId: place.id,
    scores,
    metadata: {
      distanceKm: typeof place.distance === 'number' ? place.distance : 0,
      primaryCategory,
      upvotes: place.upvotes || 0,
      downvotes: place.downvotes || 0
    }
  };
}

export function isEntityBoosted(entity: any): boolean {
  if (!entity) return false;
  if (!entity.isBoosted) return false;
  if (!entity.boostExpiresAt) return true; // Legacy/permanent boost
  try {
    const expiresMillis = typeof entity.boostExpiresAt.toMillis === 'function'
      ? entity.boostExpiresAt.toMillis()
      : typeof entity.boostExpiresAt.toDate === 'function'
        ? entity.boostExpiresAt.toDate().getTime()
        : new Date(entity.boostExpiresAt).getTime();
    return expiresMillis > Date.now();
  } catch (e) {
    return false;
  }
}

/**
 * Normalizes city names to handle typos, diacritics, and casing consistently.
 */
export function normalizeCity(city: string | null | undefined): string {
  if (!city) return "";
  return city
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]/g, ""); // Keep only alphanumeric
}

/**
 * Normalizes categories into a primaryCategory and subCategory according to the spec.
 */
/**
 * Checks if a place name is generic (very short, a street name, a single word, or matches standard landmark naming patterns).
 */
export function isGenericPlaceName(name: unknown): boolean {
  if (typeof name !== 'string') {
    if (process.env.NODE_ENV === 'development') {
      console.warn("[RANKING WARNING] isGenericPlaceName: place name is not a string", name);
    }
    return true;
  }
  const clean = name.trim();
  if (clean.length === 0) return true;

  // 1. Sehr kurze Namen
  if (clean.length <= 3) return true;

  // 2. Reines Einwortname
  const words = clean.split(/\s+/);
  if (words.length === 1) return true;

  // 3. Mustermatchings für Straßen, Brunnen, Kunst, Denkmäler etc.
  const genericPatterns = [
    /strasse/i, /straße/i, /str\./i, /weg/i, /gasse/i, /allee/i, /platz/i,
    /brunnen/i, /denkmal/i, /skulptur/i, /statue/i, /objekt/i, /monument/i,
    /memorial/i, /artwork/i, /kunst/i, /figur/i, /stele/i, /tafel/i,
    /gedenk/i, /grab/i, /kreuz/i, /bildstock/i, /säule/i
  ];
  if (genericPatterns.some(regex => regex.test(clean))) {
    return true;
  }

  return false;
}

/**
 * Computes feed quality adjustments: quality penalties for generic/boring POIs, and activity boosts for active categories.
 */
export function computeAdjustments(
  categories: string[],
  name: string,
  voteBoostScore: number,
  baseRankingScore: number,
  isFromFirestore: boolean
): { qualityPenalty: number; activityBoost: number } {
  const norm = normalizeCategory(categories);
  const prim = norm.primaryCategory;
  const sub = norm.subCategory;

  let qualityPenalty = 0;
  let activityBoost = 0;

  // 1. Quality Penalties
  if (sub === "other") {
    qualityPenalty += 10;
  }
  if (prim === "tourism" && sub === "other") {
    qualityPenalty += 15;
  }
  // Landmark vorsichtig abwerten
  if (
    sub === "landmark" &&
    voteBoostScore <= 0 &&
    baseRankingScore < 70
  ) {
    qualityPenalty += 10;
  }
  // Generische Namen abwerten (nur für other/landmark ohne Firestore-Signale)
  if (
    (sub === "other" || sub === "landmark") &&
    isGenericPlaceName(name) &&
    voteBoostScore <= 0 &&
    !isFromFirestore
  ) {
    qualityPenalty += 15;
  }

  // 2. Activity Boosts
  const activityBoostBySubCategory: Record<string, number> = {
    cinema: 8,
    minigolf: 8,
    bowling: 8,
    swimming_pool: 8,
    zoo: 8,
    museum: 8,
    park: 8,
    restaurant: 5,
    cafe: 5,
    bar: 3,
  };

  if (activityBoostBySubCategory[sub] !== undefined) {
    activityBoost += activityBoostBySubCategory[sub];
  }
  if (prim === "sports") {
    activityBoost += 8;
  }

  return { qualityPenalty, activityBoost };
}

/**
 * Normalizes categories into a primaryCategory and subCategory according to the spec.
 */
export function normalizeCategory(categories: string[]): { primaryCategory: string; subCategory: string } {
  if (!categories || categories.length === 0) {
    return { primaryCategory: 'other', subCategory: 'other' };
  }

  // Phase 1: High Priority (swimming_pool & spa)
  for (const cat of categories) {
    const clean = cat.toLowerCase();
    if (
      clean.includes('swimming_pool') ||
      clean.includes('swimming') ||
      clean === 'sport.swimming' ||
      clean.includes('pool') ||
      clean.includes('bath') ||
      clean.includes('freibad') ||
      clean.includes('hallenbad') ||
      clean.includes('naturbad') ||
      clean.includes('wasserpark') ||
      clean.includes('water_park') ||
      clean.includes('aquatic')
    ) {
      return { primaryCategory: 'sports', subCategory: 'swimming_pool' };
    }
    if (
      clean.includes('spa') ||
      clean.includes('sauna') ||
      clean.includes('therme') ||
      clean.includes('thermal') ||
      clean.includes('wellness')
    ) {
      return { primaryCategory: 'wellness', subCategory: 'spa' };
    }
  }

  // Phase 2: Clear Activity Categories
  for (const cat of categories) {
    const clean = cat.toLowerCase();
    if (clean.includes('cinema')) {
      return { primaryCategory: 'entertainment', subCategory: 'cinema' };
    }
    if (clean.includes('miniature_golf') || clean.includes('minigolf')) {
      return { primaryCategory: 'entertainment', subCategory: 'minigolf' };
    }
    if (clean.includes('bowling_alley') || clean.includes('bowling')) {
      return { primaryCategory: 'entertainment', subCategory: 'bowling' };
    }
    if (clean.includes('zoo')) {
      return { primaryCategory: 'nature', subCategory: 'zoo' };
    }
    if (clean.includes('museum')) {
      return { primaryCategory: 'tourism', subCategory: 'museum' };
    }
    if (clean === 'catering.cafe' || clean.includes('.cafe') || clean === 'cafe') {
      return { primaryCategory: 'food', subCategory: 'cafe' };
    }
    if (clean === 'catering.restaurant' || clean.includes('.restaurant') || clean === 'restaurant') {
      return { primaryCategory: 'food', subCategory: 'restaurant' };
    }
    if (clean === 'catering.bar' || clean === 'catering.pub' || clean.includes('.bar') || clean.includes('.pub') || clean === 'bar' || clean === 'pub' || clean === 'adult.nightclub' || clean.includes('nightclub')) {
      return { primaryCategory: 'nightlife', subCategory: 'bar' };
    }
    if (clean.includes('park') || clean.includes('garden')) {
      return { primaryCategory: 'leisure', subCategory: 'park' };
    }
  }

  // Phase 3: Landmark Mapping
  for (const cat of categories) {
    const clean = cat.toLowerCase();
    if (
      clean.includes('attraction') ||
      clean.includes('sights') ||
      clean.includes('sightseeing') ||
      clean.includes('monument') ||
      clean.includes('memorial') ||
      clean.includes('artwork') ||
      clean.includes('fountain') ||
      clean.includes('statue') ||
      clean.includes('sculpture') ||
      clean.includes('historic')
    ) {
      return { primaryCategory: 'tourism', subCategory: 'landmark' };
    }
  }

  // Fallback parsing for general tags
  for (const cat of categories) {
    const parts = cat.toLowerCase().split('.');
    const root = parts[0];
    const sub = parts.slice(1).join('_') || 'other';

    if (root === 'catering') {
      return { primaryCategory: 'food', subCategory: sub };
    }
    if (root === 'entertainment') {
      return { primaryCategory: 'entertainment', subCategory: sub };
    }
    if (root === 'sport') {
      return { primaryCategory: 'sports', subCategory: sub };
    }
    if (root === 'natural' || (root === 'leisure' && (sub.includes('park') || sub.includes('garden') || sub.includes('nature')))) {
      return { primaryCategory: 'nature', subCategory: sub };
    }
    if (root === 'leisure') {
      return { primaryCategory: 'leisure', subCategory: sub };
    }
    if (root === 'tourism') {
      return { primaryCategory: 'tourism', subCategory: sub };
    }
    if (root === 'adult') {
      return { primaryCategory: 'nightlife', subCategory: sub };
    }
  }

  // General fallback
  const first = categories[0].toLowerCase();
  const parts = first.split('.');
  return {
    primaryCategory: parts[0] || 'other',
    subCategory: parts.slice(1).join('_') || 'other'
  };
}

/**
 * Greedy diversification algorithm using additive penalties.
 */
export function diversifyFeed(
  candidates: any[],
  options: { debug?: boolean } = {}
): any[] {
  const sorted = [...candidates].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const placed: any[] = [];
  const remaining = [...sorted];

  while (remaining.length > 0) {
    let bestIndex = -1;
    let bestAdjustedScore = -Infinity;
    const k = placed.length; // Next position to fill

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const { primaryCategory: prim, subCategory: sub } = normalizeCategory(item.categories || []);

      let countSubInPlaced = 0;
      let countPrimInPlaced = 0;

      for (const p of placed) {
        const pNorm = normalizeCategory(p.categories || []);
        if (pNorm.subCategory === sub) countSubInPlaced++;
        if (pNorm.primaryCategory === prim) countPrimInPlaced++;
      }

      let penalty = 0;

      // Rule 1: max 1 spot of same subCategory in Top 5 (indices 0 to 4)
      if (k < 5 && countSubInPlaced >= 1) {
        penalty += 15;
      }

      // Rule 2: max 2 spots of same primaryCategory in Top 10 (indices 0 to 9)
      if (k < 10 && countPrimInPlaced >= 2) {
        penalty += 10;
      }

      // Rule 3: max 4 spots of same subCategory in Top 20 (indices 0 to 19)
      if (countSubInPlaced >= 4) {
        penalty += 300; // Enforce hard cap of max 4
      } else if (k < 20 && countSubInPlaced === 3) {
        penalty += 15;
      }

      // Rule 4: max 5 spots of same primaryCategory in Top 20 (indices 0 to 19)
      if (countPrimInPlaced >= 5) {
        penalty += 300; // Enforce hard cap of max 5
      } else if (k < 20 && countPrimInPlaced === 4) {
        penalty += 12;
      }

      // Rule 4.5: other and landmark max 3 in Top 20 (indices 0 to 19)
      if (k < 20) {
        if (sub === 'other' && countSubInPlaced >= 3) {
          penalty += 300;
        }
        if (sub === 'landmark' && countSubInPlaced >= 3) {
          penalty += 300;
        }
      }

      // Special progressive repetition penalties for bar, swimming_pool, cinema, bowling in Top 20
      if (k < 20 && ['bar', 'swimming_pool', 'cinema', 'bowling'].includes(sub)) {
        if (countSubInPlaced >= 4) {
          penalty += 45;
        } else if (countSubInPlaced === 3) {
          penalty += 25;
        } else if (countSubInPlaced === 2) {
          penalty += 15;
        } else if (countSubInPlaced === 1) {
          penalty += 5;
        }
      }

      // Rule 5: no direct repetition of same subCategory within 5 positions (last 4 placed spots)
      let consecutivePenalty = 0;
      for (let j = 1; j <= 4; j++) {
        if (k - j >= 0) {
          const prevItem = placed[k - j];
          const prevNorm = normalizeCategory(prevItem.categories || []);
          if (prevNorm.subCategory === sub) {
            const distPenalty = [20, 12, 6, 3][j - 1];
            consecutivePenalty = Math.max(consecutivePenalty, distPenalty);
          }
        }
      }
      penalty += consecutivePenalty;

      // Additive score adjustment (compare unclamped to keep penalty resolution)
      const adjustedScore = item.relevanceScore - penalty;

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) break;

    const selected = remaining.splice(bestIndex, 1)[0];
    selected.scores = selected.scores || {};
    const clampedScore = Math.max(0.1, bestAdjustedScore);
    selected.scores.adjustedRelevance = clampedScore;
    selected.scores.diversityPenalty = selected.relevanceScore - clampedScore; // Additive penalty amount

    selected.relevanceScore = clampedScore;
    placed.push(selected);
  }

  return placed;
}

/**
 * Main unified ranking entry point (Phase 1 -> Phase 2 -> Phase 3).
 */
export function rankPlacesPipeline(
  places: any[],
  userProfile: any,
  userLocation: { lat: number; lng: number } | null,
  sessionEpoch: number,
  options: { debug?: boolean } = {}
): any[] {
  if (!places || places.length === 0) return [];

  const K = 100;
  const sigma_u = calculateMedianDistanceToNearestK(places, userLocation, 30);

  // Phase 1: Base Scoring
  const baseScored = places.map(place => {
    const categories = place.categories || [];
    const distance = typeof place.distance === 'number' ? place.distance : 0;

    let rawName = place.name;
    if (typeof rawName !== 'string') {
      rawName = place.placeName;
    }
    if (typeof rawName !== 'string') {
      rawName = place.title;
    }
    if (typeof rawName !== 'string') {
      rawName = "";
      if (process.env.NODE_ENV === 'development') {
        console.warn("[RANKING WARNING] rankPlacesPipeline: place name is not a string", place);
      }
    }
    const name: string = rawName;

    let placeSigma = sigma_u;
    const isPremium = categories.some((cat: string) => 
      cat.startsWith('entertainment') || 
      cat.startsWith('adult') || 
      cat === 'catering.pub' || cat.startsWith('catering.pub.') ||
      cat === 'catering.bar' || cat.startsWith('catering.bar.')
    );
    const isLocal = categories.some((cat: string) => 
      cat === 'catering.cafe' || cat.startsWith('catering.cafe.') ||
      cat === 'catering.bakery' || cat.startsWith('catering.bakery.')
    );

    if (isPremium) {
      placeSigma = Math.max(10.0, placeSigma);
    } else if (isLocal) {
      placeSigma = Math.min(1.5, placeSigma);
    } else {
      placeSigma = Math.max(3.0, Math.min(5.0, placeSigma));
    }

    const hasExtendedRadius = userProfile?.isPremium || (userProfile?.premiumEntitlements && userProfile.premiumEntitlements.includes('extended_radius'));
    if (hasExtendedRadius) {
      placeSigma = placeSigma * 1.25;
    }

    const prior = computeBasePrior(categories);
    const decay = computeDistanceDecay(distance, placeSigma);
    const personalization = computePersonalizationMultiplier(categories, userProfile);
    const commScore = 0; // Bypassed

    const baseScoreVal = computeBaseScore(prior, decay, commScore, personalization);
    const interestWeight = getPlaceAffinities(categories, userProfile?.categoryAffinities);
    const boostMultiplier = isEntityBoosted(place) ? 1.06 : 1.0;
    const unadjustedBaseRankingScore = baseScoreVal * boostMultiplier * interestWeight;

    const isFromFirestore = !!(place.isFromFirestore || place.source === 'firestore');
    const { qualityPenalty, activityBoost } = computeAdjustments(
      categories,
      name,
      place.voteBoostScore || 0,
      unadjustedBaseRankingScore,
      isFromFirestore
    );

    const baseScore = baseScoreVal + activityBoost - qualityPenalty;
    const baseRankingScore = baseScore * boostMultiplier * interestWeight;
    const finalScore = baseRankingScore + (place.voteBoostScore || 0);

    const contextScores: RankingScores = {
      basePrior: prior,
      distanceDecay: decay,
      personalizationBoost: personalization,
      communityQuality: commScore,
      diversityPenalty: 0.0,
      geoPenalty: 1.0,
      consecutivePenalty: 0.0,
      jitterApplied: 1.0,
      finalRelevance: finalScore
    };

    return {
      ...place,
      relevanceScore: finalScore,
      scores: contextScores,
      qualityPenalty,
      activityBoost,
      isGenericName: isGenericPlaceName(name)
    };
  });

  // Sort by base score descending before applying diversity re-ranking
  baseScored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Separate Top K candidates for re-ranking
  const topK = baseScored.slice(0, K);
  const tail = baseScored.slice(K);

  // Phase 2: Diversity Re-Ranking (using our new diversifyFeed algorithm)
  let reranked = diversifyFeed(topK, { debug: options.debug });
  reranked = applyGeoDiversityPenalty(reranked, 0.2, 0.50);

  // Phase 3: Post-Processing (Jitter & Stable Ordering)
  const userId = userProfile?.uid || 'anonymous';
  const finalTopK = reranked.map(place => {
    const jitter = applyDeterministicJitter(userId, place.id, sessionEpoch, 0.015);
    place.relevanceScore = place.relevanceScore * jitter;
    place.scores.jitterApplied = jitter;
    place.scores.finalRelevance = place.relevanceScore;

    // Attach complete ranking context
    place.rankingContext = buildRankingContext(place, place.scores);

    return place;
  });

  const finalTail = tail.map(place => {
    place.rankingContext = buildRankingContext(place, place.scores);
    return place;
  });

  const allScored = [...finalTopK, ...finalTail];

  // Final Stable Sort
  allScored.sort((a, b) => {
    const diff = b.relevanceScore - a.relevanceScore;
    if (Math.abs(diff) > 0.0001) {
      return diff;
    }
    return applyTieBreaker(a, b);
  });

  // Debug Telemetry
  if (allScored.length > 0) {
    debugLog('ranking', `Top 5 spot relevance adjustments:`);
    allScored.slice(0, 5).forEach((spot, idx) => {
      const cats = spot.categories || [];
      const interestWeight = getPlaceAffinities(cats, userProfile?.categoryAffinities);
      debugLog('ranking', `  #${idx + 1}: ${spot.name || spot.id} (Category: ${cats[0] || 'unknown'}), Base: ${(spot.relevanceScore / (interestWeight || 1.0)).toFixed(2)}, Weight: ${interestWeight.toFixed(2)}, Final: ${spot.relevanceScore.toFixed(2)}`);
    });
  }

  return allScored;
}

/**
 * Legacy API compatibility wrapper
 */
export function calculateRelevance(
  item: any,
  userProfile: any,
  userLocation: { lat: number; lng: number },
  options: { debug?: boolean } = {}
): number {
  if (!item) return 0;
  const K = calculateMedianDistanceToNearestK([item], userLocation, 30);
  const categories = item.categories || [];

  let placeSigma = K;
  const isPremium = categories.some((cat: string) => 
    cat.startsWith('entertainment') || 
    cat.startsWith('adult') || 
    cat === 'catering.pub' || cat.startsWith('catering.pub.') ||
    cat === 'catering.bar' || cat.startsWith('catering.bar.')
  );
  const isLocal = categories.some((cat: string) => 
    cat === 'catering.cafe' || cat.startsWith('catering.cafe.') ||
    cat === 'catering.bakery' || cat.startsWith('catering.bakery.')
  );

  if (isPremium) {
    placeSigma = Math.max(10.0, placeSigma);
  } else if (isLocal) {
    placeSigma = Math.min(1.5, placeSigma);
  } else {
    placeSigma = Math.max(3.0, Math.min(5.0, placeSigma));
  }

  const hasExtendedRadius = userProfile?.isPremium || (userProfile?.premiumEntitlements && userProfile.premiumEntitlements.includes('extended_radius'));
  if (hasExtendedRadius) {
    placeSigma = placeSigma * 1.25;
  }

  const prior = computeBasePrior(categories);
  const decay = computeDistanceDecay(item.distance || 0, placeSigma);
  const personalization = computePersonalizationMultiplier(categories, userProfile);
  const commScore = 0; // Bypassed
  const baseScoreVal = computeBaseScore(prior, decay, commScore, personalization);
  const interestWeight = getPlaceAffinities(categories, userProfile?.categoryAffinities);
  const boostMultiplier = isEntityBoosted(item) ? 1.06 : 1.0;

  const unadjustedBaseRankingScore = baseScoreVal * boostMultiplier * interestWeight;
  const isFromFirestore = !!(item.isFromFirestore || item.source === 'firestore');
  const { qualityPenalty, activityBoost } = computeAdjustments(
    categories,
    item.name || "",
    item.voteBoostScore || 0,
    unadjustedBaseRankingScore,
    isFromFirestore
  );

  const baseScore = baseScoreVal + activityBoost - qualityPenalty;
  const baseRankingScore = baseScore * boostMultiplier * interestWeight;
  return Number((baseRankingScore + (item.voteBoostScore || 0)).toFixed(1));
}
