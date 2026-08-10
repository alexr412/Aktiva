'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, MapPin, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MapEntityCard } from './map-entity-card';
import type { Place, Activity } from '@/lib/types';
import type { SelectedMapEntity } from './map-types';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface MapResultSheetProps {
  placesCount: number;
  activitiesCount: number;
  places: Place[];
  activities: Activity[];
  selectedEntity: SelectedMapEntity;
  onSelectEntity: (entity: SelectedMapEntity) => void;
  onCloseDetails: () => void;
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

export function MapResultSheet({
  placesCount,
  activitiesCount,
  places,
  activities,
  selectedEntity,
  onSelectEntity,
  onCloseDetails,
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
}: MapResultSheetProps) {
  const { user } = useAuth();
  const [snapState, setSnapState] = useState<'collapsed' | 'half' | 'full'>('collapsed');

  const toggleSnap = () => {
    if (snapState === 'collapsed') setSnapState('half');
    else if (snapState === 'half') setSnapState('full');
    else setSnapState('collapsed');
  };

  const totalCount = placesCount + activitiesCount;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 transition-all duration-300 pointer-events-none mb-bottom-nav-safe lg:mb-0',
        selectedEntity ? 'h-auto max-h-[80dvh]' : snapState === 'collapsed' ? 'h-16' : snapState === 'half' ? 'h-[45dvh]' : 'h-[85dvh]',
        className
      )}
    >
      <div className="w-full h-full bg-white/95 dark:bg-neutral-900/95 rounded-t-[2.5rem] shadow-2xl border-t border-slate-200/80 dark:border-neutral-800 flex flex-col pointer-events-auto overflow-hidden backdrop-blur-md">
        {/* Sheet Drag Handle & Summary Header */}
        {!selectedEntity && (
          <div
            onClick={toggleSnap}
            className="w-full py-2.5 px-6 flex flex-col items-center justify-center cursor-pointer select-none shrink-0 border-b border-slate-100 dark:border-neutral-800/60 hover:bg-slate-50 dark:hover:bg-neutral-850 transition-colors"
          >
            {/* Visual Grab Bar */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-neutral-700 rounded-full mb-1.5" />

            {/* Result Count Summary */}
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                {language === 'de'
                  ? `${totalCount} Ergebnisse in deiner Nähe`
                  : `${totalCount} results near you`}
              </span>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400">
                <span>{placesCount} Orte</span>
                <span>•</span>
                <span>{activitiesCount} Events</span>
                {snapState === 'collapsed' ? (
                  <ChevronUp className="h-4 w-4 text-slate-400 ml-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400 ml-1" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selected Entity Details Overlay */}
        {selectedEntity ? (
          <div className="p-4 overflow-y-auto max-h-[75vh]">
            <MapEntityCard
              entity={selectedEntity}
              userLocation={userLocation}
              currentUserId={user?.uid}
              isFavorite={isFavorite}
              isFavoriteLoading={isFavoriteLoading}
              onToggleFavorite={onToggleFavorite}
              onClose={onCloseDetails}
              onViewDetails={onViewDetails}
              onJoinActivity={onJoinActivity}
              language={language}
              isLocationCurrent={isLocationCurrent}
            />
          </div>
        ) : (
          /* List View of Places & Activities */
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {places.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Orte</h4>
                <div className="space-y-2">
                  {places.map((place) => (
                    <div
                      key={place.id}
                      onClick={() => onSelectEntity({ id: place.id, type: 'place', data: place })}
                      className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-750 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-800 dark:text-neutral-100">{place.name}</div>
                        <div className="text-xs text-slate-400">{place.address || place.category}</div>
                      </div>
                      <ChevronUp className="h-4 w-4 text-slate-400 rotate-90" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activities.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase text-slate-400 mb-2">Aktivitäten</h4>
                <div className="space-y-2">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      onClick={() => onSelectEntity({ id: act.id!, type: 'activity', data: act })}
                      className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-purple-100/50 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-800 dark:text-neutral-100">{act.title || act.name}</div>
                        <div className="text-xs text-purple-600 dark:text-purple-400">{act.category || 'Community'}</div>
                      </div>
                      <ChevronUp className="h-4 w-4 text-slate-400 rotate-90" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
