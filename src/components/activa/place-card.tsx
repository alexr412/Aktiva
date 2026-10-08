'use client';

import { useState } from 'react';
import type { Activity, Place } from '@/lib/types';
import { Plus, Bookmark, ThumbsUp, ThumbsDown, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPrimaryIconData, translateAppString } from '@/lib/tag-config';
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
  weightedDownvotes = 0, featured = false }: PlaceCardProps) {
  const language = useLanguage();
  const [isPressed, setIsPressed] = useState(false);
  if (!place) return null;
  const german = language === 'de';
  const primaryStyle = getPrimaryIconData(place, language);
  const PrimaryIcon = primaryStyle.icon;
  const showWeights = role === 'admin' || role === 'supporter';
  const rating = place.rating || (place as Place & { averageRating?: number }).averageRating;
  const interactive = (target: EventTarget) => (target as HTMLElement).closest('button, a, input, select, textarea, [role="button"], [data-card-interactive]');
  const vote = (type: 'up' | 'down') => onVote(userVote === type ? 'none' : type);
  const voteLabel = (type: 'up' | 'down') => type === 'up' ? (german ? 'Gefällt mir' : 'Like') : (german ? 'Gefällt mir nicht' : 'Dislike');

  return (
    <article onClick={e => { if (!interactive(e.target) && !window.getSelection()?.toString()) onClick(); }}
      onPointerDown={e => { if (!interactive(e.target)) setIsPressed(true); }}
      onPointerUp={() => setIsPressed(false)} onPointerCancel={() => setIsPressed(false)} onPointerLeave={() => setIsPressed(false)}
      className={cn('group relative flex h-full w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:border-primary/25 hover:shadow-md md:flex-row motion-reduce:transition-none',
        isPressed && 'scale-[0.985] motion-reduce:transform-none')}>
      <div className="relative h-20 shrink-0 self-stretch md:h-auto md:w-24 lg:w-28">
        <CategoryCardDecoration gradientClass={primaryStyle.gradientClass} icon={PrimaryIcon} label={primaryStyle.label}
          appearance="feed" className="h-full min-h-20 w-full">
          <PrimaryIcon className="absolute bottom-3 left-3 h-9 w-9 text-white md:bottom-auto md:left-1/2 md:top-1/2 md:h-12 md:w-12 md:-translate-x-1/2 md:-translate-y-1/2 md:-rotate-6" strokeWidth={1.6} />
        </CategoryCardDecoration>
        <Button type="button" variant="ghost" size="icon" aria-label={german ? (isFavorite ? 'Aus Favoriten entfernen' : 'Spot merken') : (isFavorite ? 'Remove favorite' : 'Save spot')} aria-pressed={isFavorite}
          onClick={e => { e.stopPropagation(); onBookmarkToggle(); }} className={cn('absolute right-1 top-1 h-11 w-11 rounded-xl bg-black/10 text-white hover:bg-black/25 hover:text-white', isFavorite && 'bg-white/90 text-emerald-800 hover:bg-white hover:text-emerald-900')}>
          <Bookmark className={cn('h-4 w-4', isFavorite && 'fill-current')} />
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3 md:p-3.5">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground line-clamp-2">{primaryStyle.label}</p>
          {featured && <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"><Sparkles className="h-3 w-3" aria-hidden="true" />{translateAppString('featured.label', language)}</span>}
        </div>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug tracking-tight text-card-foreground sm:text-lg md:text-xl">
            <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} className="w-full max-w-full min-w-0 line-clamp-2 break-words text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              {place.name || (german ? 'Unbekannter Ort' : 'Unknown place')}
            </button>
            {isEntityBoosted(place) && <Sparkles className="inline h-3.5 w-3.5 text-amber-500" aria-label={german ? 'Highlight' : 'Featured'} />}
          </h3>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] sm:text-xs leading-relaxed text-muted-foreground break-words">
          {place.distance !== undefined && <span className="font-medium text-card-foreground">{formatDistance(place.distance)} · </span>}
          {place.openingHours ? formatOpeningHours(place.openingHours) : (place.address || (german ? 'Adresse noch nicht verfügbar' : 'Address not available')).split(',').slice(0, 2).join(', ')}
        </p>
        {((rating !== undefined && rating > 0) || role === 'admin') && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {rating !== undefined && rating > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400"><Star className="h-3 w-3 fill-current" />{rating.toFixed(1)}</span>}
          {role === 'admin' && place.relevanceScore !== undefined && <span className="text-[10px] text-amber-600 dark:text-amber-400">Score {place.relevanceScore.toFixed(1)}</span>}
          {role === 'admin' && (place.categories || []).map((tag, index) => <span key={`${tag}-${index}`} className="max-w-full truncate text-[9px] font-mono text-slate-500 dark:text-slate-400">{tag}</span>)}
        </div>}
        <PlaceActivityPreview activity={activityPreview} activityCount={activityCount} loading={activityPreviewLoading} language={language} onClick={onClick} onCreate={() => onAddActivity(place)} hideEmpty />
        <div className="mt-auto flex items-center justify-between gap-1 pt-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={german ? 'Spot bewerten' : 'Rate spot'} onClick={e => e.stopPropagation()}
                className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:hidden', userVote === 'none' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20' : userVote === 'up' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-600 text-white hover:bg-rose-700')}>
                {userVote === 'down' ? <ThumbsDown className="h-4 w-4 fill-current" /> : <ThumbsUp className={cn('h-4 w-4', userVote === 'up' && 'fill-current')} />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={e => e.stopPropagation()}>
              {(['up', 'down'] as const).map(type => <DropdownMenuItem key={type} onSelect={() => vote(type)} className={cn('min-h-11 gap-2', type === 'up' ? 'text-emerald-700 dark:text-emerald-400 focus:bg-emerald-500/15 focus:text-emerald-700 dark:focus:text-emerald-400' : 'text-rose-700 dark:text-rose-400 focus:bg-rose-500/15 focus:text-rose-700 dark:focus:text-rose-400', userVote === type && (type === 'up' ? 'bg-emerald-500/10' : 'bg-rose-500/10'))}>
                {type === 'up' ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                {voteLabel(type)}{userVote === type && ' ✓'}{showWeights && ` (${type === 'up' ? `+${weightedUpvotes}` : `-${weightedDownvotes}`})`}
              </DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="hidden shrink-0 items-center gap-1 sm:flex">
            {(['up', 'down'] as const).map(type => <button type="button" key={type} aria-label={voteLabel(type)} aria-pressed={userVote === type}
              onClick={e => { e.stopPropagation(); vote(type); }}
              className={cn('flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2', type === 'up' ? 'focus-visible:ring-emerald-500' : 'focus-visible:ring-rose-500', userVote === type ? (type === 'up' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-600 text-white hover:bg-rose-700') : (type === 'up' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20'))}>
              {type === 'up' ? <ThumbsUp className={cn('h-4 w-4', userVote === type && 'fill-current')} /> : <ThumbsDown className={cn('h-4 w-4', userVote === type && 'fill-current')} />}
              {showWeights && <span>{type === 'up' ? `+${weightedUpvotes}` : `-${weightedDownvotes}`}</span>}
            </button>)}
          </div>
          <Button type="button" variant="ghost" data-tutorial-id="spot-card-create" aria-label={german ? 'Aktivität planen' : 'Plan activity'}
            onClick={e => { e.stopPropagation(); onAddActivity(place); }} className="ml-auto h-11 w-11 shrink-0 gap-1 rounded-xl bg-emerald-500/10 p-0 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300 sm:h-9 sm:w-auto sm:rounded-lg sm:px-2.5">
            <Plus className="h-4 w-4" /><span className="hidden text-xs sm:inline">{german ? 'Planen' : 'Plan'}</span>
          </Button>
        </div>
      </div>
    </article>
  );
}
