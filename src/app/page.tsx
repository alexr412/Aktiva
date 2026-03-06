'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CategoryFilters } from '@/components/aktvia/category-filters';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { PlaceCard } from '@/components/aktvia/place-card';
import type { Place, Activity, GeoapifyFeature } from '@/lib/types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MapPin, Map as MapIcon, List, Plus, Search, Bookmark, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createActivity, joinActivity } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { MapView } from '@/components/aktvia/map-view';
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ActivityListItem } from "@/components/aktvia/activity-list-item";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { usePlanningMode } from '@/contexts/planning-mode-context';
import { LocationSearchDialog } from '@/components/common/LocationSearchDialog';
import { useFavorites } from '@/contexts/favorites-context';
import useSWRInfinite from 'swr/infinite';
import { GEOAPIFY_API_KEY } from '@/lib/config';
import { GLOBAL_EXCLUDE_STRING, BLACKLISTED_CATEGORIES } from '@/lib/geoapify';

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

const PLACES_PER_PAGE = 300;
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activityModalPlace, setActivityModalPlace] = useState<Place | 'custom' | null>(null);
  const [activeCategory, setActiveCategory] = useState<string[]>(['all']);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [customActivities, setCustomActivities] = useState<Activity[]>([]);
  const [allUpcomingActivities, setAllUpcomingActivities] = useState<Activity[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [cityName, setCityName] = useState<string>("Locating...");
  const [sortBy, setSortBy] = useState("distance");
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(5);

  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { planningState } = usePlanningMode();
  const { favorites } = useFavorites();

  const isCommunityCategory = activeCategory.includes("user_event") || activeCategory.includes("community");
  const isFavoritesCategory = activeCategory.includes("favorites");

  const getKey = (pageIndex: number, previousPageData: any) => {
    if (isCommunityCategory || isFavoritesCategory) return null;
    if (!userLocation) return null;
    if (previousPageData && (!previousPageData.features || previousPageData.features.length === 0)) return null;

    let categoriesToFetch: string[];
    if (activeCategory.includes('all') || activeCategory.length === 0) {
      categoriesToFetch = ["tourism", "entertainment", "heritage"];
    } else {
      categoriesToFetch = activeCategory;
    }

    const offset = pageIndex * PLACES_PER_PAGE;
    const radiusMeters = searchRadiusKm * 1000;
    
    let url = `https://api.geoapify.com/v2/places?categories=${categoriesToFetch.join(',')}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=${PLACES_PER_PAGE}&offset=${offset}&conditions=named&exclude=${GLOBAL_EXCLUDE_STRING}&apiKey=${GEOAPIFY_API_KEY}`;

    return url;
  }

  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
    dedupingInterval: 60000,
  });

  const rawPlaces = useMemo(() => {
    if (!data) return [];
    return data.flatMap(page => {
      const features = page.features || [];
      
      // Client-Side Post-Processing Blacklist
      const safeFeatures = features.filter((feature: any) => {
        const featureCats = feature.properties?.categories || [];
        const catsArray = Array.isArray(featureCats) ? featureCats : [featureCats];
        return !catsArray.some((cat: string) => BLACKLISTED_CATEGORIES.includes(cat));
      });

      return safeFeatures.map((feature: GeoapifyFeature) => {
        const props = feature.properties;
        let rating;
        if (props.datasource?.raw?.rating) {
          const parsedRating = parseFloat(props.datasource.raw.rating);
          if (!isNaN(parsedRating)) {
              rating = Math.max(0, Math.min(5, parsedRating));
          }
        }
        return {
          id: props.place_id,
          name: props.name || props.address_line1,
          address: props.address_line2,
          categories: Array.isArray(props.categories) ? props.categories : [props.categories],
          lat: props.lat,
          lon: props.lon,
          rating: rating,
          distance: props.distance,
        } as Place;
      });
    });
  }, [data]);
  
  const places = useMemo(() => {
    return rawPlaces.map(p => ({
        ...p,
        activityCount: allUpcomingActivities.filter(a => a.placeId === p.id).length
    }));
  }, [rawPlaces, allUpcomingActivities]);


  const isLoadingInitialData = isLoading;
  const isFetchingMore = isValidating && !isLoadingInitialData;
  const isEmpty = !data || data.length === 0 || !(data[0]?.features?.length > 0);
  const hasMore = !isEmpty && data && (data[data.length - 1]?.features?.length === PLACES_PER_PAGE);

  const resetFilters = () => {
    setActiveCategory(['all']);
    setSearchQuery('');
    setSortBy('distance');
    setSearchRadiusKm(5);
  };

  useEffect(() => {
    const reverseGeocode = async (lat: number, lng: number) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        setCityName(data.address.city || data.address.town || data.address.village || "Unknown location");
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        setCityName("Could not find city");
      }
    };

    if (planningState.isPlanning && planningState.destination) {
      setUserLocation(planningState.destination);
      setCityName(planningState.destination.name);
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          if (location.lat && location.lng) {
            reverseGeocode(location.lat, location.lng);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          toast({
            title: 'Location Error',
            description: 'Could not get location. Using default location (Bremerhaven).',
          });
          setUserLocation({ lat: 53.5451, lng: 8.5746 });
          setCityName("Bremerhaven");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      toast({
        title: 'Location Error',
        description: 'Geolocation not supported. Using default location (Bremerhaven).',
      });
      setUserLocation({ lat: 53.5451, lng: 8.5746 });
      setCityName("Bremerhaven");
    }
  }, [toast, planningState]);
  
  useEffect(() => {
    const fetchAllUpcomingActivities = async () => {
        if (!db) return;
        const activitiesQuery = query(
            collection(db, "activities"),
            where("activityDate", ">=", Timestamp.now())
        );
        const querySnapshot = await getDocs(activitiesQuery);
        const activitiesData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Activity[];
        setAllUpcomingActivities(activitiesData);
    };
    fetchAllUpcomingActivities();
  }, []);

  useEffect(() => {
    if (isCommunityCategory) {
        setCustomActivities(allUpcomingActivities.filter(act => act.isCustomActivity));
    }
  }, [isCommunityCategory, allUpcomingActivities]);

  const observer = useRef<IntersectionObserver>();
  const lastElementRef = useCallback(node => {
    if (isFetchingMore || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setSize(size + 1);
      }
    });

    if (node) observer.current.observe(node);
  }, [isFetchingMore, hasMore, setSize, size]);

  const handleCategoryChange = (categoryId: string[]) => {
    setSearchQuery('');
    setActiveCategory(categoryId);
    const isCommunity = categoryId.includes("user_event") || categoryId.includes("community");
    const isFavorites = categoryId.includes("favorites");
    setSortBy(isCommunity ? 'newest' : (isFavorites ? 'distance' : 'distance'));
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

  const handleCreateActivity = async (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number): Promise<boolean> => {
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
        ? { customLocationName: customLocationName!, startDate, endDate, user, isTimeFlexible, maxParticipants }
        : { place: activityModalPlace as Place, startDate, endDate, user, isTimeFlexible, maxParticipants };

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
    if (isLoadingInitialData) {
      return (
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
      );
    }
    
    if (!userLocation && !isLoadingInitialData) {
      return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <MapPin className="h-8 w-8 animate-bounce" />
                <p>Getting your location...</p>
            </div>
        </div>
      );
    }
    
    if (error) {
        return (
            <div className="flex h-full w-full items-center justify-center p-6 text-center">
                <p className="text-destructive">Could not load places. Please try again later.</p>
            </div>
        );
    }

    const EmptySearchState = () => (
        <div className="flex h-full w-full items-center justify-center p-6 text-center">
            <div className="space-y-4">
                <h3 className="font-semibold text-lg">Keine Ergebnisse gefunden</h3>
                <p className="text-muted-foreground">Passe deine Suche oder die Filter an.</p>
                <Button onClick={resetFilters} variant="outline">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Filter zurücksetzen
                </Button>
            </div>
        </div>
    );

    if (viewMode === 'list') {
        const renderList = () => {
            if (isFavoritesCategory) {
                if (favorites.length === 0) {
                     return (
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center h-full">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <Bookmark className="h-10 w-10 text-primary" />
                            </div>
                            <h2 className="text-xl font-semibold">No Favorites Yet</h2>
                            <p className="text-muted-foreground">
                                Tap the bookmark icon on a place to save it for later.
                            </p>
                        </div>
                    );
                }
                return (
                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {favorites.map(place => (
                          <PlaceCard
                            key={place.id}
                            place={place as Place}
                            onClick={() => handlePlaceSelect(place as Place)}
                            onAddActivity={() => handleOpenActivityModal(place as Place)}
                          />
                      ))}
                    </div>
                );
            }
            
            if (isCommunityCategory) {
                const filteredCustomActivities = customActivities.filter(activity =>
                    activity.placeName.toLowerCase().includes(searchQuery.toLowerCase())
                );
    
                const sortedActivities = filteredCustomActivities.sort((a, b) => {
                    if (sortBy === 'newest') {
                        return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
                    }
                    return 0;
                });
                
                const visibleActivities = sortedActivities.filter(act => !userProfile?.hiddenEntityIds?.includes(act.id!));
    
                if (visibleActivities.length === 0) {
                     return searchQuery ? <EmptySearchState /> : (
                        <div className="flex h-full w-full items-center justify-center p-6 text-center">
                            <div className="space-y-2">
                                <h3 className="font-semibold text-lg">No community activities found</h3>
                                <p className="text-muted-foreground">Why not create one?</p>
                            </div>
                        </div>
                    )
                }
                return (
                  <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {visibleActivities.map((activity) => (
                        <ActivityListItem key={activity.id} activity={activity} user={user} onJoin={handleJoin} />
                      ))}
                  </div>
                );
            } else {
                const filteredPlaces = places.filter(place =>
                    place.name.toLowerCase().includes(searchQuery.toLowerCase())
                );
    
                const sortedPlaces = filteredPlaces.sort((a, b) => {
                    if (sortBy === 'distance') {
                        return (a.distance || 0) - (b.distance || 0);
                    }
                    if (sortBy === 'rating') {
                        return (b.rating || 0) - (a.rating || 0);
                    }
                    if (sortBy === 'popular') {
                        return (b.activityCount || 0) - (a.activityCount || 0);
                    }
                    return 0;
                });
    
                if (sortedPlaces.length === 0 && !isFetchingMore) {
                     return <EmptySearchState />;
                }
                return (
                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {sortedPlaces.map((place, index) => {
                        const isLastElement = index === sortedPlaces.length - 1;
                        return (
                          <div ref={isLastElement ? lastElementRef : null} key={place.id}>
                            <PlaceCard 
                              place={place} 
                              onClick={() => handlePlaceSelect(place)}
                              onAddActivity={() => handleOpenActivityModal(place)}
                            />
                          </div>
                        )
                      })}
                    </div>
                );
            }
        };

        return (
            <div className="max-w-7xl mx-auto w-full">
                {renderList()}
                {isFetchingMore && (
                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <CardSkeleton />
                        <CardSkeleton />
                    </div>
                )}
                {!isFetchingMore && !hasMore && places.length > 0 && !isCommunityCategory && !isFavoritesCategory && (
                    <p className="text-center text-muted-foreground p-6">You've reached the end of the list.</p>
                )}
            </div>
        );
    }

    if (viewMode === 'map') {
        if (!userLocation) {
             return (
                <div className="flex h-full w-full items-center justify-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <MapPin className="h-8 w-8 animate-bounce" />
                        <p>Getting your location...</p>
                    </div>
                </div>
              );
        }
        
        const placesForMap = isFavoritesCategory
            ? (favorites as Place[])
            : places.filter(place => place.name.toLowerCase().includes(searchQuery.toLowerCase()));

        return (
            <MapView places={placesForMap} userLocation={userLocation} onPlaceSelect={handlePlaceSelect} />
        );
    }
  };

  return (
    <>
      <div className="flex h-full w-full flex-col">
        <header className="flex-none w-full border-b bg-background z-20">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 max-w-7xl mx-auto w-full">
             <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
                  <button onClick={() => setIsLocationSearchOpen(true)} className="flex items-center gap-1 text-muted-foreground mt-1 hover:text-primary transition-colors">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {cityName}
                    </span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                    <NotificationBell />
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
            <div className="mt-4 flex w-full items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Orte oder Aktivitäten suchen..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (e.target.value && !activeCategory.includes('all') && !isCommunityCategory && !isFavoritesCategory) {
                            setActiveCategory(['all']);
                        }
                    }}
                    className="w-full rounded-full bg-muted pl-10 h-12"
                />
              </div>
              {!isFavoritesCategory && (
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] rounded-full h-12 bg-muted border-none focus:ring-0">
                        <SelectValue placeholder="Sortieren nach..." />
                    </SelectTrigger>
                    <SelectContent>
                        {isCommunityCategory ? (
                          <SelectItem value="newest">Neueste</SelectItem>
                        ) : (
                          <>
                              <SelectItem value="distance">Distanz</SelectItem>
                              <SelectItem value="rating">Bewertung</SelectItem>
                              <SelectItem value="popular">Beliebteste</SelectItem>
                          </>
                        )}
                    </SelectContent>
                </Select>
              )}
            </div>
            {!isCommunityCategory && !isFavoritesCategory && (
              <div className="flex flex-col gap-2 mb-2">
                <div className="flex justify-between items-center text-sm font-medium text-muted-foreground px-1">
                  <span>Search Radius</span>
                  <span className="text-primary font-bold">{searchRadiusKm} km</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={searchRadiusKm}
                  onChange={(e) => setSearchRadiusKm(Number(e.target.value))}
                  className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            )}
          </div>
        </header>

        <div className={`flex-1 w-full pb-[100px] ${viewMode === 'list' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {renderContent()}
        </div>
      </div>

      <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogContent className="max-h-[95vh] flex flex-col p-0 w-full max-w-4xl gap-0 overflow-hidden">
              {selectedPlace && <PlaceDetails place={selectedPlace} onClose={handleDialogClose} />}
          </DialogContent>
      </Dialog>

      <CreateActivityDialog
        place={activityModalPlace === 'custom' ? null : activityModalPlace}
        open={!!activityModalPlace}
        onOpenChange={(open) => !open && setActivityModalPlace(null)}
        onCreateActivity={handleCreateActivity}
      />

      <LocationSearchDialog 
        open={isLocationSearchOpen}
        onOpenChange={setIsLocationSearchOpen}
      />
    </>
  );
}
