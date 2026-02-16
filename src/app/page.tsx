'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Sidebar,
    SidebarProvider,
    SidebarHeader,
    SidebarContent,
    SidebarInset,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuSkeleton,
    SidebarTrigger
} from '@/components/ui/sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/icons/logo';
import { CategoryFilters, categories as defaultCategories } from '@/components/aktvia/category-filters';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { fetchNearbyPlaces } from '@/lib/geoapify';
import type { Place } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Search } from 'lucide-react';

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
    setSelectedPlace(null);
  };

  const handlePlaceSelect = (place: Place | null) => {
    setSelectedPlace(place);
  };

  return (
    <SidebarProvider>
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <div className="flex items-center gap-2 p-2">
                    <Logo className="h-6 w-auto" />
                    <SidebarTrigger className="ml-auto" />
                </div>
            </SidebarHeader>
            <SidebarContent>
                <CategoryFilters activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
                <ScrollArea className="flex-1">
                    <SidebarMenu>
                        {isLoading && (
                            Array.from({ length: 5 }).map((_, i) => (
                                <SidebarMenuItem key={i}><SidebarMenuSkeleton showIcon /></SidebarMenuItem>
                            ))
                        )}
                        {!isLoading && places.length === 0 && (
                            <p className="p-4 text-sm text-muted-foreground">No places found in this category.</p>
                        )}
                        {!isLoading && places.map(place => (
                            <SidebarMenuItem key={place.id}>
                                <button onClick={() => handlePlaceSelect(place)} className="w-full text-left p-3 hover:bg-sidebar-accent rounded-lg transition-colors">
                                    <p className="font-semibold text-sm">{place.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                                </button>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </ScrollArea>
            </SidebarContent>
        </Sidebar>

        <SidebarInset>
            {locationError && (
                <div className="flex h-full w-full items-center justify-center bg-muted p-4">
                    <Card className="max-w-sm">
                        <CardHeader><CardTitle className="text-destructive">Location Error</CardTitle></CardHeader>
                        <CardContent>{locationError}</CardContent>
                    </Card>
                </div>
            )}
            {!userLocation && !locationError && (
                 <div className="flex h-full w-full items-center justify-center bg-muted">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <MapPin className="h-8 w-8 animate-bounce" />
                        <p>Getting your location...</p>
                    </div>
                </div>
            )}
            {userLocation && (
                selectedPlace ? (
                    <PlaceDetails place={selectedPlace} onClose={() => handlePlaceSelect(null)} />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                        <div className="text-center p-8">
                            <Search className="h-16 w-16 mx-auto text-muted-foreground" />
                            <h3 className="text-xl font-semibold mt-4">Select a place</h3>
                            <p className="text-muted-foreground mt-2">
                                Choose a place from the list to see its details.
                            </p>
                        </div>
                    </div>
                )
            )}
        </SidebarInset>
    </SidebarProvider>
  );
}
