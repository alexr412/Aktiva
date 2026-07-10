'use client';

import { useState } from 'react';
import { usePlanningMode } from '@/contexts/planning-mode-context';
import { searchLocation } from '@/lib/nominatim';
import type { Destination } from '@/lib/types';
import { useLanguage } from '@/hooks/use-language';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Search, Crown, ChevronRight } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface LocationSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium?: boolean;
  onOpenPremiumUpgrade?: () => void;
}

export function LocationSearchDialog({ open, onOpenChange, isPremium = true, onOpenPremiumUpgrade = () => {} }: LocationSearchDialogProps) {
  const { enterPlanningMode } = usePlanningMode();
  const language = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAbortController, setActiveAbortController] = useState<AbortController | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPremium) {
      onOpenPremiumUpgrade();
      return;
    }
    if (!query.trim()) return;

    if (query.trim().length < 3) {
      setError(language === 'de' ? "Bitte gib mindestens 3 Zeichen ein." : "Please enter at least 3 characters.");
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
            setError(language === 'de' ? "Keine Orte für deine Suche gefunden." : "No locations found for your search.");
        }
        setResults(searchResults);
    } catch (e: any) {
        if (e.name !== 'AbortError') {
            setError(language === 'de' ? "Suche konnte nicht durchgeführt werden. Bitte versuche es erneut." : "Could not perform search. Please try again.");
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
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{language === 'de' ? 'Ort suchen' : 'Plan a Trip'}</DialogTitle>
          <DialogDescription>
            {language === 'de'
              ? 'Suche nach einer Stadt oder einem Ort, um zu sehen, was dort los ist.'
              : 'Search for a city or place to see what\'s happening there.'}
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4">
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
            <form onSubmit={handleSearch} className="flex gap-2">
                <Input 
                    placeholder={language === 'de' ? 'Z. B. Berlin, Deutschland' : 'E.g., Berlin, Germany'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value.slice(0, 100))}
                />
                <Button type="submit" size="icon" disabled={isLoading || !query.trim()}>
                    {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                </Button>
            </form>
          )}

            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {isLoading && (
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                )}
                {error && <p className="text-destructive text-sm text-center p-4">{error}</p>}
                {results.map((result, index) => (
                    <button 
                        key={index}
                        onClick={() => handleSelect(result)}
                        className="w-full text-left p-3 rounded-md hover:bg-accent flex items-start gap-3"
                    >
                        <MapPin className="h-5 w-5 mt-1 flex-shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium">{result.name}</span>
                    </button>
                ))}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
