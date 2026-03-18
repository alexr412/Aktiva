'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import {
  Plus,
  Navigation,
  Bookmark,
  Users,
  Loader2,
  MapPin,
  ArrowUp,
  ArrowDown,
  Star,
} from 'lucide-react';
import { useFavorites } from '@/contexts/favorites-context';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { votePlace } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { getPrimaryIconData } from '@/lib/tag-config';
import { formatTags } from '@/lib/tag-parser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const formatDistance = (distanceInMeters?: number) => {
    if (distanceInMeters === undefined) return null;
    if (distanceInMeters < 1000) return `${Math.round(distanceInMeters)}m`;
    return `${(distanceInMeters / 1000).toFixed(1)}km`;
};

type PlaceCardProps = {
  place: Place;
  onClick: () => void;
  onAddActivity: (place: Place) => void;
};

export function PlaceCard({ place, onClick, onAddActivity }: PlaceCardProps) {
    if (!place) return null;

    const { user } = useAuth();
    const { addFavorite, removeFavorite, checkIsFavorite } = useFavorites();
    const isFavorite = checkIsFavorite(place.id);
    
    const primaryStyle = getPrimaryIconData(place);
    const PrimaryIcon = primaryStyle.icon;
    
    const [isVoting, setIsVoting] = useState(false);
    const [placeMeta, setPlaceMeta] = useState({ 
        upvotes: 0, 
        downvotes: 0, 
        userVotes: {} as Record<string, 'up' | 'down'>,
        avgRating: 0,
        reviewCount: 0
    });

    useEffect(() => {
        if (!db || !place.id) return;
        const unsub = onSnapshot(doc(db, 'places', place.id), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setPlaceMeta({
                    upvotes: data.upvotes || 0,
                    downvotes: data.downvotes || 0,
                    userVotes: data.userVotes || {},
                    avgRating: data.avgRating || 0,
                    reviewCount: data.reviewCount || 0
                });
            }
        });
        return () => unsub();
    }, [place.id]);

    const userVote = user ? (placeMeta.userVotes?.[user.uid] || 'none') : 'none';

    const handleBookmarkToggle = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (isFavorite) {
            removeFavorite(place.id);
        } else {
            addFavorite(place);
        }
    };

    const handleVoteClick = async (e: React.MouseEvent, type: 'up' | 'down' | 'none') => {
        e.stopPropagation();
        if (!user || isVoting) return;
        setIsVoting(true);
        try {
            await votePlace(place.id, user.uid, type);
        } catch (error) {
            console.error("Voting failed:", error);
        } finally {
            setIsVoting(false);
        }
    };

    const rawTags = (place.categories || []).filter((tag: string) => 
      !tag.startsWith('wheelchair') && 
      !tag.startsWith('fee') && 
      !tag.startsWith('no_fee')
    );
    const processedTags = formatTags(rawTags);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer group overflow-hidden rounded-3xl bg-white dark:bg-neutral-800 border-none shadow-sm hover:shadow-xl transition-all duration-500 flex flex-row relative p-0"
      )}
    >
      {/* Linker Medien-Bereich */}
      <div className={cn(
        "w-28 sm:w-32 flex-shrink-0 flex items-center justify-center relative transition-transform duration-500 group-hover:scale-105",
        primaryStyle.bgClass.replace('bg-', 'bg-gradient-to-br from-').replace('-50', '-400 to-').concat(primaryStyle.color === '#ef4444' ? 'red-500' : 'violet-500')
      )}
      style={{ backgroundColor: primaryStyle.color + '20' }}
      >
        <PrimaryIcon className="text-white/90 h-12 w-12 drop-shadow-md" />
        
        {place.activityCount !== undefined && place.activityCount > 0 && (
            <div className="absolute top-2 left-2 bg-primary text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-lg animate-pulse">
                Aktiv
            </div>
        )}
      </div>

      {/* Rechter Content-Bereich */}
      <div className="p-4 flex flex-col justify-between w-full min-w-0">
        <div>
          <div className="flex justify-between items-start gap-2 mb-1">
            <h3 className="text-lg font-black text-[#0f172a] dark:text-neutral-200 truncate leading-tight flex-1">
              {place.name}
            </h3>
            {place.distance !== undefined && (
              <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider whitespace-nowrap pt-1">
                {formatDistance(place.distance)}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md border border-amber-100 dark:border-amber-800">
              <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
              {placeMeta.reviewCount > 0 ? (
                <span className="text-[9px] font-black text-amber-700 dark:text-amber-400">
                  {placeMeta.avgRating.toFixed(1)} <span className="opacity-50">({placeMeta.reviewCount})</span>
                </span>
              ) : (
                <span className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-500">Neu</span>
              )}
            </div>
            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate font-medium">
              {place.address}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-1.5 mb-4">
            {processedTags.slice(0, 2).map((tag, index) => (
              <Badge 
                key={index} 
                variant="secondary" 
                className={cn(
                  "rounded-full text-[9px] font-black uppercase tracking-tight px-2 py-0.5 border-none",
                  index === 0 ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                )}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Footer-Aktionen */}
        <div className="flex justify-between items-center mt-auto pt-3 border-t border-neutral-50 dark:border-neutral-700/50">
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-700/50 rounded-full p-0.5">
            <button 
              onClick={(e) => handleVoteClick(e, userVote === 'up' ? 'none' : 'up')}
              className={cn(
                "h-7 w-8 rounded-full flex items-center justify-center transition-all",
                userVote === 'up' ? "bg-white text-green-500 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              {isVoting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
            <button 
              onClick={(e) => handleVoteClick(e, userVote === 'down' ? 'none' : 'down')}
              className={cn(
                "h-7 w-8 rounded-full flex items-center justify-center transition-all",
                userVote === 'down' ? "bg-white text-red-500 shadow-sm" : "text-neutral-400 hover:text-neutral-600"
              )}
            >
              {isVoting ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDown className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleBookmarkToggle}
              className="h-9 w-9 rounded-full text-neutral-400 hover:text-primary hover:bg-primary/5"
            >
              <Bookmark className={cn("h-5 w-5", isFavorite && "fill-primary text-primary")} />
            </Button>
            <Button 
              size="icon" 
              onClick={(e) => { e.stopPropagation(); onAddActivity(place); }}
              className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-transform active:scale-90"
            >
              <Plus className="h-5 w-5" strokeWidth={3} />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
