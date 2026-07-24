'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, MapPin, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaceDetails } from '@/components/aktiva/place-details';
import { ActivityListItem } from '@/components/aktiva/activity-list-item';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
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
  language?: 'de' | 'en';
  className?: string;
  isLocationCurrent?: boolean;
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
  language = 'de',
  className,
  isLocationCurrent = true,
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
        'fixed bottom-0 left-0 right-0 z-30 transition-all duration-300 pointer-events-none pb-safe',
        snapState === 'collapsed' && 'h-16',
        snapState === 'half' && 'h-[45vh]',
        snapState === 'full' && 'h-[85vh]',
        className
      )}
    >
      <div className="w-full h-full bg-white dark:bg-neutral-900 rounded-t-[2.5rem] shadow-2xl border-t border-slate-200/80 dark:border-neutral-800 flex flex-col pointer-events-auto overflow-hidden">
        {/* Sheet Drag Handle & Summary Header */}
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

        {/* Selected Entity Details Overlay (if selected) */}
        {selectedEntity ? (
          <div className="flex-1 overflow-y-auto pb-20">
            <div className="p-3 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between bg-slate-50 dark:bg-neutral-900">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                {selectedEntity.type === 'place'
                  ? (language === 'de' ? 'Ort Details' : 'Place Details')
                  : selectedEntity.type === 'friend'
                  ? (language === 'de' ? 'Freund Details' : 'Friend Details')
                  : (language === 'de' ? 'Aktivität Details' : 'Activity Details')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCloseDetails}
                className="h-7 px-2 text-xs font-bold text-slate-600 dark:text-neutral-300"
              >
                {language === 'de' ? 'Zurück zur Liste' : 'Back to list'}
              </Button>
            </div>
            {selectedEntity.type === 'place' ? (
              <PlaceDetails
                place={selectedEntity.data as Place}
                onClose={onCloseDetails}
                onCreateActivity={
                  onCreateActivity ? () => onCreateActivity(selectedEntity.data as Place) : () => {}
                }
              />
            ) : selectedEntity.type === 'friend' ? (
              <div className="p-6 flex flex-col items-center text-center space-y-4">
                <ProfileAvatar
                  photoURL={(selectedEntity.data as any).avatarUrl}
                  displayName={(selectedEntity.data as any).displayName || (selectedEntity.data as any).username}
                  className="w-20 h-20 text-xl border-4 border-blue-500/20"
                />
                 <div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-neutral-200">
                    {(selectedEntity.data as any).displayName || (selectedEntity.data as any).username}
                  </h4>
                  {((selectedEntity.data as any).displayName) && (
                    <p className="text-xs text-slate-400">@{(selectedEntity.data as any).username}</p>
                  )}
                  {!isLocationCurrent && (
                    <div className="inline-block bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-3 py-1 rounded-full mt-2">
                      {language === 'de' ? 'Standort nicht aktuell (ausser Sicht)' : 'Location out of view'}
                    </div>
                  )}
                </div>

                <div className="w-full border border-slate-100 dark:border-neutral-800 rounded-3xl p-4 bg-slate-50/50 dark:bg-neutral-900/50 space-y-3 text-left">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{language === 'de' ? 'Entfernung:' : 'Distance:'}</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {isLocationCurrent
                        ? formatDistanceBucket((selectedEntity.data as any).distanceBucket, language)
                        : (language === 'de' ? 'Nicht verfügbar' : 'Unavailable')}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{language === 'de' ? 'Zuletzt aktiv:' : 'Last active:'}</span>
                    <span className="font-bold text-slate-700 dark:text-neutral-300">
                      {formatRelativeTime((selectedEntity.data as any).updatedAt, language)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <ActivityListItem
                  activity={selectedEntity.data as Activity}
                  user={user}
                  onJoin={onJoinActivity || (async () => {})}
                />
              </div>
            )}
          </div>
        ) : (
          /* List View of Places & Activities */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
            {totalCount === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                {language === 'de'
                  ? 'Keine Treffer im ausgewählten Radius.'
                  : 'No results in selected radius.'}
              </div>
            ) : (
              <>
                {/* Activities Section */}
                {activities.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{language === 'de' ? 'Aktivitäten' : 'Activities'} ({activities.length})</span>
                    </div>
                    {activities.map((act) => (
                      <div
                        key={act.id}
                        onClick={() => onSelectEntity({ id: act.id!, type: 'activity', data: act })}
                        className="cursor-pointer transition-transform active:scale-[0.99]"
                      >
                        <ActivityListItem
                          activity={act}
                          user={user}
                          onJoin={onJoinActivity || (async () => {})}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Places Section */}
                {places.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{language === 'de' ? 'Orte' : 'Places'} ({places.length})</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {places.map((place) => (
                        <div
                          key={place.id}
                          onClick={() => onSelectEntity({ id: place.id, type: 'place', data: place })}
                          className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-100 dark:border-neutral-800 flex items-center justify-between cursor-pointer active:scale-98 transition-all"
                        >
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-neutral-100">{place.name}</div>
                            <div className="text-[10px] text-slate-400 font-medium truncate max-w-[240px]">{place.address}</div>
                          </div>
                          <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full shrink-0">
                            {place.categories?.[0] || 'Ort'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDistanceBucket(bucket: string, lang: 'de' | 'en'): string {
  switch (bucket) {
    case 'under_1_km':
      return lang === 'de' ? 'Unter 1 km' : 'Under 1 km';
    case '1_to_2_km':
      return '1 - 2 km';
    case '2_to_5_km':
      return '2 - 5 km';
    case '5_to_10_km':
      return '5 - 10 km';
    case '10_to_25_km':
      return '10 - 25 km';
    default:
      return bucket;
  }
}

function formatRelativeTime(updatedAt: any, lang: 'de' | 'en'): string {
  if (!updatedAt) return '-';
  const date = updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return lang === 'de' ? 'Gerade eben' : 'Just now';
  }
  if (diffMins < 60) {
    return lang === 'de' ? `Vor ${diffMins} Min.` : `${diffMins} min ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  return lang === 'de' ? `Vor ${diffHours} Std.` : `${diffHours} hr ago`;
}
