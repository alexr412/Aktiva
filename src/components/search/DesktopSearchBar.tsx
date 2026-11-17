'use client';

import React from 'react';
import { Search, MapPin, ChevronDown, Loader2, X, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface DesktopSearchBarProps {
  cityName: string;
  isPlanningLocation?: boolean;
  onOpenLocationDialog: () => void;
  onResetPlanningLocation: (e: React.MouseEvent) => void;
  searchQuery: string;
  onSearchQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSearch: () => void;
  onSearchSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isSearching: boolean;
  maxDistance: number | null;
  onMaxDistanceChange: (val: number | null) => void;
  language: string;
  className?: string;
}

export function DesktopSearchBar({
  cityName,
  isPlanningLocation = false,
  onOpenLocationDialog,
  onResetPlanningLocation,
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
  onSearchSubmit,
  isSearching,
  maxDistance,
  onMaxDistanceChange,
  language,
  className,
}: DesktopSearchBarProps) {
  const isDe = language === 'de';

  return (
    <div
      className={cn(
        'flex h-12 w-full items-center gap-2 rounded-xl bg-muted/65 px-2 focus-within:ring-2 focus-within:ring-primary/35',
        className
      )}
    >
      {/* 1. Location Segment */}
      <div className="flex items-center shrink-0 max-w-[200px] lg:max-w-[240px] min-w-0">
        <button
          type="button"
          aria-label={isDe ? 'Standort ändern' : 'Change location'}
          data-tutorial-id="header-location-desktop"
          onClick={onOpenLocationDialog}
          className="group/loc flex h-11 max-w-full min-w-0 items-center gap-1.5 rounded-lg px-2.5 text-left transition-colors hover:bg-accent"
        >
          <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />
          <span aria-live="polite" title={cityName} className="text-xs font-extrabold text-slate-700 dark:text-neutral-200 truncate tracking-tight">
            {cityName}
          </span>
          {isPlanningLocation && (
            <span
              role="button"
              aria-label={isDe ? 'Standort zurücksetzen' : 'Reset location'}
              title={isDe ? 'Standort zurücksetzen' : 'Reset location'}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onResetPlanningLocation(e);
              }}
              className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-neutral-750 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors font-bold text-[11px] leading-none shrink-0"
            >
              ×
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-neutral-400 shrink-0 group-hover/loc:text-neutral-600 dark:group-hover/loc:text-neutral-300 transition-colors" />
        </button>
      </div>

      {/* 2. Search Input Segment */}
      <form onSubmit={onSearchSubmit} className="relative flex min-w-0 flex-1 items-center" aria-busy={isSearching}>
        <Input
          type="search"
          enterKeyHint="search"
          id="desktop-search-input"
          aria-label={isDe ? 'Aktivitätssuche' : 'Activity search'}
          placeholder={isDe ? 'Was möchtest du unternehmen?' : 'What do you want to do?'}
          value={searchQuery}
          onChange={onSearchQueryChange}
          disabled={false}
          className="h-9 w-full border-0 bg-transparent pl-2 pr-9 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label={isDe ? 'Suche löschen' : 'Clear search'}
            onClick={onClearSearch}
            className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors rounded-full shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <Button type="submit" variant="ghost" size="icon" aria-label={isDe ? 'Suche starten' : 'Search'} className="h-11 w-11 shrink-0 rounded-lg text-muted-foreground hover:text-foreground">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </form>

      {/* 3. Radius Segment */}
      <div className="relative shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              aria-label={isDe ? 'Radius ändern' : 'Change radius'}
              variant="ghost"
              className="h-11 gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Target className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {maxDistance === null
                  ? isDe
                    ? 'Überall'
                    : 'Everywhere'
                  : `${maxDistance} km`}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-neutral-400 opacity-60 transition-transform group-data-[state=open]:rotate-180 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60 p-4 rounded-3xl border-none shadow-2xl z-50">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                  {isDe ? 'Radius' : 'Radius'}
                </span>
                <span className="text-sm font-black text-slate-900 dark:text-neutral-100">
                  {maxDistance === null ? '∞' : `${maxDistance} km`}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={maxDistance || 100}
                onChange={(e) =>
                  onMaxDistanceChange(
                    parseInt(e.target.value) === 100 ? null : parseInt(e.target.value)
                  )
                }
                className="w-full h-1.5 bg-slate-100 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 25, null].map((r) => (
                  <button
                    key={r === null ? 'all' : r}
                    type="button"
                    onClick={() => onMaxDistanceChange(r)}
                    className={cn(
                      'py-2 rounded-xl text-[10px] font-black transition-all',
                      maxDistance === r
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-slate-50 dark:bg-neutral-800/80 text-slate-500 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800'
                    )}
                  >
                    {r === null ? (isDe ? 'Alle' : 'All') : `${r}k`}
                  </button>
                ))}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
