'use client';

import React from 'react';
import { X, MapPin, Calendar, Users, Star, Share2, Navigation, Heart, ChevronRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Place, Activity } from '@/lib/types';
import type { NearbyFriend } from '@/hooks/use-friend-radar';
import type { SelectedMapEntity } from './map-types';
import { formatPlaceDistance, getPlaceCategoryIconSVG, getActivityJoinState, formatActivityDateTime } from './map-marker-data';
import { getPrimaryIconData } from '@/lib/tag-config';
import { formatDistanceBucketText, normalizePrecisionMeters } from '@/lib/radar-types';
import { cn } from '@/lib/utils';
import { useAddressLongPress } from '@/hooks/use-address-long-press';

export interface MapEntityCardProps {
  entity: SelectedMapEntity;
  userLocation?: { lat: number; lng: number } | null;
  currentUserId?: string;
  isFavorite?: boolean;
  isFavoriteLoading?: boolean;
  onToggleFavorite?: (place: Place) => void;
  onClose: () => void;
  onViewDetails?: (entity: SelectedMapEntity) => void;
  onRoute?: (place: Place) => void;
  onShare?: (entity: SelectedMapEntity) => void;
  onJoinActivity?: (activity: Activity) => Promise<any>;
  onViewProfile?: (friend: NearbyFriend) => void;
  onSendMessage?: (friend: NearbyFriend) => void;
  language?: 'de' | 'en';
  className?: string;
  isLocationCurrent?: boolean;
}

