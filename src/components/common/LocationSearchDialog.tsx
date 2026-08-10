'use client';

import { useState, useRef, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { usePlanningMode } from '@/contexts/planning-mode-context';
import { searchLocation } from '@/lib/nominatim';
import type { Destination } from '@/lib/types';
import { useLanguage } from '@/hooks/use-language';
import { Loader2, MapPin, Search, Crown, ChevronRight, X } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

interface LocationSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium?: boolean;
  onOpenPremiumUpgrade?: () => void;
}

export function LocationSearchDialog({
  open,
  onOpenChange,
  isPremium = true,
  onOpenPremiumUpgrade = () => {},
}: LocationSearchDialogProps) {
  const { enterPlanningMode } = usePlanningMode();
  const language = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAbortController, setActiveAbortController] = useState<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input when dialog opens
  useEffect(() => {
    if (open && isPremium) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, isPremium]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPremium) {
      onOpenPremiumUpgrade();
      return;
    }
    if (!query.trim()) return;

    if (query.trim().length < 3) {
      setError(
        language === 'de'
          ? 'Bitte gib mindestens 3 Zeichen ein.'
          : 'Please enter at least 3 characters.'
      );
      return;
    }

    if (activeAbortController) {
      activeAbortController.abort();
    }
    const controller = new AbortController();
    setActiveAbortController(controller);

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const searchResults = await searchLocation(query, controller.signal);
      if (searchResults.length === 0) {
        setError(
          language === 'de'
            ? 'Keine Orte für deine Suche gefunden.'
            : 'No locations found for your search.'
        );
      }
      setResults(searchResults);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(
          language === 'de'
            ? 'Suche konnte nicht durchgeführt werden. Bitte versuche es erneut.'
            : 'Could not perform search. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (destination: Destination) => {
    enterPlanningMode(destination);
    onOpenChange(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setError(null);
      setIsLoading(false);
      if (activeAbortController) {
        activeAbortController.abort();
        setActiveAbortController(null);
      }
    }
    onOpenChange(isOpen);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleClose}>
      <DialogPrimitive.Portal>
        {/* Semi-transparent backdrop with backdrop-blur */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200'
          )}
        />

        {/* Centered Dialog for both Mobile & Desktop */}
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-[calc(100vw-32px)] sm:w-[calc(100vw-48px)] max-w-[540px]',
            'bg-white dark:bg-neutral-950 flex flex-col outline-none shadow-2xl overflow-hidden',
            'rounded-[24px]',
            'border border-slate-200/80 dark:border-neutral-800/80',
            'p-6 sm:p-7 max-h-[85dvh]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
            'duration-200 ease-out'
          )}
        >
          {/* Header section with Title, Close Button & Description */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col text-left">
              <DialogPrimitive.Title className="text-xl font-bold tracking-tight text-slate-900 dark:text-neutral-100 font-heading">
                {language === 'de' ? 'Ort suchen' : 'Plan a Trip'}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-slate-500 dark:text-neutral-400 mt-1 leading-snug">
                {language === 'de'
                  ? 'Suche nach einer Stadt oder einem Ort, um zu sehen, was dort los ist.'
                  : "Search for a city or place to see what's happening there."}
              </DialogPrimitive.Description>
            </div>

            {/* Subtle, cleanly aligned Close Button */}
            <DialogPrimitive.Close className="rounded-full p-2 text-slate-400 hover:text-slate-600 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800/80 border border-transparent hover:border-slate-200/50 dark:hover:border-neutral-700/50 transition-all shrink-0 focus:outline-none active:scale-95">
              <X className="w-5 h-5" />
              <span className="sr-only">Schließen</span>
            </DialogPrimitive.Close>
          </div>

          {/* Search Form / Premium Gate */}
          <div className="mt-5">
            {!isPremium ? (
              <div
                onClick={() => {
                  onOpenPremiumUpgrade();
                  onOpenChange(false);
                }}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-neutral-900 border border-amber-500/30 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-850 transition-all shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-950/40 dark:to-amber-900/40 flex items-center justify-center border border-amber-200/20 group-hover:scale-105 transition-transform">
                    <Crown className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-black text-slate-800 dark:text-neutral-200 uppercase tracking-tight">
                      {language === 'de' ? 'Andere Stadt eingeben' : 'Enter another city'}
                    </span>
                    <span className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5 font-bold uppercase tracking-wider">
                      Premium
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
            ) : (
              <form onSubmit={handleSearch} className="relative w-full">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={
                    language === 'de'
                      ? 'z. B. Berlin, Deutschland'
                      : 'E.g., Berlin, Germany'
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value.slice(0, 100))}
                  className={cn(
                    'w-full h-[52px] pl-4 pr-12 text-base rounded-2xl transition-all duration-200',
                    'bg-slate-50/80 dark:bg-neutral-900/80',
                    'border border-slate-200 dark:border-neutral-800',
                    'text-slate-900 dark:text-neutral-100',
                    'placeholder:text-slate-400 dark:placeholder:text-neutral-500',
                    'focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500',
                    'focus:ring-4 focus:ring-emerald-500/10 dark:focus:ring-emerald-500/15'
                  )}
                />
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-slate-400 dark:text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors rounded-xl focus:outline-none"
                  aria-label={language === 'de' ? 'Ort suchen' : 'Search place'}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                </button>
              </form>
            )}

            {/* Results List */}
            <div className="mt-4 space-y-1.5 max-h-[240px] sm:max-h-[300px] overflow-y-auto pr-1">
              {isLoading && (
                <div className="space-y-2 py-1">
                  <Skeleton className="h-12 w-full rounded-xl bg-slate-100 dark:bg-neutral-900" />
                  <Skeleton className="h-12 w-full rounded-xl bg-slate-100 dark:bg-neutral-900" />
                </div>
              )}
              {error && (
                <div className="p-4 text-center rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-destructive text-sm font-medium">{error}</p>
                </div>
              )}
              {results.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(result)}
                  className="w-full text-left p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-900/90 transition-colors flex items-center gap-3 group focus:outline-none focus:bg-slate-100 dark:focus:bg-neutral-900"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium text-slate-800 dark:text-neutral-200 line-clamp-2">
                    {result.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
