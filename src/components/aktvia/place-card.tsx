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
  Clock,
  Sparkles,
} from 'lucide-react';
import { useFavorites } from '@/contexts/favorites-context';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { votePlace } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { getPrimaryIconData } from '@/lib/tag-config';
import { formatTags, formatOpeningHours } from '@/lib/tag-parser';
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

    const { user, userProfile } = useAuth();
    const language = useLanguage();
    const { addFavorite, removeFavorite, checkIsFavorite } = useFavorites();
    const isFavorite = checkIsFavorite(place.id);
    
    const primaryStyle = getPrimaryIconData(place, language);
    const PrimaryIcon = primaryStyle.icon;
    
    const [isVoting, setIsVoting] = useState(false);
    const [placeMeta, setPlaceMeta] = useState({ 
        upvotes: 0, 
        downvotes: 0, 
        communityScore: 0,
        userVotes: {} as Record<string, 'up' | 'down'>,
        avgRating: 0,
        reviewCount: 0,
        activityCount: 0
    });

    useEffect(() => {
        if (!db || !place.id) return;
        const unsub = onSnapshot(doc(db, 'places', place.id), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPlaceMeta({
                    upvotes: data.upvotes || 0,
                    downvotes: data.downvotes || 0,
                    communityScore: data.communityScore || 0,
                    userVotes: data.userVotes || {},
                    avgRating: data.avgRating || 0,
                    reviewCount: data.reviewCount || 0,
                    activityCount: data.activityCount || 0
                });
            }
        });
        return () => unsub();
    }, [place.id]);

    const userVote = user ? (placeMeta.userVotes?.[user.uid] || 'none') : 'none';

    const handleVoteClick = async (e: React.MouseEvent, type: 'up' | 'down' | 'none') => {
        e.stopPropagation();
        if (!user || isVoting) return;
        setIsVoting(true);
        try {
            await votePlace(place.id, user.uid, type, userProfile?.role);
        } catch (error) {
            console.error("Voting failed:", error);
        } finally {
            setIsVoting(false);
        }
    };

    const handleBookmarkToggle = (e: React.MouseEvent) => {
        e.stopPropagation(); 
        if (isFavorite) {
            removeFavorite(place.id);
        } else {
            addFavorite(place);
        }
    };

    const categories = (place.categories || []);
    const processedTags = formatTags(categories, language);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer group overflow-hidden rounded-[2.5rem] bg-white dark:bg-neutral-800 border-none shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 flex flex-col relative p-0 h-full dark:shadow-none"
      )}
    >
      {/* Oberer Bild/Icon-Bereich */}
      <div className={cn(
        "w-full h-36 flex items-center justify-center relative transition-transform duration-700 group-hover:scale-105 overflow-hidden",
        primaryStyle.bgClass.replace('bg-', 'bg-gradient-to-br from-').replace('-50', '-400 to-').concat(primaryStyle.color === '#ef4444' ? 'red-500' : 'blue-500')
      )}
      style={{ backgroundColor: primaryStyle.color + '20' }}
      >
        {/* Dekorative Icons im Hintergrund */}
        <PrimaryIcon className="absolute -bottom-4 -right-4 h-24 w-24 text-white/10 rotate-12" />
        
        {/* Haupt-Icon */}
        <PrimaryIcon className="text-white h-16 w-16 drop-shadow-2xl relative z-10" />
        
        {/* Status Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
            {(placeMeta.activityCount > 0 || (place.activityCount !== undefined && place.activityCount > 0)) && (
                <div className="bg-emerald-500/90 backdrop-blur-md text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-full shadow-lg animate-pulse tracking-widest">
                    {language === 'de' ? 'Aktiv' : 'Active'}
                </div>
            )}
        </div>

        {/* Status & Debug Badges */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
            {userProfile?.role === 'admin' && place.relevanceScore !== undefined && (
                <div className="bg-amber-500/90 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {place.relevanceScore.toFixed(1)}
                </div>
            )}
            {place.distance !== undefined && (
                <div className="bg-black/20 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                    {formatDistance(place.distance)}
                </div>
            )}
        </div>
      </div>

      {/* Content Bereich */}
      <div className="p-5 pb-7 flex flex-col flex-1">
        <div className="mb-4">
          <h3 className="text-lg font-black text-[#0f172a] dark:text-neutral-100 line-clamp-1 leading-tight mb-1 font-heading">
            {place.name}
          </h3>
          <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500 font-bold text-[11px]">
             {place.openingHours ? (
                 <span className="truncate">{formatOpeningHours(place.openingHours)}</span>
             ) : (
                 <span className="truncate">{(place.address || (language === 'de' ? 'Keine Adresse' : 'No address')).split(',').slice(0, 2).join(', ')}</span>
             )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1.5 mb-6">
            {processedTags.map((tag, index) => (
                <Badge 
                    key={index} 
                    variant="secondary" 
                    className="rounded-full text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-primary/5 text-primary border-none"
                >
                    {tag}
                </Badge>
            ))}
            {userProfile?.role === 'admin' && (
                (place.categories || []).map((tag: string, idx: number) => (
                    <span 
                      key={`${tag}-${idx}`} 
                      className="px-2 py-0.5 text-[8px] font-mono bg-neutral-50 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-500 rounded border border-neutral-100 dark:border-neutral-800 whitespace-nowrap"
                    >
                      {tag}
                    </span>
                ))
            )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-auto pr-12 relative">
            <div className="flex items-center bg-neutral-50 dark:bg-neutral-900 rounded-2xl p-1 gap-1">
                <button 
                onClick={(e) => handleVoteClick(e, userVote === 'up' ? 'none' : 'up')}
                className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center transition-all",
                    userVote === 'up' ? "bg-white text-emerald-500 shadow-sm" : "text-emerald-500/30 hover:text-emerald-500"
                )}
                >
                <ArrowUp className="h-4 w-4" />
                </button>
                
                {userProfile?.role === 'admin' && (
                    <span className="text-xs font-black min-w-[20px] text-center text-neutral-600 dark:text-neutral-300">
                      {Math.round(placeMeta.communityScore || 0)}
                    </span>
                )}
                
                <button 
                onClick={(e) => handleVoteClick(e, userVote === 'down' ? 'none' : 'down')}
                className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center transition-all",
                    userVote === 'down' ? "bg-white text-red-500 shadow-sm" : "text-red-500/30 hover:text-red-500"
                )}
                >
                <ArrowDown className="h-4 w-4" />
                </button>
            </div>

            <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleBookmarkToggle}
                className={cn(
                    "h-11 w-11 rounded-2xl transition-all",
                    isFavorite ? "text-primary bg-primary/10" : "text-neutral-300 hover:text-primary hover:bg-primary/5"
                )}
            >
                <Bookmark className={cn("h-6 w-6", isFavorite && "fill-primary")} />
            </Button>

            {/* Floating Plus Button */}
            <Button 
                size="icon" 
                onClick={(e) => { e.stopPropagation(); onAddActivity(place); }}
                className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 transition-all active:scale-95 z-30 flex items-center justify-center"
            >
                <Plus className="h-5 w-5" strokeWidth={3} />
            </Button>
        </div>
      </div>
    </Card>
  );
}
