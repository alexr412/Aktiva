import type { Place } from '@/lib/types';
import { calculateRelevance, rankPlacesPipeline } from '@/lib/ranking';
import { isDuplicate } from '@/lib/duplicate-detector';
import { monitoring } from '@/lib/monitoring';
import { applyPremiumFeedFilters } from './feed-filters';
import type { OrchestrateFeedOptions } from './feed-types';

/**
 * Mechanisch extrahierte Feed-Pipeline Orchestrierung.
 * Führt exakt dieselbe Verarbeitungs- und Ranking-Sequenz wie die ursprüngliche page.tsx aus.
 */
export function orchestrateFeedPipeline(options: OrchestrateFeedOptions): Place[] {
  const {
    basePlaces,
    votesMap,
    userProfile,
    userLocation,
    sessionEpoch = 0,
    activePremiumFilters,
    enableNewRankingPipeline = true,
  } = options;

  if (!basePlaces || basePlaces.length === 0) return [];

  let finalPlaces: Place[] = [];

  if (enableNewRankingPipeline) {
    const placesWithVotes = basePlaces.map(place => {
      const votes = votesMap[place.id] || { upvotes: 0, downvotes: 0, weightedUpvotes: 0, weightedDownvotes: 0, voteBoostScore: 0 };
      return {
        ...place,
        upvotes: votes.upvotes,
        downvotes: votes.downvotes,
        voteBoostScore: votes.voteBoostScore,
      };
    });

    const ranked = rankPlacesPipeline(
      placesWithVotes,
      (userProfile || { role: 'user' }) as any,
      userLocation || null,
      sessionEpoch,
      { debug: false }
    );

    // Filter duplicates
    for (const place of ranked) {
      if (!finalPlaces.some(u => isDuplicate(u, place))) {
        finalPlaces.push(place);
      }
    }
  } else {
    const scored = basePlaces.map(place => {
      const votes = votesMap[place.id] || { upvotes: 0, downvotes: 0, weightedUpvotes: 0, weightedDownvotes: 0, voteBoostScore: 0 };
      const rawScore = calculateRelevance(
        { ...place, upvotes: votes.upvotes, downvotes: votes.downvotes, voteBoostScore: votes.voteBoostScore },
        (userProfile || { role: 'user' }) as any,
        userLocation || { lat: 0, lng: 0 },
        { debug: false }
      );
      const relevanceScore = typeof rawScore === 'number' && isFinite(rawScore) ? rawScore : 0;
      return { ...place, relevanceScore };
    });

    // Strict descending sort by numeric score
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Filter duplicates
    for (const place of scored) {
      if (!finalPlaces.some(u => isDuplicate(u, place))) {
        finalPlaces.push(place);
      }
    }
  }

  // Apply activePremiumFilters if user is Premium
  finalPlaces = applyPremiumFeedFilters(finalPlaces, activePremiumFilters, userProfile);

  monitoring.logFeedSize(finalPlaces.length);
  return finalPlaces;
}
