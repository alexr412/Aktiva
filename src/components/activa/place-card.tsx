'use client';

import { useState } from 'react';
import type { Activity, Place } from '@/lib/types';
import { Plus, Bookmark, ThumbsUp, ThumbsDown, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPrimaryIconData, translateTag, getCleanTags, translateAppString } from '@/lib/tag-config';
import { formatOpeningHours } from '@/lib/tag-parser';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isEntityBoosted } from '@/lib/ranking';
import { CategoryCardDecoration } from './category-card-decoration';
import { PlaceActivityPreview } from './place-activity-preview';
import { useLanguage } from '@/hooks/use-language';
import { formatDistance } from '@/lib/geo-utils';

export type PlaceCardProps = {
  place: Place;
  onClick: () => void;
  onAddActivity: (place: Place) => void;
  upvotes: number;
  downvotes: number;
  userVote: 'up' | 'down' | 'none';
  activityCount: number;
  activityPreview?: Activity;
  activityPreviewLoading?: boolean;
  isFavorite: boolean;
  onVote: (type: 'up' | 'down' | 'none') => void;
  onBookmarkToggle: () => void;
  role?: string | null;
  weightedUpvotes?: number;
  weightedDownvotes?: number;
  compact?: boolean;
  featured?: boolean;
};

export function PlaceCard({ place, onClick, onAddActivity, userVote, activityCount, activityPreview,
  activityPreviewLoading, isFavorite, onVote, onBookmarkToggle, role, weightedUpvotes = 0,
  weightedDownvotes = 0, compact = false, featured = false }: PlaceCardProps) {
  const language = useLanguage();
  const [isPressed, setIsPressed] = useState(false);
  if (!place) return null;
  const german = language === 'de';
  const primaryStyle = getPrimaryIconData(place, language);
  const PrimaryIcon = primaryStyle.icon;
  const tags = getCleanTags(place.categories || []).filter(item => item.isMain).slice(0, compact ? 1 : 2);
  const showWeights = role === 'admin' || role === 'supporter';
  const rating = place.rating || (place as Place & { averageRating?: number }).averageRating;
  const interactive = (target: EventTarget) => (target as HTMLElement).closest('button, a, input, select, textarea, [role="button"], [data-card-interactive]');
  const vote = (type: 'up' | 'down') => onVote(userVote === type ? 'none' : type);
  const voteLabel = (type: 'up' | 'down') => type === 'up' ? (german ? 'Gefällt mir' : 'Like') : (german ? 'Gefällt mir nicht' : 'Dislike');

  return (
    <article onClick={e => { if (!interactive(e.target) && !window.getSelection()?.toString()) onClick(); }}
      onPointerDown={e => { if (!interactive(e.target)) setIsPressed(true); }}
      onPointerUp={() => setIsPressed(false)} onPointerCancel={() => setIsPressed(false)} onPointerLeave={() => setIsPressed(false)}
      className={cn('group relative flex h-full w-full min-w-0 cursor-pointer overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-lg dark:border-white/[0.07] dark:bg-card motion-reduce:transition-none',
        featured ? 'flex-row min-h-[210px]' : 'flex-col', isPressed && 'scale-[0.985] motion-reduce:transform-none')}>
      <CategoryCardDecoration gradientClass={primaryStyle.gradientClass} icon={PrimaryIcon} label={primaryStyle.label}
        variant={featured ? 'featured' : 'standard'} appearance="feed"
        className={featured ? 'w-[76px] sm:w-40 md:w-52 self-stretch' : 'h-[74px] sm:h-[94px] shrink-0'}>
        {featured ? <>
          <span className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/85 px-1.5 sm:px-2 py-1 text-[7px] sm:text-[9px] font-semibold text-emerald-300">{translateAppString('featured.label', language)}</span>
          <div className="mt-6 flex flex-col items-center gap-3 px-2 text-center">
            <PrimaryIcon className="h-10 w-10 sm:h-14 sm:w-14 text-white" strokeWidth={1.6} />
            <span className="max-w-full text-[8px] sm:text-[10px] font-semibold uppercase tracking-wide text-white/95">{primaryStyle.label}</span>
          </div>
        </> : <>
          <PrimaryIcon className="absolute left-3 bottom-3 h-9 w-9 sm:left-4 sm:bottom-4 sm:h-11 sm:w-11 text-white" strokeWidth={1.7} />
          {place.distance !== undefined && <span className="absolute right-2.5 top-2.5 rounded-full border border-white/20 bg-black/25 px-2 py-1 text-[10px] sm:text-[11px] font-semibold text-white">{formatDistance(place.distance)}</span>}
        </>}
      </CategoryCardDecoration>

      <div className={cn('flex min-w-0 flex-1 flex-col', featured ? 'p-3 sm:p-5' : 'p-2.5 sm:p-4')}>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className={cn('min-w-0 flex-1 font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100', featured ? 'text-base sm:text-xl' : 'text-sm sm:text-base min-h-[2.5rem]')}>
            <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} className="w-full max-w-full min-w-0 line-clamp-2 break-words text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              {place.name || (german ? 'Unbekannter Ort' : 'Unknown place')}
            </button>
            {isEntityBoosted(place) && <Sparkles className="inline h-3.5 w-3.5 text-amber-500" aria-label={german ? 'Highlight' : 'Featured'} />}
          </h3>
          {featured && place.distance !== undefined && <span className="shrink-0 rounded-full bg-slate-100 dark:bg-white/5 px-2 py-1 text-[10px] sm:text-xs font-medium text-slate-600 dark:text-slate-300">{formatDistance(place.distance)}</span>}
        </div>
        <p className="mt-1 line-clamp-2 min-h-[2rem] text-[11px] sm:text-xs leading-relaxed text-slate-500 dark:text-slate-400 break-words">
          {place.openingHours ? formatOpeningHours(place.openingHours) : (place.address || (german ? 'Adresse noch nicht verfügbar' : 'Address not available')).split(',').slice(0, 2).join(', ')}
        </p>
        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5">
          {tags.map(item => <span key={item.tag} className="max-w-full truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-emerald-700 dark:text-emerald-400">{translateTag(item.tag, language)}</span>)}
          {rating !== undefined && rating > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400"><Star className="h-3 w-3 fill-current" />{rating.toFixed(1)}</span>}
          {role === 'admin' && place.relevanceScore !== undefined && <span className="text-[10px] text-amber-600 dark:text-amber-400">Score {place.relevanceScore.toFixed(1)}</span>}
          {role === 'admin' && (place.categories || []).map((tag, index) => <span key={`${tag}-${index}`} className="max-w-full truncate text-[9px] font-mono text-slate-500 dark:text-slate-400">{tag}</span>)}
        </div>
        <PlaceActivityPreview activity={activityPreview} activityCount={activityCount} loading={activityPreviewLoading} language={language} onClick={onClick} onCreate={() => onAddActivity(place)} />
        <div className="-mx-2 mt-auto flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5 sm:mx-0 sm:gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={german ? 'Spot bewerten' : 'Rate spot'} onClick={e => e.stopPropagation()}
                className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 dark:bg-background dark:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:hidden', userVote === 'up' && 'text-emerald-600 dark:text-emerald-400', userVote === 'down' && 'text-rose-600 dark:text-rose-400')}>
                {userVote === 'down' ? <ThumbsDown className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={e => e.stopPropagation()}>
              {(['up', 'down'] as const).map(type => <DropdownMenuItem key={type} onSelect={() => vote(type)} className="min-h-11 gap-2">
                {type === 'up' ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                {voteLabel(type)}{userVote === type && ' ✓'}{showWeights && ` (${type === 'up' ? `+${weightedUpvotes}` : `-${weightedDownvotes}`})`}
              </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="hidden shrink-0 items-center gap-0.5 rounded-xl bg-slate-50 dark:bg-background sm:flex">
            {(['up', 'down'] as const).map(type => <button type="button" key={type} aria-label={voteLabel(type)} aria-pressed={userVote === type}
              onClick={e => { e.stopPropagation(); vote(type); }}
              className={cn('flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl px-2 text-xs text-slate-500 dark:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary hover:bg-primary/10', userVote === type && (type === 'up' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-700 dark:text-rose-400'))}>
              {type === 'up' ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
              {showWeights && <span>{type === 'up' ? `+${weightedUpvotes}` : `-${weightedDownvotes}`}</span>}
            </button>)}
          </div>
          <div className="ml-auto flex shrink-0 sm:gap-0.5">
            <Button type="button" variant="ghost" size="icon" aria-label={german ? (isFavorite ? 'Aus Favoriten entfernen' : 'Spot merken') : (isFavorite ? 'Remove favorite' : 'Save spot')} aria-pressed={isFavorite}
              onClick={e => { e.stopPropagation(); onBookmarkToggle(); }} className={cn('h-11 w-11 rounded-xl text-slate-500 dark:text-slate-300', isFavorite && 'bg-primary/10 text-primary')}>
              <Bookmark className={cn('h-4 w-4', isFavorite && 'fill-current')} />
            </Button>
            <Button type="button" size="icon" data-tutorial-id="spot-card-create" aria-label={german ? 'Aktivität planen' : 'Plan activity'}
              onClick={e => { e.stopPropagation(); onAddActivity(place); }} className="h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
