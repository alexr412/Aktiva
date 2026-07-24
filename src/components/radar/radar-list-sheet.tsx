'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Eye, User } from 'lucide-react';
import { useFriendRadar, NearbyFriend } from '@/hooks/use-friend-radar';

interface RadarListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectFriendOnMap?: (friend: NearbyFriend) => void;
  language?: 'de' | 'en';
}

export function RadarListSheet({
  open,
  onOpenChange,
  onSelectFriendOnMap,
  language = 'de',
}: RadarListSheetProps) {
  const { nearbyFriends } = useFriendRadar();
  const isDe = language === 'de';

  const formatDistanceBucket = (bucket: string) => {
    switch (bucket) {
      case 'under_1_km':
        return isDe ? 'Unter 1 km' : 'Under 1 km';
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
  };

  const formatRelativeTime = (updatedAt: any) => {
    if (!updatedAt) return '-';
    const date = updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return isDe ? 'Gerade eben' : 'Just now';
    }
    if (diffMins < 60) {
      return isDe ? `Vor ${diffMins} Min.` : `${diffMins} min ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    return isDe ? `Vor ${diffHours} Std.` : `${diffHours} hr ago`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-[2.5rem] p-6 bg-white dark:bg-neutral-900 border-none">
        <SheetHeader className="text-left shrink-0">
          <SheetTitle className="text-xl font-black text-slate-800 dark:text-neutral-100 flex items-center gap-2">
            <Navigation className="h-5 w-5 text-blue-500 animate-pulse" />
            {isDe ? 'Freunde in deiner Nähe' : 'Nearby Friends'}
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-400 mt-1">
            {isDe
              ? 'Hier siehst du alle Freunde, die ihren Standort kürzlich geteilt haben.'
              : 'Here are all friends who recently shared their location.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-6 pr-1 space-y-3 pb-8 max-h-[calc(70vh-140px)]">
          {nearbyFriends.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 font-medium">
              {isDe
                ? 'Aktuell keine Freunde in der Nähe aktiv.'
                : 'No nearby friends active right now.'}
            </div>
          ) : (
            nearbyFriends.map((friend) => (
              <div
                key={friend.userId}
                className="p-4 bg-slate-50 dark:bg-neutral-800/40 rounded-3xl border border-slate-100 dark:border-neutral-800/80 flex items-center justify-between hover:bg-slate-100/50 dark:hover:bg-neutral-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ProfileAvatar
                    photoURL={friend.avatarUrl}
                    displayName={friend.displayName || friend.username}
                    className="w-12 h-12 text-sm border border-slate-100"
                  />
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-neutral-100">
                      {friend.displayName || friend.username}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 mt-0.5">
                      <span className="text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                        {formatDistanceBucket(friend.distanceBucket)}
                      </span>
                      <span>•</span>
                      <span>{formatRelativeTime(friend.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onSelectFriendOnMap && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        onSelectFriendOnMap(friend);
                        onOpenChange(false);
                      }}
                      className="h-9 w-9 rounded-full bg-slate-100/80 hover:bg-slate-200/90 text-slate-600 dark:bg-neutral-800 dark:hover:bg-neutral-750 dark:text-neutral-300"
                      title={isDe ? 'Auf Karte zeigen' : 'Show on Map'}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      window.location.href = `/users/${friend.userId}`;
                      onOpenChange(false);
                    }}
                    className="h-9 w-9 rounded-full bg-slate-100/80 hover:bg-slate-200/90 text-slate-600 dark:bg-neutral-800 dark:hover:bg-neutral-750 dark:text-neutral-300"
                    title={isDe ? 'Profil anzeigen' : 'Show Profile'}
                  >
                    <User className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
