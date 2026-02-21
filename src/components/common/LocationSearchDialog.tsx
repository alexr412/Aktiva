'use client';

import { useState } from 'react';
import { usePlanningMode } from '@/contexts/planning-mode-context';
import { searchLocation } from '@/lib/nominatim';
import type { Destination } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Search } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';

interface LocationSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LocationSearchDialog({ open, onOpenChange }: LocationSearchDialogProps) {
  const { enterPlanningMode } = usePlanningMode();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setResults([]);
    
    try {
        const searchResults = await searchLocation(query);
        if (searchResults.length === 0) {
            setError("No locations found for your search.");
        }
        setResults(searchResults);
    } catch (e) {
        setError("Could not perform search. Please try again.");
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
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plan a Trip</DialogTitle>
          <DialogDescription>
            Search for a city or place to see what's happening there.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4">
            <form onSubmit={handleSearch} className="flex gap-2">
                <Input 
                    placeholder="E.g., Berlin, Germany"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <Button type="submit" size="icon" disabled={isLoading || !query.trim()}>
                    {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                </Button>
            </form>

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
