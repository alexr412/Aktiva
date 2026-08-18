import type { Place, UserProfile } from '@/lib/types';

export interface UserLocation {
  lat: number;
  lng: number;
}

export interface VoteData {
  upvotes: number;
  downvotes: number;
  weightedUpvotes: number;
  weightedDownvotes: number;
  voteBoostScore: number;
}

export type VotesMap = Record<string, VoteData>;

export interface OrchestrateFeedOptions {
  basePlaces: Place[];
  votesMap: VotesMap;
  userProfile?: UserProfile | null;
  userLocation?: UserLocation | null;
  sessionEpoch?: number;
  activePremiumFilters?: string[];
  enableNewRankingPipeline?: boolean;
}