export function MapEntityCard({
  entity,
  userLocation = null,
  currentUserId,
  isFavorite = false,
  isFavoriteLoading = false,
  onToggleFavorite,
  onClose,
  onViewDetails,
  onRoute,
  onShare,
  onJoinActivity,
  onViewProfile,
  onSendMessage,
  language = 'de',
  className,
  isLocationCurrent = true,
}: MapEntityCardProps) {
  if (!entity || !entity.data) return null;

  const isDe = language === 'de';

  if (entity.type === 'place') {
    const place = entity.data as Place;
    const placeMeta = getPrimaryIconData(place, language);
    const MetaIcon = placeMeta.icon;
    const category = placeMeta.label;
    const name = place.name || (isDe ? 'Unbenannter Ort' : 'Unnamed place');
    const ratingText = typeof place.rating === 'number' && place.rating > 0 ? place.rating.toFixed(1) : null;
    const distText = formatPlaceDistance(place.lat, place.lon ?? (place as any).lng, userLocation, language);
    const isOpen = (place as any).isOpenNow;
    const openStatusText =
      isOpen === true
        ? (isDe ? 'Jetzt geöffnet' : 'Open now')
        : isOpen === false
        ? (isDe ? 'Geschlossen' : 'Closed')
        : '';

    return (
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[24px] bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-md border border-slate-200/80 dark:border-neutral-800 shadow-2xl flex flex-col cursor-pointer group transition-all max-w-sm mx-auto overflow-x-hidden',
          className
        )}
      >
        {/* Header Bar */}
        <div className={cn('relative w-full h-28 overflow-hidden flex items-center justify-center shrink-0', placeMeta.gradientClass)}>
          {/* Favorite Button (Left) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleFavorite) onToggleFavorite(place);
            }}
            disabled={isFavoriteLoading}
            className={cn(
              'absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center transition-all z-20 shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-400',
              isFavorite ? 'bg-rose-500 text-white' : 'bg-black/40 hover:bg-black/60 text-white'
            )}
            aria-label={
              isFavorite
                ? (isDe ? 'Favorit entfernen' : 'Remove favorite')
                : (isDe ? 'Als Favorit speichern' : 'Save as favorite')
            }
          >
            <Heart className={cn('w-4 h-4', isFavorite ? 'fill-white' : 'fill-none')} />
          </button>

          {/* Close Button (Right) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all z-20 shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label={isDe ? 'Schließen' : 'Close'}
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Center Category Icon */}
          <MetaIcon className="w-10 h-10 text-white/95 drop-shadow-md" />

          {/* Category Pill */}
          <div className="absolute bottom-2.5 left-3 bg-white/95 dark:bg-neutral-900/90 text-slate-900 dark:text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-white/20 shadow-sm">
            {category}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 flex flex-col gap-1.5 text-left min-w-0">
          <div className="font-black text-base text-slate-900 dark:text-white leading-tight line-clamp-2">
            {name}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-neutral-300 truncate">
            {ratingText && (
              <span className="inline-flex items-center gap-0.5 text-amber-500 font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 inline" />
                {ratingText} ★
              </span>
            )}
            {distText && <span className="text-slate-400 dark:text-neutral-400">• {distText}</span>}
          </div>

          <PlaceAddressLink place={place} language={language} isDe={isDe} openStatusText={openStatusText} isOpen={isOpen} />

          {/* Primary & Secondary Actions */}
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onViewDetails) onViewDetails(entity);
              }}
              className="min-h-[44px] w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{isDe ? 'Details ansehen' : 'View details'}</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRoute) onRoute(place);
                  else {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon ?? (place as any).lng}`;
                    window.open(url, '_blank');
                  }
                }}
                className="flex-1 min-h-[44px] py-2 px-3 bg-slate-200/80 hover:bg-slate-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Route</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onShare) onShare(entity);
                  else if (navigator.share) {
                    navigator.share({ title: name, text: name, url: window.location.href }).catch(() => {});
                  }
                }}
                className="flex-1 min-h-[44px] py-2 px-3 bg-slate-200/80 hover:bg-slate-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{isDe ? 'Teilen' : 'Share'}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (entity.type === 'activity') {
    const activity = entity.data as Activity;
    const title = activity.title || activity.name || activity.placeName || (isDe ? 'Aktivität' : 'Activity');
    const category = activity.category || (isDe ? 'Community' : 'Community');
    const dateTimeStr = formatActivityDateTime(activity.activityDate, activity.isTimeFlexible, language);
    const locationName = activity.placeName || activity.locationLabel || activity.address || (isDe ? 'Ort' : 'Location');
    const hostName = activity.hostUsername || activity.hostName || 'host';

    const count = activity.participantIds?.length ?? (activity.participantsPreview?.length || 1);
    const max = activity.maxParticipants ?? 4;
    const joinState = getActivityJoinState(activity, currentUserId, language);

    return (
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[24px] bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-md border border-purple-500/30 dark:border-purple-600/30 shadow-2xl flex flex-col cursor-pointer group transition-all max-w-sm mx-auto overflow-x-hidden',
          className
        )}
      >
        {/* Header Bar */}
        <div className="relative w-full h-28 bg-gradient-to-br from-violet-600 to-purple-700 overflow-hidden flex items-center justify-center shrink-0">
          {/* Close Button (Right) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all z-20 shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-purple-400"
            aria-label={isDe ? 'Schließen' : 'Close'}
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Center Cover Image or Calendar Icon */}
          {activity.imageUrl ? (
            <img src={activity.imageUrl} className="w-full h-full object-cover" alt={title} />
          ) : (
            <Calendar className="w-12 h-12 text-purple-100/80" />
          )}

          {/* Category Pill */}
          <div className="absolute bottom-2.5 left-3 bg-purple-950/80 text-purple-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full backdrop-blur-sm border border-purple-500/30">
            {category}
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 flex flex-col gap-1.5 text-left min-w-0">
          <div className="font-black text-base text-slate-900 dark:text-white leading-tight line-clamp-2">
            {title}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-300 truncate">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{dateTimeStr}</span>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-neutral-400 flex items-center justify-between gap-1 truncate">
            <span className="truncate">{locationName}</span>
            <span className="font-bold shrink-0 text-slate-700 dark:text-neutral-200">
              {count}/{max} {isDe ? 'Teilnehmer' : 'joined'}
            </span>
          </div>

          <div className="text-[10px] text-slate-400 dark:text-neutral-400 italic truncate">
            {isDe ? 'Organisiert von' : 'Hosted by'} @{hostName}
          </div>

          {/* Primary & Secondary Actions */}
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              disabled={joinState.disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (onJoinActivity) onJoinActivity(activity);
              }}
              className={cn(
                'flex-1 min-h-[44px] py-2.5 px-4 font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer',
                joinState.btnClass
              )}
            >
              <span>{joinState.label}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                if (onViewDetails) onViewDetails(entity);
              }}
              className="min-h-[44px] py-2 px-4 bg-slate-200/80 hover:bg-slate-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Details</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (entity.type === 'friend') {
    const friend = entity.data as NearbyFriend;
    const fullName = friend.displayName || friend.username;
    const initial = (fullName || '?').substring(0, 1).toUpperCase();
    const distText = formatDistanceBucketText(friend.distanceBucket, language);
    const precMeters = normalizePrecisionMeters(friend);

    return (
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-[24px] bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-md border border-slate-200/80 dark:border-neutral-700/80 shadow-2xl flex flex-col items-center text-center cursor-pointer group transition-all max-w-sm mx-auto overflow-x-hidden',
          className
        )}
      >
        {/* Header Bar */}
        <div className="relative w-full h-24 bg-gradient-to-br from-blue-600 to-indigo-600 overflow-hidden flex items-center justify-center shrink-0">
          {/* Close Button (Right) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all z-20 shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label={isDe ? 'Schließen' : 'Close'}
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Floating Avatar Overlay */}
        <div className="-mt-10 w-20 h-20 rounded-full overflow-hidden border-4 border-white dark:border-neutral-900 ring-4 ring-blue-500/20 shadow-xl flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 z-10 shrink-0">
          {friend.avatarUrl ? (
            <img src={friend.avatarUrl} className="w-full h-full object-cover rounded-full" alt={fullName} />
          ) : (
            <span className="text-white text-2xl font-black">{initial}</span>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4 pt-2 flex flex-col items-center text-center w-full min-w-0">
          <div className="font-black text-base tracking-tight text-slate-900 dark:text-white leading-snug truncate w-full">
            {fullName}
          </div>
          <div className="text-xs font-medium text-slate-400 dark:text-neutral-400 mb-2 truncate w-full">
            @{friend.username}
          </div>

          <div className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[11px] font-bold px-3 py-1 rounded-full mb-2 border border-blue-200/80 dark:border-blue-800/80 shadow-sm">
            <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span>{distText}</span>
          </div>

          <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-medium italic bg-slate-100/70 dark:bg-neutral-800/50 px-2.5 py-1 rounded-lg w-full mb-3 border border-slate-200/40 dark:border-neutral-700/40 truncate">
            {isDe
              ? `Ungefährer Standort (~${precMeters}-Meter-Raster)`
              : `Approximate location (~${precMeters}m grid)`}
          </div>

          {/* Primary & Secondary Actions */}
          <div className="w-full flex items-center gap-2">
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onViewProfile) onViewProfile(friend);
              }}
              className="flex-1 min-h-[44px] py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>{isDe ? 'Profil ansehen' : 'View profile'}</span>
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </Button>
            {onSendMessage && (
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onSendMessage(friend);
                }}
                className="min-h-[44px] py-2 px-3 bg-slate-200/80 hover:bg-slate-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Chat</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function PlaceAddressLink({
  place,
  language,
  isDe,
  openStatusText,
  isOpen,
}: {
  place: Place;
  language: 'de' | 'en';
  isDe: boolean;
  openStatusText?: string;
  isOpen?: boolean;
}) {
  const addressText = place.address || (place as any).city || '';
  const { mapsUrl, handlers } = useAddressLongPress({
    address: addressText,
    placeName: place.name,
    language,
  });

  return (
    <div className="text-[11px] text-slate-500 dark:text-neutral-400 truncate flex items-center gap-1.5 flex-wrap">
      {openStatusText && (
        <span className={cn('font-bold shrink-0', isOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
          {openStatusText}
        </span>
      )}
      {addressText ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          {...handlers}
          className="text-rose-500 hover:text-rose-600 font-medium underline decoration-rose-500/40 underline-offset-2 select-none cursor-pointer truncate max-w-full"
          style={{ WebkitTouchCallout: 'none' }}
          title={isDe ? 'Antippen zum Öffnen, gedrückt halten zum Kopieren' : 'Tap to open, hold to copy'}
        >
          {addressText}
        </a>
      ) : null}
    </div>
  );
}
