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
        'flex items-center w-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border border-slate-200/80 dark:border-neutral-800 rounded-2xl shadow-xs hover:shadow-sm focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all duration-200 h-12 px-2 gap-1 group',
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800/60 transition-colors max-w-full min-w-0 text-left group/loc"
        >
          <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-xs font-extrabold text-slate-700 dark:text-neutral-200 truncate tracking-tight">
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

      {/* Vertical Divider */}
      <div className="h-6 w-[1px] bg-slate-200/80 dark:border-neutral-800/80 dark:bg-neutral-800 shrink-0 mx-0.5" />

      {/* 2. Search Input Segment */}
      <form onSubmit={onSearchSubmit} className="flex relative flex-1 min-w-0 items-center">
        {isSearching ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 animate-spin shrink-0 pointer-events-none" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 group-focus-within:text-emerald-500 transition-colors shrink-0 pointer-events-none" />
        )}
        <Input
          type="search"
          id="desktop-search-input"
          aria-label={isDe ? 'Aktivitätssuche' : 'Activity search'}
          placeholder={isDe ? 'Was möchtest du unternehmen?' : 'What do you want to do?'}
          value={searchQuery}
          onChange={onSearchQueryChange}
          disabled={false}
          className="w-full pl-9 pr-9 h-9 border-0 bg-transparent shadow-none font-bold text-xs text-slate-900 dark:text-neutral-100 placeholder:text-neutral-400 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label={isDe ? 'Suche löschen' : 'Clear search'}
            onClick={onClearSearch}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors rounded-full shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {/* Vertical Divider */}
      <div className="h-6 w-[1px] bg-slate-200/80 dark:border-neutral-800/80 dark:bg-neutral-800 shrink-0 mx-0.5" />

      {/* 3. Radius Segment */}
      <div className="relative shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              aria-label={isDe ? 'Radius ändern' : 'Change radius'}
              variant="ghost"
              className="h-9 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800/60 font-extrabold text-emerald-500 text-xs flex items-center gap-1.5 transition-colors group/rad"
            >
              <Target className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
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
