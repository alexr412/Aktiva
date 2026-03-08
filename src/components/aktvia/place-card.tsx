'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import {
  Plus,
  MessageSquare,
  Navigation,
  Bookmark,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useFavorites } from '@/contexts/favorites-context';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { votePlace } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { getPrimaryIconData } from '@/lib/tag-config';

const formatDistance = (distanceInMeters?: number) => {
    if (distanceInMeters === undefined) return null;
    if (distanceInMeters < 1000) return `${Math.round(distanceInMeters)} m`;
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
};

type PlaceCardProps = {
  place: Place;
  onClick: () => void;
  onAddActivity: (place: Place) => void;
};

export function PlaceCard({ place, onClick, onAddActivity }: PlaceCardProps) {
    if (!place) return null;

    const { user, userProfile } = useAuth();
    const { addFavorite, removeFavorite, checkIsFavorite } = useFavorites();
    const isFavorite = checkIsFavorite(place.id);
    
    const primaryStyle = getPrimaryIconData(place);
    const PrimaryIcon = primaryStyle.icon;
    
    const [isVoting, setIsVoting] = useState(false);
    const [localVotes, setLocalVotes] = useState({ upvotes: 0, downvotes: 0, userVotes: {} as Record<string, 'up' | 'down'> });

    useEffect(() => {
        if (!db || !place.id) return;
        const unsub = onSnapshot(doc(db, 'places', place.id), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setLocalVotes({
                    upvotes: data.upvotes || 0,
                    downvotes: data.downvotes || 0,
                    userVotes: data.userVotes || {}
                });
            }
        });
        return () => unsub();
    }, [place.id]);

    const userVote = user ? (localVotes.userVotes?.[user.uid] || 'none') : 'none';

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

    // Korrektur-Direktive: Exklusion von Condition-Tags (wheelchair, fee, no_fee)
    const displayTags = (place.categories || []).filter((tag: string) => 
      !tag.startsWith('wheelchair') && 
      !tag.startsWith('fee') && 
      !tag.startsWith('no_fee')
    );

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer group overflow-hidden rounded-2xl bg-[#ffffff] dark:bg-neutral-800 dark:border-neutral-700 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1)] transition-all duration-300 border-none flex flex-col relative p-4",
        place.isPromoted && "ring-2 ring-primary/20"
      )}
    >
      {place.isPromoted && (
        <div className="absolute top-3 right-3 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
          <Sparkles className="h-3 w-3" />
          <span>PROMOTED</span>
        </div>
      )}

      <div className="flex items-start gap-4">
        <div 
          className={cn("relative flex flex-shrink-0 items-center justify-center w-20 h-20 rounded-2xl", primaryStyle.bgClass, "dark:bg-neutral-700/50")}
        >
            <PrimaryIcon 
              className="h-10 w-10" 
              style={{ color: primaryStyle.color }}
            />
        </div>

        <div className="flex-1 min-w-0">
            <h3 className="text-lg font-extrabold text-[#0f172a] dark:text-neutral-200 truncate leading-tight">{place.name}</h3>
            <p className="text-xs text-[#64748b] dark:text-neutral-400 truncate mt-1">{place.address}</p>
            {place.distance !== undefined && (
                <div className="flex items-center gap-1.5 text-[10px] text-[#64748b] dark:text-neutral-400 mt-2 font-bold uppercase tracking-wider">
                    <Navigation className="h-3 w-3"/>
                    <span>{formatDistance(place.distance)} entfernt</span>
                </div>
            )}
        </div>
      </div>

      <div className="mt-4 flex-1 flex flex-col justify-end">
        {place.activityCount !== undefined && place.activityCount > 0 && (
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary self-start">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{place.activityCount} Aktivität{place.activityCount > 1 ? 'en' : ''}</span>
          </div>
        )}
        
        <div className="flex w-full flex-wrap items-center gap-1.5 overflow-hidden mb-4">
          {displayTags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold tracking-tight bg-[#f1f5f9] dark:bg-neutral-700 dark:border dark:border-neutral-600 text-[#475569] dark:text-neutral-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="card-footer-actions flex justify-between items-center w-full pt-3 border-t border-slate-50 dark:border-neutral-700/50">
          <div className="voting-controls flex gap-2 items-center">
            <button 
              onClick={(e) => handleVoteClick(e, userVote === 'up' ? 'none' : 'up')} 
              aria-label="Upvote"
              className="dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
              style={{ 
                padding: '6px 14px', 
                border: '1px solid', 
                borderRadius: '10px', 
                fontWeight: '800',
                fontSize: '14px',
                transition: 'all 0.2s',
                cursor: 'pointer',
                background: userVote === 'up' ? '#22c55e' : 'inherit',
                color: userVote === 'up' ? '#ffffff' : 'inherit',
                borderColor: userVote === 'up' ? '#22c55e' : '#e2e8f0',
              }}
            >
              {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↑'}
            </button>
            <button 
              onClick={(e) => handleVoteClick(e, userVote === 'down' ? 'none' : 'down')} 
              aria-label="Downvote"
              className="dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
              style={{ 
                padding: '6px 14px', 
                border: '1px solid', 
                borderRadius: '10px', 
                fontWeight: '800',
                fontSize: '14px',
                transition: 'all 0.2s',
                cursor: 'pointer',
                background: userVote === 'down' ? '#ef4444' : 'inherit',
                color: userVote === 'down' ? '#ffffff' : 'inherit',
                borderColor: userVote === 'down' ? '#ef4444' : '#e2e8f0',
              }}
            >
              {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↓'}
            </button>

            {userProfile?.isAdmin && (
              <span className="text-[10px] font-bold text-[#64748b] dark:text-neutral-400 ml-1">
                ↑{localVotes.upvotes} ↓{localVotes.downvotes}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <button 
                className="bookmark-button dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:border-neutral-600 dark:text-neutral-300"
                onClick={handleBookmarkToggle}
                style={{ padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'inherit', cursor: 'pointer' }}
            >
                <Bookmark className={cn("h-4 w-4", isFavorite && "fill-current text-primary")} />
            </button>
            <button 
                className="add-button"
                onClick={(e) => { e.stopPropagation(); onAddActivity(place); }}
                style={{ padding: '10px', borderRadius: '12px', border: 'none', background: 'hsl(var(--primary))', color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 12px -2px rgba(var(--primary), 0.4)' }}
            >
                <Plus className="h-4 w-4" strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
