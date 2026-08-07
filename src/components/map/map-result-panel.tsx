'use client';

import React from 'react';
import { X, MapPin, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MapEntityCard } from './map-entity-card';
import type { Place, Activity } from '@/lib/types';
import type { NearbyFriend } from '@/hooks/use-friend-radar';
import type { SelectedMapEntity } from './map-types';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface MapResultPanelProps {
  selectedEntity: SelectedMapEntity;
  onClose: () => void;
  onCreateActivity?: (place: Place) => void;
  onJoinActivity?: (activity: Activity) => Promise<any>;
  onViewDetails?: (entity: SelectedMapEntity) => void;
  userLocation?: { lat: number; lng: number } | null;
  language?: 'de' | 'en';
  className?: string;
  isLocationCurrent?: boolean;
  isFavorite?: boolean;
  isFavoriteLoading?: boolean;
  onToggleFavorite?: (place: Place) => void;
}

export function MapResultPanel({
  selectedEntity,
  onClose,
  onCreateActivity,
  onJoinActivity,
  onViewDetails,
  userLocation,
  language = 'de',
  className,
  isLocationCurrent = true,
  isFavorite = false,
  isFavoriteLoading = false,
  onToggleFavorite,
}: MapResultPanelProps) {
  const { user } = useAuth();

  if (!selectedEntity || !selectedEntity.data) return null;

  return (
    <div
      data-activa-side-panel
      className={cn(
        'w-96 max-w-[calc(100vw-2rem)] h-full bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-l border-slate-200 dark:border-neutral-800 shadow-2xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 pointer-events-auto p-4 overflow-y-auto',
        className
      )}
    >
      <MapEntityCard
        entity={selectedEntity}
        userLocation={userLocation}
        currentUserId={user?.uid}
        isFavorite={isFavorite}
        isFavoriteLoading={isFavoriteLoading}
        onToggleFavorite={onToggleFavorite}
        onClose={onClose}
        onViewDetails={onViewDetails}
        onJoinActivity={onJoinActivity}
        language={language}
        isLocationCurrent={isLocationCurrent}
      />
    </div>
  );
}
