'use client';

import { useState } from 'react';
import { useFriendRadar, NearbyFriend } from '@/hooks/use-friend-radar';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { Badge } from '@/components/ui/badge';
import { Radar, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import Link from 'next/link';
import { RadarListSheet } from '../radar/radar-list-sheet';

interface ProximityRadarViewProps {
  onSelectFriendOnMap?: (friend: NearbyFriend) => void;
}

export function ProximityRadarView({ onSelectFriendOnMap }: ProximityRadarViewProps) {
  const { enabled, nearbyFriends } = useFriendRadar();
  const language = useLanguage();
  const [listOpen, setListOpen] = useState(false);

  if (!enabled || nearbyFriends.length === 0) return null;

  return (
    <div className="px-4 py-3 bg-blue-50/50 dark:bg-neutral-900/50 border-b border-slate-100 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Radar className="h-4.5 w-4.5 text-blue-500 animate-pulse" />
          <span className="text-[10px] font-black text-slate-800 dark:text-neutral-200 uppercase tracking-wider">
            {language === 'de' ? 'Radar' : 'Radar'}
          </span>
          <Badge className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
            {nearbyFriends.length}
          </Badge>
        </div>
        <button
          onClick={() => setListOpen(true)}
          className="text-[9px] font-black text-blue-600 dark:text-blue-400 flex items-center hover:underline focus:outline-none"
        >
          {language === 'de' ? 'Alle anzeigen' : 'Show all'}
          <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
        </button>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar py-1">
        {nearbyFriends.slice(0, 5).map(friend => (
          <div 
            key={friend.userId}
            onClick={() => {
              if (onSelectFriendOnMap) {
                onSelectFriendOnMap(friend);
              }
            }}
            className="flex-shrink-0 flex flex-col items-center gap-1 group cursor-pointer"
          >
            <div className="relative">
              <ProfileAvatar 
                className="h-10 w-10 ring-2 ring-blue-500/10 group-hover:ring-blue-500 transition-all"
                photoURL={friend.avatarUrl}
                displayName={friend.displayName || friend.username}
              />
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-background rounded-full" />
            </div>
            <span className="text-[9px] font-black max-w-[55px] truncate text-slate-700 dark:text-neutral-300">
              {(friend.displayName || friend.username).split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      <RadarListSheet
        open={listOpen}
        onOpenChange={setListOpen}
        onSelectFriendOnMap={onSelectFriendOnMap}
        language={language}
      />
    </div>
  );
}
