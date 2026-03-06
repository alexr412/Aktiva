'use client';

import { useProximityRadar } from '@/hooks/use-proximity-radar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Radar } from 'lucide-react';
import Link from 'next/link';

export function ProximityRadarView() {
  const nearbyFriends = useProximityRadar();

  if (nearbyFriends.length === 0) return null;

  return (
    <div className="px-4 py-3 bg-primary/5 border-b border-primary/10">
      <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar">
        <div className="flex-shrink-0 flex items-center gap-2 pr-2 border-r border-primary/20 mr-1">
          <Radar className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Radar</span>
        </div>
        
        {nearbyFriends.map(friend => (
          <Link 
            key={friend.uid} 
            href={`/profile/${friend.uid}`}
            className="flex-shrink-0 flex flex-col items-center gap-1 group"
          >
            <div className="relative">
              <Avatar className="h-10 w-10 ring-2 ring-primary/20 group-hover:ring-primary transition-all">
                <AvatarImage src={friend.photoURL || undefined} />
                <AvatarFallback>{friend.displayName?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-green-500 border-2 border-background rounded-full" />
            </div>
            <span className="text-[10px] font-medium max-w-[50px] truncate">{friend.displayName?.split(' ')[0]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
