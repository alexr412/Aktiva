'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CategoryFilters, categories as defaultCategories } from '@/components/aktvia/category-filters';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { PlaceCard } from '@/components/aktvia/place-card';
import { fetchNearbyPlaces } from '@/lib/geoapify';
import type { Place } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const CardSkeleton = () => (
    <div className="w-full">
        <Skeleton className="h-[250px] w-full rounded-2xl" />
        <div className="space-y-2 mt-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
        </div>
    </div>
);


export default function Home() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activeCategory, setActiveCategory] = useState<string[]>(defaultCategories[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError('Could not get your location. Please enable location services and refresh.');
          setIsLoading(false);
        }
      );
    } else {
      setLocationError('Geolocation is not supported by this browser.');
      setIsLoading(false);
    }
  }, []);

  const loadPlaces = useCallback(async (lat: number, lng: number, category: string[]) => {
    setIsLoading(true);
    setPlaces([]);
    try {
      const fetchedPlaces = await fetchNearbyPlaces(lat, lng, category);
      setPlaces(fetchedPlaces);
    } catch (error) {
      console.error('Failed to load places:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not fetch nearby places. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (userLocation) {
      loadPlaces(userLocation.lat, userLocation.lng, activeCategory);
    }
  }, [userLocation, activeCategory, loadPlaces]);

  const handleCategoryChange = (categoryId: string[]) => {
    setActiveCategory(categoryId);
  };

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place);
  };

  const handleDialogClose = () => {
    setSelectedPlace(null);
  }

  const renderContent = () => {
    if (locationError) {
      return (
        <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center p-6">
            <Card className="max-w-sm">
                <CardHeader><CardTitle className="text-destructive">Location Error</CardTitle></CardHeader>
                <CardContent>{locationError}</CardContent>
            </Card>
        </div>
      );
    }

    if (!userLocation && !isLoading) {
      return (
        <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <MapPin className="h-8 w-8 animate-bounce" />
                <p>Getting your location...</p>
            </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
      );
    }
    
    if (places.length === 0) {
        return (
            <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center">
                <p className="text-muted-foreground">No places found. Try a different category!</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {places.map(place => (
                <PlaceCard key={place.id} place={place} onClick={() => handlePlaceSelect(place)} />
            ))}
        </div>
    );
  };

  return (
    <>
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
          <div className="space-y-4 py-4 px-4 sm:px-6">
            <h1 className="text-3xl font-bold tracking-tight pt-4">Discover</h1>
            <CategoryFilters activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
          </div>
        </header>

        <div className="px-4 sm:px-6 py-6">
            {renderContent()}
        </div>

        <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
            <DialogContent className="p-0 h-full w-full max-w-none gap-0 overflow-hidden">
                {selectedPlace && <PlaceDetails place={selectedPlace} onClose={handleDialogClose} />}
            </DialogContent>
        </Dialog>
    </>
  );
}
