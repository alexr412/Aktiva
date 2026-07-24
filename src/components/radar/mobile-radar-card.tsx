'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radar, Navigation, ArrowRight, Sparkles, MapPin } from 'lucide-react';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { useFriendRadar, NearbyFriend } from '@/hooks/use-friend-radar';
import { useActivePremium } from '@/hooks/use-active-premium';
import { useAuth } from '@/hooks/use-auth';
import { RadarConsentDialog } from './radar-consent-dialog';
import { RadarListSheet } from './radar-list-sheet';

interface MobileRadarCardProps {
  onSelectFriendOnMap?: (friend: NearbyFriend) => void;
  language?: 'de' | 'en';
}

export function MobileRadarCard({
  onSelectFriendOnMap,
  language = 'de',
}: MobileRadarCardProps) {
  const { userProfile } = useAuth();
  const { isPremium, isOrganizer } = useActivePremium(userProfile);
  const hasAccess = isPremium || isOrganizer;

  const {
    enabled,
    nearbyFriends,
    activateRadar,
    isUpdatingLocation,
  } = useFriendRadar();

  const [consentOpen, setConsentOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const isDe = language === 'de';

  const handleActivate = async () => {
    try {
      await activateRadar(5); // Default to 5 km on quick enable
    } catch (e) {
      console.error('Failed to quick-enable radar:', e);
    }
  };

  if (!hasAccess) {
    return (
      <Card className="rounded-[2.25rem] bg-gradient-to-br from-slate-50 to-blue-50/20 dark:from-neutral-900 dark:to-neutral-950 border-none p-5 shadow-sm">
        <CardContent className="p-0 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                {isDe ? 'Freunde-Radar' : 'Friends Radar'}
              </span>
              <Badge className="bg-amber-500 hover:bg-amber-600 text-[8px] font-black text-white px-1.5 py-0.5 rounded-full">
                PREMIUM
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 leading-relaxed">
              {isDe
                ? 'Sieh, welche Freunde sich ungefähr in deiner Nähe befinden. Aktiviere Premium, um loszulegen.'
                : 'See which friends are roughly near you. Upgrade to Premium to unlock.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!enabled) {
    return (
      <>
        <Card className="rounded-[2.25rem] bg-slate-50 dark:bg-neutral-900/50 border border-slate-100 dark:border-neutral-800/80 p-5 shadow-sm">
          <CardContent className="p-0 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-neutral-850 flex items-center justify-center shrink-0">
                <Radar className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <span className="text-xs font-black text-slate-800 dark:text-neutral-200 block">
                  {isDe ? 'Freunde-Radar inaktiv' : 'Friends Radar Inactive'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5 block leading-tight">
                  {isDe
                    ? 'Teile deinen ungefähren Standort, um Freunde in der Nähe zu sehen.'
                    : 'Share approximate location to see nearby friends.'}
                </span>
              </div>
            </div>

            <Button
              onClick={() => setConsentOpen(true)}
              className="rounded-full px-4 h-8 text-[10px] font-black bg-primary hover:bg-primary/95 text-white shrink-0 shadow-sm"
            >
              {isDe ? 'Aktivieren' : 'Enable'}
            </Button>
          </CardContent>
        </Card>

        <RadarConsentDialog
          open={consentOpen}
          onOpenChange={setConsentOpen}
          onAccept={handleActivate}
          onCancel={() => {}}
          language={language}
        />
      </>
    );
  }

  if (nearbyFriends.length === 0) {
    return (
      <Card className="rounded-[2.25rem] bg-slate-50 dark:bg-neutral-900/50 border border-slate-100 dark:border-neutral-800/80 p-5 shadow-sm">
        <CardContent className="p-0 flex flex-col items-center text-center space-y-2">
          <div className="w-9 h-9 rounded-full bg-blue-100/50 dark:bg-blue-950/20 flex items-center justify-center">
            <Radar className="h-4.5 w-4.5 text-blue-500 animate-pulse" />
          </div>
          <div>
            <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
              {isDe ? 'Keine Freunde in der Nähe' : 'No Friends Nearby'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {isDe
                ? 'Aktuell befindet sich kein Freund in deinem eingestellten Radius.'
                : 'No friends are within your selected radius right now.'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-[2.25rem] bg-slate-50 dark:bg-neutral-900/50 border border-slate-100 dark:border-neutral-800/80 p-5 shadow-sm">
        <CardContent className="p-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Radar className="h-4 w-4 text-blue-500 animate-pulse" />
              </div>
              <span className="text-xs font-black text-slate-800 dark:text-neutral-200">
                {isDe ? 'Freunde in der Nähe' : 'Friends Nearby'}
              </span>
              <Badge className="bg-blue-600 text-white hover:bg-blue-700 text-[8px] font-black px-1.5 py-0.5 rounded-full">
                {nearbyFriends.length}
              </Badge>
            </div>
            <Button
              variant="ghost"
              onClick={() => setListOpen(true)}
              className="text-[10px] font-black text-blue-600 dark:text-blue-400 p-0 h-auto hover:bg-transparent"
            >
              {isDe ? 'Alle anzeigen' : 'Show all'}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            {nearbyFriends.slice(0, 3).map((friend) => (
              <div
                key={friend.userId}
                onClick={() => {
                  if (onSelectFriendOnMap) {
                    onSelectFriendOnMap(friend);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-900 rounded-2xl cursor-pointer active:scale-98 transition-all hover:bg-slate-50 shrink-0"
              >
                <ProfileAvatar
                  photoURL={friend.avatarUrl}
                  displayName={friend.displayName || friend.username}
                  className="w-8 h-8 text-[10px]"
                />
                <div className="max-w-[80px]">
                  <div className="text-[10px] font-black text-slate-800 dark:text-neutral-200 truncate">
                    {friend.displayName || friend.username}
                  </div>
                  <div className="text-[8px] text-blue-600 font-bold uppercase tracking-tight truncate">
                    {friend.distanceBucket === 'under_1_km' ? '< 1 km' : friend.distanceBucket === '1_to_2_km' ? '1-2 km' : '2-5 km'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <RadarListSheet
        open={listOpen}
        onOpenChange={setListOpen}
        onSelectFriendOnMap={onSelectFriendOnMap}
        language={language}
      />
    </>
  );
}
