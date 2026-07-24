'use client';

import React from 'react';
import { X, MapPin, Calendar, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PlaceDetails } from '@/components/aktiva/place-details';
import { ActivityListItem } from '@/components/aktiva/activity-list-item';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import type { Place, Activity } from '@/lib/types';
import type { SelectedMapEntity } from './map-types';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface MapResultPanelProps {
  selectedEntity: SelectedMapEntity;
  onClose: () => void;
  onCreateActivity?: (place: Place) => void;
  onJoinActivity?: (activity: Activity) => Promise<any>;
  language?: 'de' | 'en';
  className?: string;
  isLocationCurrent?: boolean;
}

export function MapResultPanel({
  selectedEntity,
  onClose,
  onCreateActivity,
  onJoinActivity,
  language = 'de',
  className,
  isLocationCurrent = true,
}: MapResultPanelProps) {
  const { user } = useAuth();

  if (!selectedEntity) return null;

  return (
    <div
      className={cn(
        'w-96 max-w-[calc(100vw-2rem)] h-full bg-white dark:bg-neutral-900 border-l border-slate-200 dark:border-neutral-800 shadow-2xl z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300',
        className
      )}
    >
      {/* Panel Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/50 shrink-0">
        <div className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-neutral-400 uppercase tracking-wider">
          {selectedEntity.type === 'place' ? (
            <>
              <MapPin className="h-4 w-4 text-emerald-500" />
              <span>{language === 'de' ? 'Ort Details' : 'Place Details'}</span>
            </>
          ) : selectedEntity.type === 'friend' ? (
            <>
              <Users className="h-4 w-4 text-blue-500" />
              <span>{language === 'de' ? 'Freund Details' : 'Friend Details'}</span>
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 text-violet-500" />
              <span>{language === 'de' ? 'Aktivität Details' : 'Activity Details'}</span>
            </>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label={language === 'de' ? 'Detailschließen' : 'Close details'}
          className="h-8 w-8 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Panel Main Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {selectedEntity.type === 'place' ? (
          <PlaceDetails
            place={selectedEntity.data as Place}
            onClose={onClose}
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
          <div className="p-4 space-y-4">
            <ActivityListItem
              activity={selectedEntity.data as Activity}
              user={user}
              onJoin={onJoinActivity || (async () => {})}
            />
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
