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
    ThumbsUp,
    ThumbsDown,
    Star,
    Clock,
    Sparkles,
} from 'lucide-react';
import { useFavorites } from '@/contexts/favorites-context';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow } from 'date-fns';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { votePlace } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { getPrimaryIconData, translateTag, getCleanTags } from '@/lib/tag-config';
import { formatTags, formatOpeningHours } from '@/lib/tag-parser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const formatDistance = (distanceInMeters?: number) => {
    if (distanceInMeters === undefined) return null;
    if (distanceInMeters < 1000) return `${Math.round(distanceInMeters)}m`;
    return `${((distanceInMeters || 0) / 1000).toFixed(1)}km`;
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
            await votePlace(place.id, user.uid, type, userProfile?.role, place);
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
    const processedTags = getCleanTags(categories).slice(0, 6);

    return (
        <Card
            onClick={onClick}
            className={cn(
                "cursor-pointer group overflow-hidden rounded-[2.5rem] bg-white dark:bg-neutral-800 border-none shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 flex flex-col relative p-0 h-full dark:shadow-none"
            )}
        >
            {/* Oberer Bild/Icon-Bereich */}
            <div className={cn(
                "w-full h-20 flex items-center justify-center relative transition-transform duration-700 group-hover:scale-105 overflow-hidden",
                primaryStyle.gradientClass
            )}
            >
                {/* Dekorative Icons im Hintergrund */}
                <PrimaryIcon className="absolute -bottom-4 -right-4 h-24 w-24 text-white opacity-10 rotate-12" />

                {/* Haupt-Icon & Label */}
                <div className="flex flex-col items-center gap-1 z-10">
                    <PrimaryIcon className="text-white h-7 w-7 drop-shadow-2xl" />
                    <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/90 drop-shadow-md">{primaryStyle.label}</span>
                </div>

                {/* Status Badges */}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-20">
                    {(placeMeta.activityCount > 0 || (place.activityCount !== undefined && place.activityCount > 0)) && (
                        <div className="h-5 bg-emerald-500/90 backdrop-blur-md text-white text-[8px] font-black uppercase px-2 rounded-full shadow-lg animate-pulse tracking-widest flex items-center gap-1 border border-white/20">
                            <div className="h-1 w-1 rounded-full bg-white animate-ping" />
                            {(() => {
                                const activityDate = place.activityDate?.toDate?.() || null;
                                if (!activityDate) return language === 'de' ? 'Aktiv' : 'Active';
                                const timeStr = format(activityDate, 'HH:mm');
                                if (isToday(activityDate)) return `${language === 'de' ? 'Heute' : 'Today'} ${timeStr}`;
                                if (isTomorrow(activityDate)) return `${language === 'de' ? 'Morgen' : 'Tomorrow'} ${timeStr}`;
                                return format(activityDate, 'dd.MM. HH:mm');
                            })()}
                        </div>
                    )}
                </div>

                {/* Status & Distanz Badges */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {userProfile?.role === 'admin' && place.relevanceScore !== undefined && (
                        <div className="h-5 bg-amber-400 text-white text-[8px] font-black px-2 rounded-2xl shadow-lg flex items-center gap-1 border border-white/20">
                            <Sparkles className="h-2.5 w-2.5" />
                            {place.relevanceScore.toFixed(1)}
                        </div>
                    )}
                    {place.distance !== undefined && (
                        <div className="h-5 bg-black/40 backdrop-blur-md text-white text-[8px] font-black px-2 rounded-full whitespace-nowrap flex items-center justify-center border border-white/10">
                            {formatDistance(place.distance)}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Bereich */}
            <div className="p-3 pb-4 flex flex-col flex-1">
                <div className="mb-2">
                    <h3 className="text-sm font-black text-[#0f172a] dark:text-neutral-100 line-clamp-2 leading-tight mb-0.5 font-heading">
                        {place.name || (userProfile?.role === 'admin' ? `POI Ref: ${place.id.slice(-6)}` : (language === 'de' ? 'Unbekannter Ort' : 'Unknown Place'))}
                    </h3>
                    <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500 font-bold text-[9px]">
                        {place.openingHours ? (
                            <span className="truncate">{formatOpeningHours(place.openingHours)}</span>
                        ) : (
                            <span className="truncate">{(place.address || (language === 'de' ? 'Adresse steht noch aus...' : 'Address pending sync...')).split(',').slice(0, 2).join(', ')}</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-1">
                    {processedTags.filter(item => item.isMain).map((item, index) => (
                        <Badge
                            key={index}
                            variant="secondary"
                            className="rounded-full text-[7px] font-black uppercase tracking-widest px-2 py-0.5 border-none bg-primary/5 text-primary"
                        >
                            {translateTag(item.tag, language)}
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

                {/* Footer Actions - Einheitliche Zeile */}
                <div className="flex items-center gap-2 mt-auto">
                    <div className="flex items-center bg-neutral-50 dark:bg-neutral-900 rounded-2xl p-0.5 gap-0.5 border border-neutral-100 dark:border-neutral-800">
                        <button
                            onClick={(e) => handleVoteClick(e, userVote === 'up' ? 'none' : 'up')}
                            className={cn(
                                "h-7 w-7 rounded-xl flex items-center justify-center transition-all",
                                userVote === 'up' ? "bg-white text-emerald-500 shadow-sm" : "text-emerald-500/40 hover:text-emerald-500"
                            )}
                        >
                            <ThumbsUp className="h-3.5 w-3.5" />
                        </button>

                        <button
                            onClick={(e) => handleVoteClick(e, userVote === 'down' ? 'none' : 'down')}
                            className={cn(
                                "h-7 w-7 rounded-xl flex items-center justify-center transition-all",
                                userVote === 'down' ? "bg-white text-red-500 shadow-sm" : "text-red-500/40 hover:text-red-500"
                            )}
                        >
                            <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBookmarkToggle}
                        className={cn(
                            "h-8 w-8 rounded-xl transition-all ml-auto",
                            isFavorite ? "text-primary bg-primary/10" : "text-neutral-300 hover:text-primary hover:bg-primary/5"
                        )}
                    >
                        <Bookmark className={cn("h-4 w-4", isFavorite && "fill-primary")} />
                    </Button>

                    <Button
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onAddActivity(place); }}
                        className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition-all active:scale-95 flex items-center justify-center"
                    >
                        <Plus className="h-4 w-4" strokeWidth={3} />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
