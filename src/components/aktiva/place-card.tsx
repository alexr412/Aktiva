'use client';

import { useState, useEffect, useRef } from 'react';
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
import { trackInteraction } from '@/lib/telemetry';
import { isEntityBoosted } from '@/lib/ranking';

const formatDistance = (distanceInKm?: number) => {
    if (distanceInKm === undefined) return null;
    if (distanceInKm < 1) return `${Math.round(distanceInKm * 1000)}m`;
    return `${distanceInKm.toFixed(1)}km`;
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
    const [isPressed, setIsPressed] = useState(false);
    const [placeMeta, setPlaceMeta] = useState({
        upvotes: 0,
        downvotes: 0,
        communityScore: 0,
        userVotes: {} as Record<string, 'up' | 'down'>,
        avgRating: 0,
        reviewCount: 0,
        activityCount: (place as any).activityCount || 0,
        weightedUpvotes: 0,
        weightedDownvotes: 0
    });
    const [hasStartedListener, setHasStartedListener] = useState(false);

    // Lazy Load: Real-time onSnapshot listener, started when card becomes visible.
    // Once the listener starts, vote data stays live (updates immediately after voting).
    const cardRef = useRef<HTMLDivElement>(null);
    const unsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!db || !place.id || hasStartedListener) return;
        const el = cardRef.current;
        if (!el) return;

        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    io.disconnect();
                    setHasStartedListener(true);
                    // Start real-time listener
                    unsubRef.current = onSnapshot(doc(db!, 'places', place.id), (snap) => {
                        if (snap.exists()) {
                            const data = snap.data();
                            setPlaceMeta({
                                upvotes: data.upvotes || 0,
                                downvotes: data.downvotes || 0,
                                communityScore: data.communityScore || 0,
                                userVotes: data.userVotes || {},
                                avgRating: data.avgRating || 0,
                                reviewCount: data.reviewCount || 0,
                                activityCount: data.activityCount || 0,
                                weightedUpvotes: data.weightedUpvotes || 0,
                                weightedDownvotes: data.weightedDownvotes || 0
                            });
                        }
                    });
                }
            },
            { rootMargin: '200px' } // Pre-load when 200px away from viewport
        );
        io.observe(el);
        return () => io.disconnect();
    }, [place.id, hasStartedListener]);

    // Reset state & unsubscribe when place.id changes or on unmount
    useEffect(() => {
        setHasStartedListener(false);
        setPlaceMeta({
            upvotes: 0,
            downvotes: 0,
            communityScore: 0,
            userVotes: {},
            avgRating: 0,
            reviewCount: 0,
            activityCount: (place as any).activityCount || 0,
            weightedUpvotes: 0,
            weightedDownvotes: 0
        });

        return () => {
            if (unsubRef.current) {
                unsubRef.current();
                unsubRef.current = null;
            }
        };
    }, [place.id]);

    const userVote = user ? (placeMeta.userVotes?.[user.uid] || 'none') : 'none';

    const handleVoteClick = async (e: React.MouseEvent, type: 'up' | 'down' | 'none') => {
        e.stopPropagation();
        if (!user || isVoting) return;
        setIsVoting(true);

        // Optimistic UI update — reflect the vote change immediately
        setPlaceMeta(prev => {
            const prevVote = prev.userVotes?.[user.uid] || 'none';
            let upDelta = 0;
            let downDelta = 0;
            const newUserVotes = { ...prev.userVotes };

            // Revert previous vote
            if (prevVote === 'up') upDelta -= 1;
            else if (prevVote === 'down') downDelta -= 1;

            // Apply new vote
            if (type === 'up') { upDelta += 1; newUserVotes[user.uid] = 'up'; }
            else if (type === 'down') { downDelta += 1; newUserVotes[user.uid] = 'down'; }
            else { delete newUserVotes[user.uid]; }

            return {
                ...prev,
                upvotes: Math.max(0, prev.upvotes + upDelta),
                downvotes: Math.max(0, prev.downvotes + downDelta),
                userVotes: newUserVotes
            };
        });

        try {
            await votePlace(place.id, user.uid, type, userProfile?.role, place);
            // onSnapshot will reconcile with server truth automatically
        } catch (error) {
            console.error("Voting failed:", error);
            // onSnapshot will revert to server state on next update
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
        trackInteraction(place.id, place.categories, 'favorite', user?.uid);
    };

    const categories = (place.categories || []);
    const processedTags = getCleanTags(categories).slice(0, 6);

    return (
        <Card
            ref={cardRef}
            onClick={onClick}
            onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('a') || target.closest('input')) {
                    return;
                }
                setIsPressed(true);
            }}
            onPointerUp={() => setIsPressed(false)}
            onPointerCancel={() => setIsPressed(false)}
            onPointerLeave={() => setIsPressed(false)}
            className={cn(
                "cursor-pointer group overflow-hidden rounded-[22px] bg-white dark:bg-neutral-900 border border-slate-200/40 dark:border-neutral-800/60 shadow-premium hover:shadow-premium-active transition-all duration-200 flex flex-col relative p-0 h-full",
                isPressed ? "scale-[0.985] duration-75" : ""
            )}
        >
            {/* Oberer Bild/Icon-Bereich */}
            <div className={cn(
                "w-full h-20 flex items-center justify-center relative transition-transform duration-700 group-hover:scale-105 overflow-hidden",
                primaryStyle.gradientClass
            )}
            >
                {/* Dekorative Icons im Hintergrund */}

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
                                const activityDate = (place as any).activityDate?.toDate?.() || null;
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
                <div className="absolute top-2.5 right-4 flex items-center gap-1.5">
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
                    <h3 className="text-base sm:text-lg font-black tracking-tight line-clamp-2 min-h-[2.5rem] leading-snug flex items-center gap-1.5 flex-wrap">
                        <span>{place.name || (userProfile?.role === 'admin' ? `POI Ref: ${place.id.slice(-6)}` : (language === 'de' ? 'Unbekannter Ort' : 'Unknown Place'))}</span>
                        {isEntityBoosted(place) && (
                            <Sparkles className="h-4 w-4 text-amber-500 fill-amber-500/20 shrink-0 animate-pulse" />
                        )}
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
                            className="rounded-[10px] text-[7px] font-black uppercase tracking-widest px-2 py-0.5 border-none bg-primary/5 text-primary"
                        >
                            {translateTag(item.tag, language)}
                        </Badge>
                    ))}
                    {userProfile?.role === 'admin' && (
                        (place.categories || []).map((tag: string, idx: number) => (
                            <span
                                key={`${tag}-${idx}`}
                                className="px-2 py-0.5 text-[8px] font-mono bg-neutral-50 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-500 rounded-[10px] border border-neutral-100 dark:border-neutral-800 whitespace-nowrap"
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
                                "h-7 rounded-xl flex items-center justify-center transition-all text-[11px] font-black leading-none gap-1 shrink-0",
                                (userProfile?.role === 'admin' || userProfile?.role === 'supporter') ? "px-2" : "w-7",
                                userVote === 'up' ? "bg-white text-emerald-500 shadow-sm" : "text-emerald-500/40 hover:text-emerald-500"
                            )}
                        >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            {(userProfile?.role === 'admin' || userProfile?.role === 'supporter') && (
                                <span className="opacity-70 text-[10px]">
                                    {(placeMeta.weightedUpvotes || 0) > 0 ? `+${placeMeta.weightedUpvotes}` : '0'}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={(e) => handleVoteClick(e, userVote === 'down' ? 'none' : 'down')}
                            className={cn(
                                "h-7 rounded-xl flex items-center justify-center transition-all text-[11px] font-black leading-none gap-1 shrink-0",
                                (userProfile?.role === 'admin' || userProfile?.role === 'supporter') ? "px-2" : "w-7",
                                userVote === 'down' ? "bg-white text-red-500 shadow-sm" : "text-red-500/40 hover:text-red-500"
                            )}
                        >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            {(userProfile?.role === 'admin' || userProfile?.role === 'supporter') && (
                                <span className="opacity-70 text-[10px]">
                                    {(placeMeta.weightedDownvotes || 0) > 0 ? `-${placeMeta.weightedDownvotes}` : '0'}
                                </span>
                            )}
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
