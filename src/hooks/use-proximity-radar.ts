'use client';

import type { UserProfile } from '@/lib/types';

/**
 * Phase 2 Safety Update:
 * Legacy client proximity radar direct raw location reads are safely disabled.
 * Phase 3 will consume the privacy-safe getNearbyFriends Callable Function.
 */
export function useProximityRadar(): UserProfile[] {
  return [];
}
