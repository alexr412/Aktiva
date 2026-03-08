
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import {
  UtensilsCrossed,
  Coffee,
  TreePine,
  ShoppingBag,
  Bed,
  Landmark,
  Film,
  Building,
  Plus,
  MessageSquare,
  type LucideIcon,
  Navigation,
  Bookmark,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/contexts/favorites-context';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { votePlace } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';


const categoryIconMap: { [key: string]: LucideIcon } = {
  'catering.restaurant': UtensilsCrossed,
  'catering.cafe': Coffee,
  'leisure.park': TreePine,
  'tourism.attraction': Landmark,
  'commercial': ShoppingBag,
  'entertainment.cinema': Film,
  'accommodation.hotel': Bed,
};

const getCategoryIcon = (categories: string[]): LucideIcon => {
  for (const category of categories) {
    if (categoryIconMap[category]) {
      return categoryIconMap[category];
    }
    const parentCategory = category.split('.')[0];
    if (categoryIconMap[parentCategory]) {
      return categoryIconMap[parentCategory];
    }
  }
  return Building; // Default icon
};

const formatDistance = (distanceInMeters?: number) => {
    if (distanceInMeters === undefined) {
        return null;
    }
    if (distanceInMeters < 1000) {
        return `${Math.round(distanceInMeters)} m`;
    }
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
};


type PlaceCardProps = {
  place: Place;
  onClick: () => void;
  onAddActivity: (place: Place) => void;
};

export function PlaceCard({ place, onClick, onAddActivity }: PlaceCardProps) {
    const { user, userProfile } = useAuth();
    const { addFavorite, removeFavorite, checkIsFavorite } = useFavorites();
    const isFavorite = checkIsFavorite(place.id);
    const Icon = getCategoryIcon(place.categories);
    
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

    const cleanTags = place.categories
      ? place.categories
          .filter((value, index, self) => self.indexOf(value) === index)
      : [];
    
    const userVote = user ? localVotes.userVotes?.[user.uid] : undefined;

    const handleBookmarkToggle = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (isFavorite) {
            removeFavorite(place.id);
        } else {
            addFavorite(place);
        }
    };

    const handleVoteClick = async (e: React.MouseEvent, type: 'up' | 'down') => {
        e.stopPropagation();
        if (!user || isVoting) return;
        if (userVote === (type === 'up' ? 'down' : 'up')) return;

        setIsVoting(true);
        try {
            await votePlace(place.id, user.uid, type);
        } catch (error) {
            console.error("Voting failed:", error);
        } finally {
            setIsVoting(false);
        }
    };


  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer group overflow-hidden rounded-2xl bg-card shadow-md hover:shadow-lg transition-all duration-300 border-none flex flex-col relative",
        place.isPromoted && "ring-2 ring-primary/20 bg-primary/[0.02]"
      )}
    >
      {place.isPromoted && (
        <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
          <Sparkles className="h-2.5 w-2.5" />
          <span>PROMOTED</span>
        </div>
      )}

      <div className="flex items-stretch">
        <div className={cn(
          "relative flex flex-shrink-0 items-center justify-center w-28",
          place.isPromoted ? "bg-primary/10" : "bg-muted/30"
        )}>
            <Icon className={cn(
              "h-10 w-10",
              place.isPromoted ? "text-primary/70" : "text-muted-foreground/70"
            )} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center p-3">
            <h3 className="text-base font-semibold truncate w-full">{place.name}</h3>
            <p className="text-sm text-muted-foreground truncate w-full mt-1">{place.address}</p>
            {place.distance !== undefined && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-medium">
                    <Navigation className="h-3 w-3"/>
                    <span>{formatDistance(place.distance)}</span>
                </div>
            )}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end p-3 pt-0">
        {/* Activity Indicator */}
        {place.activityCount && place.activityCount > 0 ? (
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground self-start">
            <MessageSquare className="h-4 w-4" />
            <span>
              {place.activityCount} Aktivität{place.activityCount > 1 ? 'en' : ''}
            </span>
          </div>
        ) : (
          <div className="h-[34px] mb-2" />
        )}
        
        {/* Tags */}
        <div className="flex w-full flex-wrap items-center gap-2 overflow-hidden mb-3">
          {cleanTags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-[10px] font-medium text-secondary-foreground whitespace-nowrap"
            >
              {tag.split('.')[0]}
            </span>
          ))}
        </div>

        <div className="card-footer-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '4px' }}>
          
          <div className="voting-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); userVote !== 'up' && handleVoteClick(e, 'up'); }} 
              disabled={isVoting || !user || userVote === 'down'}
              aria-label="Upvote"
              style={{ 
                padding: '6px 12px', 
                border: '1px solid', 
                borderRadius: '8px', 
                fontWeight: 'bold',
                transition: 'all 0.2s',
                cursor: userVote === 'down' ? 'not-allowed' : 'pointer',
                background: userVote === 'up' ? '#22c55e' : (userVote === 'down' ? '#f1f5f9' : '#ffffff'),
                color: userVote === 'up' ? '#ffffff' : (userVote === 'down' ? '#94a3b8' : '#000000'),
                borderColor: userVote === 'up' ? '#22c55e' : '#e2e8f0',
                opacity: userVote === 'down' ? 0.6 : 1
              }}
            >
              {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↑'}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); userVote !== 'down' && handleVoteClick(e, 'down'); }} 
              disabled={isVoting || !user || userVote === 'up'}
              aria-label="Downvote"
              style={{ 
                padding: '6px 12px', 
                border: '1px solid', 
                borderRadius: '8px', 
                fontWeight: 'bold',
                transition: 'all 0.2s',
                cursor: userVote === 'up' ? 'not-allowed' : 'pointer',
                background: userVote === 'down' ? '#ef4444' : (userVote === 'up' ? '#f1f5f9' : '#ffffff'),
                color: userVote === 'down' ? '#ffffff' : (userVote === 'up' ? '#94a3b8' : '#000000'),
                borderColor: userVote === 'down' ? '#ef4444' : '#e2e8f0',
                opacity: userVote === 'up' ? 0.6 : 1
              }}
            >
              {isVoting ? <Loader2 className="animate-spin h-4 w-4" /> : '↓'}
            </button>

            {userProfile?.isAdmin && (
              <span className="admin-metrics" style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px', display: 'block', visibility: 'visible' }}>
                ↑{localVotes.upvotes} ↓{localVotes.downvotes}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
                className="bookmark-button"
                onClick={handleBookmarkToggle}
                style={{ padding: '8px', borderRadius: '50%', border: '1px solid #e2e8f0', background: '#ffffff', cursor: 'pointer' }}
            >
                <Bookmark className={cn("h-4 w-4", isFavorite && "fill-current text-primary")} />
            </button>
            <button 
                className="add-button"
                onClick={(e) => { e.stopPropagation(); onAddActivity(place); }}
                style={{ padding: '8px', borderRadius: '50%', border: 'none', background: 'hsl(var(--primary))', color: '#ffffff', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            >
                <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
