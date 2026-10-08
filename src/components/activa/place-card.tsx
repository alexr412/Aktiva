'use client';

import { useState } from 'react';
import type { Activity, Place } from '@/lib/types';
import { Plus, Bookmark, BookmarkCheck, MoreHorizontal, Info, ThumbsUp, ThumbsDown, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPrimaryIconData } from '@/lib/tag-config';
import { formatOpeningHours } from '@/lib/tag-parser';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isEntityBoosted } from '@/lib/ranking';
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
      className={cn('group relative flex w-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-[14px] border border-border bg-card transition-[transform,border-color] duration-200 hover:border-primary/40 motion-reduce:transition-none',
        isPressed && 'scale-[0.985] motion-reduce:transform-none')}>
      <div aria-hidden="true" className={cn('h-[3px] w-full shrink-0', primaryStyle.gradientClass)} />

      <div className="flex min-w-0 flex-col p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-2">
          <span aria-hidden="true" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white', primaryStyle.gradientClass)}>
            <PrimaryIcon className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[10px] font-medium text-muted-foreground sm:text-[11px]">{primaryStyle.label}</p>
            {featured && <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 sm:text-[11px]"><Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />{german ? 'Empfohlen' : 'Recommended'}</span>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isFavorite && <BookmarkCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-300" aria-label={german ? 'Gespeichert' : 'Saved'} />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" aria-label={german ? `Optionen für ${place.name || 'diesen Spot'}` : `Options for ${place.name || 'this spot'}`}
                  onClick={e => e.stopPropagation()} className="h-11 w-11 rounded-lg text-muted-foreground hover:bg-muted hover:text-card-foreground sm:h-9 sm:w-9">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                <DropdownMenuItem onSelect={onBookmarkToggle} className="min-h-11 gap-2">
                  {isFavorite ? <BookmarkCheck /> : <Bookmark />}
                  {german ? (isFavorite ? 'Aus Favoriten entfernen' : 'Spot merken') : (isFavorite ? 'Remove favorite' : 'Save spot')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onClick} className="min-h-11 gap-2"><Info />{german ? 'Details ansehen' : 'View details'}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug tracking-tight text-card-foreground sm:text-lg">
            <button type="button" onClick={e => { e.stopPropagation(); onClick(); }} className="w-full max-w-full min-w-0 line-clamp-2 break-words text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              {place.name || (german ? 'Unbekannter Ort' : 'Unknown place')}
            </button>
            {isEntityBoosted(place) && <Sparkles className="inline h-3.5 w-3.5 text-amber-500" aria-label={german ? 'Highlight' : 'Featured'} />}
          </h3>
        </div>
        <p className="mt-1 line-clamp-2 break-words text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          {place.distance !== undefined && <span className="font-medium text-card-foreground">{formatDistance(place.distance)} · </span>}
          {place.openingHours ? formatOpeningHours(place.openingHours) : (place.address || (german ? 'Adresse noch nicht verfügbar' : 'Address not available')).split(',').slice(0, 2).join(', ')}
        </p>
        {((rating !== undefined && rating > 0) || role === 'admin') && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {rating !== undefined && rating > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400"><Star className="h-3 w-3 fill-current" />{rating.toFixed(1)}</span>}
          {role === 'admin' && place.relevanceScore !== undefined && <span className="text-[10px] text-amber-600 dark:text-amber-400">Score {place.relevanceScore.toFixed(1)}</span>}
          {role === 'admin' && (place.categories || []).map((tag, index) => <span key={`${tag}-${index}`} className="max-w-full truncate text-[9px] font-mono text-slate-500 dark:text-slate-400">{tag}</span>)}
        </div>}
        <PlaceActivityPreview activity={activityPreview} activityCount={activityCount} loading={activityPreviewLoading} language={language} onClick={onClick} onCreate={() => onAddActivity(place)} hideEmpty compact />
        <div className="mt-3 flex items-center justify-between gap-1">
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
            onClick={e => { e.stopPropagation(); onAddActivity(place); }} className="ml-auto h-11 w-11 shrink-0 gap-1 rounded-xl bg-primary p-0 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20 sm:h-9 sm:w-auto sm:rounded-lg sm:px-2.5">
            <Plus className="h-4 w-4" /><span className="hidden text-xs sm:inline">{german ? 'Planen' : 'Plan'}</span>
          </Button>
        </div>
      </div>
    </article>
  );
}
