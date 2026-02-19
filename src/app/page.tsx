'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CategoryFilters, categories as defaultCategories } from '@/components/aktvia/category-filters';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { PlaceCard } from '@/components/aktvia/place-card';
import { fetchNearbyPlaces } from '@/lib/geoapify';
import type { Place, Activity } from '@/lib/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MapPin, Map as MapIcon, List, Plus, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createActivity, joinActivity } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { MapView } from '@/components/aktvia/map-view';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ActivityListItem } from "@/components/aktvia/activity-list-item";

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
  const [activityModalPlace, setActivityModalPlace] = useState<Place | 'custom' | null>(null);
  const [activeCategory, setActiveCategory] = useState<string[]>(defaultCategories[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [customActivities, setCustomActivities] = useState<Activity[]>([]);

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
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast({
            title: 'Location Error',
            description: 'Could not get location. Using default location (Bremerhaven).',
          });
          setUserLocation({ lat: 53.5451, lng: 8.5746 });
        }
      );
    } else {
      toast({
        title: 'Location Error',
        description: 'Geolocation not supported. Using default location (Bremerhaven).',
      });
      setUserLocation({ lat: 53.5451, lng: 8.5746 });
    }
  }, [toast]);

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
    const isCommunityCategory = activeCategory.includes("user_event") || activeCategory.includes("community");

    if (isCommunityCategory) {
      setPlaces([]); // Clear Geoapify places
      setIsLoading(true);
      const fetchCustomActivities = async () => {
        if (!db) {
          console.error("Firestore DB not available");
          setIsLoading(false);
          return;
        }
        const q = query(collection(db, "activities"), where("isCustomActivity", "==", true));
        const querySnapshot = await getDocs(q);
        const activitiesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Activity[];
        setCustomActivities(activitiesData);
        setIsLoading(false);
      };
      fetchCustomActivities();
      return; // Abort to prevent Geoapify call
    }
    
    if (userLocation) {
      setCustomActivities([]); // Clear custom activities if not in community tab
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
  
  const handleOpenCustomActivityModal = () => {
    if (!user) {
      router.push('/login');
      toast({
        title: 'Login Required',
        description: 'Please log in to create an activity.',
      });
      return;
    }
    setActivityModalPlace('custom');
  };

  const handleCreateActivity = async (date: Date, isFlexible: boolean, customLocationName?: string): Promise<boolean> => {
    if (!user) {
        toast({
            title: 'Error',
            description: 'You must be logged in to create an activity.',
            variant: 'destructive',
        });
        return false;
    }

    try {
      const isCustom = activityModalPlace === 'custom';
      
      if (isCustom && !customLocationName?.trim()) {
        toast({
            title: 'Location required',
            description: 'Please enter a name for your activity location.',
            variant: 'destructive',
        });
        return false;
      }

      const payload = isCustom 
        ? { customLocationName: customLocationName!, date, user, isTimeFlexible: isFlexible }
        : { place: activityModalPlace as Place, date, user, isTimeFlexible: isFlexible };

      // @ts-ignore
      const newActivityRef = await createActivity(payload);
      
      const activityName = isCustom ? customLocationName : (activityModalPlace as Place).name;

      toast({
        title: 'Activity Created!',
        description: `Your activity at ${activityName} is set and a chatroom is ready.`,
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

  const handleJoin = async (activityId: string) => {
    if (!user) {
        toast({ title: 'Login Required', description: 'You must be logged in to join an activity.' });
        router.push('/login');
        throw new Error('Login Required');
    }
    try {
        await joinActivity(activityId, user);
        toast({ title: 'Success!', description: 'You have joined the activity. You can find it in your chats.' });
        router.push(`/chat/${activityId}`);
    } catch (error: any) {
        console.error(error);
        toast({ title: 'Error', description: error.message || 'Failed to join activity.', variant: 'destructive' });
        throw error;
    }
  };


  const renderContent = () => {
    if (!userLocation && !isLoading) {
      return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <MapPin className="h-8 w-8 animate-bounce" />
                <p>Getting your location...</p>
            </div>
        </div>
      );
    }

    const isCommunityCategory = activeCategory.includes("user_event") || activeCategory.includes("community");

    if (viewMode === 'list') {
        if (isLoading) {
          return (
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                    <CardSkeleton key={i} />
                ))}
            </div>
          );
        }
        
        if (isCommunityCategory && customActivities.length === 0) {
            return (
                <div className="flex h-full w-full items-center justify-center p-6 text-center">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg">No community activities found</h3>
                        <p className="text-muted-foreground">Why not create one?</p>
                    </div>
                </div>
            )
        }
        
        if (!isCommunityCategory && places.length === 0) {
            return (
                <div className="flex h-full w-full items-center justify-center p-6 text-center">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-lg">No places found</h3>
                        <p className="text-muted-foreground">Try a different category or check back later!</p>
                    </div>
                </div>
            )
        }

        return (
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {isCommunityCategory ? (
                  customActivities.map((activity) => (
                    <ActivityListItem key={activity.id} activity={activity} user={user} onJoin={handleJoin} />
                  ))
                ) : (
                  places.map(place => (
                      <PlaceCard 
                        key={place.id} 
                        place={place} 
                        onClick={() => handlePlaceSelect(place)}
                        onAddActivity={() => handleOpenActivityModal(place)}
                      />
                  ))
                )}
            </div>
        );
    }

    if (viewMode === 'map') {
        if (isLoading || !userLocation) {
             return (
                <div className="flex h-full w-full items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <MapPin className="h-8 w-8 animate-bounce" />
                        <p>{userLocation ? 'Loading places...' : 'Getting your location...'}</p>
                    </div>
                </div>
              );
        }

        return (
            <MapView places={places} userLocation={userLocation} onPlaceSelect={handlePlaceSelect} />
        )
    }
  };

  return (
    <>
      <div className="flex h-full w-full flex-col">
        <header className="flex-none w-full border-b bg-background z-20">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
             <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
                        <Bell className="h-5 w-5" />
                        <span className="sr-only">Benachrichtigungen</span>
                    </Button>
                    <div className="flex items-center gap-1 rounded-full bg-muted p-1">
                        <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-full shadow-sm" onClick={() => setViewMode('list')}>
                            <List className="h-4 w-4" />
                            <span className="sr-only">List View</span>
                        </Button>
                        <Button variant={viewMode === 'map' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-full shadow-sm" onClick={() => setViewMode('map')}>
                            <MapIcon className="h-4 w-4" />
                            <span className="sr-only">Map View</span>
                        </Button>
                    </div>
                    <Button variant="default" size="icon" className="h-9 w-9 rounded-full shadow-sm" onClick={handleOpenCustomActivityModal}>
                        <Plus className="h-5 w-5" />
                        <span className="sr-only">Create Custom Activity</span>
                    </Button>
                </div>
            </div>
            <CategoryFilters activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
          </div>
        </header>

        <div className={`flex-1 w-full pb-[100px] ${viewMode === 'list' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {renderContent()}
        </div>
      </div>

      <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogContent className="max-h-dvh flex flex-col p-0 w-full max-w-lg gap-0">
              {selectedPlace && <PlaceDetails place={selectedPlace} onClose={handleDialogClose} />}
          </DialogContent>
      </Dialog>

      <CreateActivityDialog
        place={activityModalPlace === 'custom' ? null : activityModalPlace}
        open={!!activityModalPlace}
        onOpenChange={(open) => !open && setActivityModalPlace(null)}
        onCreateActivity={handleCreateActivity}
      />
    </>
  );
}
