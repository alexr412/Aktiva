import type { Place, Activity } from '@/lib/types';

export type MapLayerVisibility = {
  places: boolean;
  activities: boolean;
  friends: boolean; // Pre-structured for Phase 2; remains false & hidden in UI for Phase 1
};

export type ActivityCapacityStatus = 'open' | 'almost_full' | 'full';

export interface MapMarkerItem {
  id: string;
  type: 'place' | 'activity';
  title: string;
  lat: number;
  lon: number;
  category?: string;
  categories?: string[];
  capacityStatus?: ActivityCapacityStatus;
  isBoosted?: boolean;
  participantCount?: number;
  maxParticipants?: number;
  rawItem: Place | Activity;
}

import type { NearbyFriend } from '@/hooks/use-friend-radar';

export type SelectedMapEntity = {
  id: string;
  type: 'place' | 'activity' | 'friend';
  data: Place | Activity | NearbyFriend;
} | null;

export interface MapViewState {
  center: [number, number]; // [lon, lat] for MapLibre
  zoom: number;
  selectedEntity: SelectedMapEntity;
}
