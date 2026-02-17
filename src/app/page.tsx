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
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createActivity } from '@/lib/firebase/firestore';

const CardSkeleton = () => (
    <div className="w-full overflow-hidden rounded-2xl bg-card shadow-sm">
        <div className="aspect-[16/9] w-full bg-muted" />
        <div className="space-y-2 mt-4 p-4">
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
  const [activityModalPlace, setActivityModalPlace] = useState<Place | null>(null);
  const [activeCategory, setActiveCategory] = useState<string[]>(defaultCategories[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();


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

  const handleOpenActivityModal = (place: Place) => {
    if (!user) {
      router.push('/login');
      toast({
        title: 'Login Required',
        description: 'Please log in to create an activity.',
      });
      return;
    }
    setActivityModalPlace(place);
  };

  const handleCreateActivity = async (date: Date): Promise<boolean> => {
    if (!activityModalPlace || !user) {
        toast({
            title: 'Error',
            description: 'Something went wrong. Please try again.',
            variant: 'destructive',
        });
        return false;
    }

    try {
      const newActivityRef = await createActivity(activityModalPlace, date, user);
      
      toast({
        title: 'Activity Created!',
        description: `Your activity at ${activityModalPlace.name} is set and a chatroom is ready.`,
      });
      
      setActivityModalPlace(null);
      router.push(`/chat/${newActivityRef.id}`);
      return true;

    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to Create Activity',
        description: error.message || 'There was a problem creating your activity.',
      });
      return false;
    }
  };


  const renderContent = () => {
    if (locationError) {
      return (
        <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center p-6 text-center">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
      );
    }
    
    if (places.length === 0) {
        return (
            <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center p-6 text-center">
                <div className="space-y-2">
                    <h3 className="font-semibold text-lg">No places found</h3>
                    <p className="text-muted-foreground">Try a different category or check back later!</p>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {places.map(place => (
                <PlaceCard 
                  key={place.id} 
                  place={place} 
                  onClick={() => handlePlaceSelect(place)}
                  onAddActivity={() => handleOpenActivityModal(place)}
                />
            ))}
        </div>
    );
  };

  return (
    <>
      <div className="flex h-full flex-col">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm">
          <div className="px-4 sm:px-6 flex flex-col gap-4 py-4">
            <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
            <CategoryFilters activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-6">
            {renderContent()}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogContent className="max-h-dvh flex flex-col p-0 w-full max-w-lg gap-0">
              {selectedPlace && <PlaceDetails place={selectedPlace} onClose={handleDialogClose} />}
          </DialogContent>
      </Dialog>

      <CreateActivityDialog
        place={activityModalPlace}
        open={!!activityModalPlace}
        onOpenChange={(open) => !open && setActivityModalPlace(null)}
        onCreateActivity={handleCreateActivity}
      />
    </>
  );
}
