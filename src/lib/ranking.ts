'use client';

import { calculateDistance } from './geo-utils';

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
    const commScore = computeCommunityScore(place.upvotes || 0, place.downvotes || 0);

    const baseScore = computeBaseScore(prior, decay, commScore, personalization);
    const boostMultiplier = isEntityBoosted(place) ? 1.06 : 1.0;
    const finalScore = baseScore * boostMultiplier;

    const contextScores: RankingScores = {
      basePrior: prior,
      distanceDecay: decay,
      personalizationBoost: personalization,
      communityQuality: commScore,
      diversityPenalty: 1.0,
      geoPenalty: 1.0,
      consecutivePenalty: 1.0,
      jitterApplied: 1.0,
      finalRelevance: finalScore
    };

    return {
      ...place,
      relevanceScore: finalScore,
      scores: contextScores
    };
  });

  // Sort by base score descending before applying diversity re-ranking
  baseScored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Separate Top K candidates for re-ranking
  const topK = baseScored.slice(0, K);
  const tail = baseScored.slice(K);

  // Phase 2: Diversity Re-Ranking
  let reranked = applyCategoryDiversityRerank(topK, 0.70, 0.15);
  reranked = applyGeoDiversityPenalty(reranked, 0.2, 0.50);
  reranked = applyDiversityShift(reranked, 0.95);

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
  if (options.debug && allScored.length > 0) {
    // Debug telemetry print disabled
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
  const commScore = computeCommunityScore(item.upvotes || 0, item.downvotes || 0);
  const baseScore = computeBaseScore(prior, decay, commScore, personalization);
  const boostMultiplier = isEntityBoosted(item) ? 1.06 : 1.0;
  return Number((baseScore * boostMultiplier).toFixed(1));
}
