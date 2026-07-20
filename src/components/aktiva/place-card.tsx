'use client';

import { useState } from 'react';
import type { Place } from '@/lib/types';
import {
    Plus,
    Bookmark,
    ThumbsUp,
    ThumbsDown,
    Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isTomorrow } from 'date-fns';
import { getPrimaryIconData, translateTag, getCleanTags } from '@/lib/tag-config';
import { formatOpeningHours } from '@/lib/tag-parser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isEntityBoosted } from '@/lib/ranking';
import { CategoryCardDecoration } from './category-card-decoration';
import { useLanguage } from '@/hooks/use-language';

const formatDistance = (distanceInKm?: number) => {
    if (distanceInKm === undefined) return null;
    if (distanceInKm < 1) return `${Math.round(distanceInKm * 1000)}m`;
    return `${distanceInKm.toFixed(1)}km`;
};

type PlaceCardProps = {
    place: Place;
    onClick: () => void;
    onAddActivity: (place: Place) => void;
    upvotes: number;
    downvotes: number;
    userVote: 'up' | 'down' | 'none';
    activityCount: number;
    isFavorite: boolean;
    onVote: (type: 'up' | 'down' | 'none') => void;
    onBookmarkToggle: () => void;
    role?: string | null;
    weightedUpvotes?: number;
    weightedDownvotes?: number;
};

export function PlaceCard({
    place,
    onClick,
    onAddActivity,
    upvotes,
    downvotes,
    userVote,
    activityCount,
    isFavorite,
    onVote,
    onBookmarkToggle,
    role,
    weightedUpvotes = 0,
    weightedDownvotes = 0
}: PlaceCardProps) {
    if (!place) return null;

    const language = useLanguage();
    const [isPressed, setIsPressed] = useState(false);

    const primaryStyle = getPrimaryIconData(place, language);
    const PrimaryIcon = primaryStyle.icon;

    const categories = (place.categories || []);
    const processedTags = getCleanTags(categories).slice(0, 6);

    const handleVoteClick = (e: React.MouseEvent, type: 'up' | 'down' | 'none') => {
        e.stopPropagation();
        onVote(type);
    };

    const handleBookmarkToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onBookmarkToggle();
    };

    return (
        <article
            onClick={(e) => {
                const selection = window.getSelection();
                if (selection && selection.toString()) {
                    return;
                }
                const target = e.target as HTMLElement;
                if (target.closest('button, a, input, select, textarea, [role="button"], [data-card-interactive]')) {
                    return;
                }
                onClick();
            }}
            onPointerDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button, a, input, select, textarea, [role="button"], [data-card-interactive]')) {
                    return;
                }
                setIsPressed(true);
            }}
            onPointerUp={() => setIsPressed(false)}
            onPointerCancel={() => setIsPressed(false)}
            onPointerLeave={() => setIsPressed(false)}
            className={cn(
                "cursor-pointer group overflow-hidden rounded-[22px] bg-white dark:bg-neutral-900 border border-slate-200/40 dark:border-neutral-800/60 shadow-premium hover:shadow-premium-active transition-[transform,box-shadow,border-color] duration-200 flex flex-col relative p-0 h-full",
                isPressed ? "scale-[0.985] duration-75" : ""
            )}
        >
            {/* Oberer Bild/Icon-Bereich mit Dekoration */}
            <CategoryCardDecoration
                gradientClass={primaryStyle.gradientClass}
                icon={PrimaryIcon}
                label={primaryStyle.label}
                variant="standard"
                className="group-hover:scale-105"
            >
                {/* Status Badges */}
                <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-20 pointer-events-none select-none">
                    {(activityCount > 0 || (place.activityCount !== undefined && place.activityCount > 0)) && (
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

                {/* Relevance Score Badge */}
                {role === 'admin' && place.relevanceScore !== undefined && (
                    <div className="absolute top-2.5 right-4 z-20 pointer-events-none select-none h-5 bg-amber-400 text-white text-[8px] font-black px-2 rounded-2xl shadow-lg flex items-center gap-1 border border-white/20">
                        <Sparkles className="h-2.5 w-2.5" />
                        {place.relevanceScore.toFixed(1)}
                    </div>
                )}

                {/* Distance Badge - Bottom Left */}
                {place.distance !== undefined && (
                    <div className="absolute bottom-2.5 left-2.5 z-20 pointer-events-none select-none h-5 bg-black/40 backdrop-blur-md text-white text-[8px] font-black px-2 rounded-full whitespace-nowrap flex items-center justify-center border border-white/10">
                        {formatDistance(place.distance)}
                    </div>
                )}
            </CategoryCardDecoration>

            {/* Content Bereich */}
            <div className="p-3 pb-4 flex flex-col flex-1">
                <div className="mb-2">
                    <h3 className="text-base sm:text-lg font-black tracking-tight line-clamp-2 min-h-[2.5rem] leading-snug flex items-center gap-1.5 flex-wrap">
                        <button
                            onClick={(e) => { e.stopPropagation(); onClick(); }}
                            className="font-black text-base text-left text-[#0f172a] dark:text-neutral-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                        >
                            {place.name || (role === 'admin' ? `POI POI Ref: ${place.id.slice(-6)}` : (language === 'de' ? 'Unbekannter Ort' : 'Unknown Place'))}
                        </button>
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
                    {role === 'admin' && (
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
                                "h-7 rounded-xl flex items-center justify-center transition-colors duration-200 text-[11px] font-black leading-none gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                (role === 'admin' || role === 'supporter') ? "px-2" : "w-7",
                                userVote === 'up' ? "bg-white text-emerald-500 shadow-sm" : "text-emerald-500/40 hover:text-emerald-500"
                            )}
                        >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            {(role === 'admin' || role === 'supporter') && (
                                <span className="opacity-70 text-[10px]">
                                    {weightedUpvotes > 0 ? `+${weightedUpvotes}` : '0'}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={(e) => handleVoteClick(e, userVote === 'down' ? 'none' : 'down')}
                            className={cn(
                                "h-7 rounded-xl flex items-center justify-center transition-colors duration-200 text-[11px] font-black leading-none gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                                (role === 'admin' || role === 'supporter') ? "px-2" : "w-7",
                                userVote === 'down' ? "bg-white text-red-500 shadow-sm" : "text-red-500/40 hover:text-red-500"
                            )}
                        >
                            <ThumbsDown className="h-3.5 w-3.5" />
                            {(role === 'admin' || role === 'supporter') && (
                                <span className="opacity-70 text-[10px]">
                                    {weightedDownvotes > 0 ? `-${weightedDownvotes}` : '0'}
                                </span>
                            )}
                        </button>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleBookmarkToggle}
                        className={cn(
                            "h-8 w-8 rounded-xl transition-colors duration-200 ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                            isFavorite ? "text-primary bg-primary/10" : "text-neutral-300 hover:text-primary hover:bg-primary/5"
                        )}
                    >
                        <Bookmark className={cn("h-4 w-4 transition-colors duration-200", isFavorite && "fill-primary")} />
                    </Button>

                    <Button
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); onAddActivity(place); }}
                        className="h-8 w-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition-[color,background-color,transform,box-shadow] duration-200 active:scale-95 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        <Plus className="h-4 w-4" strokeWidth={3} />
                    </Button>
                </div>
            </div>
        </article>
    );
}
