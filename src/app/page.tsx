'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/use-toast';
import { CategoryFilters } from '@/components/aktvia/category-filters';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { PlaceCard } from '@/components/aktvia/place-card';
import type { Place, Activity, GeoapifyFeature, UserPreferences, ActivityCategory } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { MapPin, Map as MapIcon, List, Plus, Search, Bookmark, RotateCcw, Lock, Sparkles, Check, Loader2, Crown, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createActivity, joinActivity } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, startAfter } from "firebase/firestore";
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
import { GLOBAL_EXCLUDE_STRING, calculateRelevanceScore } from '@/lib/geoapify';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserBadge } from '@/components/common/UserBadge';
import { calculateDistance } from '@/lib/geo-utils';

// Dynamic import for MapView to avoid SSR issues
const MapView = dynamic(() => import('@/components/aktvia/map-view').then(mod => mod.MapView), { 
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-muted"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

const CardSkeleton = () => (
    <div className="w-full overflow-hidden rounded-3xl bg-white shadow-sm flex flex-row p-0 border border-slate-100/50 min-h-[130px]">
        <Skeleton className="w-28 sm:w-32 h-32 rounded-none" />
        <div className="p-4 flex flex-col justify-between flex-1 gap-3">
            <div className="space-y-2">
                <Skeleton className="h-5 w-3/4 rounded-lg" />
                <Skeleton className="h-3 w-1/2 rounded-md" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-4 w-12 rounded-full" />
                <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-8 w-16 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
        </div>
    </div>
);

const PLACES_PER_PAGE = 10;
const QUARANTINE_THRESHOLD = 3;
const ACTIVITY_CATEGORIES: (ActivityCategory | 'Alle')[] = ['Alle', 'Sport', 'Tech', 'Party', 'Kultur', 'Outdoor', 'Gaming', 'Networking', 'Sonstiges'];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const DISTANCE_FILTERS = [
  { label: 'Alle', value: null },
  { label: '< 5km', value: 5 },
  { label: '< 10km', value: 10 },
  { label: '< 25km', value: 25 },
];

export default function Home() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activityModalPlace, setActivityModalPlace] = useState<Place | 'custom' | null>(null);
  const [activeCategory, setActiveCategory] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState("");
  const [cityName, setCityName] = useState<string>("Wird geladen...");
  const [sortBy, setSortBy] = useState("recommended");
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
  const [isPremiumUpsellOpen, setIsPremiumUpsellOpen] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<ActivityCategory | 'Alle'>('Alle');

  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { planningState } = usePlanningMode();
  const { favorites } = useFavorites();

  const isCommunityCategory = activeTabId === "Community";
  const isFavoritesCategory = activeTabId === "Favorites";
  const isHighlightsCategory = activeTabId === "Highlights";
  const isAktivCategory = activeTabId === "Aktiv";

  // MULTI-SOURCE FETCHER (Geoapify vs Firestore)
  const multiFetcher = async (key: any) => {
    if (!key) return null;
    const { type, cursorValue } = key;

    try {
      if (type === 'geoapify') {
        const { url } = key;
        return fetcher(url);
      }

      if (type === 'activities') {
        // --- ARCHITEKTUR UPDATE: QUERY SIMPLIFIZIERUNG ZUR VERMEIDUNG VON INDEX-FEHLERN ---
        const constraints: any[] = [
          limit(PLACES_PER_PAGE * 5)
        ];
        
        // Temporäre Deaktivierung von orderBy zur Vermeidung von Composite Index Anforderungen bei Filterung
        // constraints.push(orderBy('createdAt', 'desc')); 
        
        if (cursorValue) {
            // startAfter erfordert orderBy
            // constraints.push(startAfter(cursorValue));
        }
        
        const q = query(collection(db!, 'activities'), ...constraints);
        const snap = await getDocs(q);
        const allFetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const isCommunity = key.subType === 'community';
        const filtered = allFetched.filter((act: any) => 
          isCommunity ? act.isCustomActivity === true : act.isCustomActivity !== true
        );

        return filtered.slice(0, PLACES_PER_PAGE);
      }

      if (type === 'highlights') {
        const constraints: any[] = [
          where('upvotes', '>', 0),
          orderBy('upvotes', 'desc'),
          limit(PLACES_PER_PAGE)
        ];
        if (cursorValue !== null) constraints.push(startAfter(cursorValue));
        const q = query(collection(db!, 'places'), ...constraints);
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } catch (error: any) {
      console.error("🔥 FIRESTORE QUERY ERROR:", error.message, "Key:", key);
      throw error;
    }

    return null;
  };

  const getKey = (pageIndex: number, previousPageData: any) => {
    if (isFavoritesCategory) return null;
    if (previousPageData && (
      (previousPageData.features && previousPageData.features.length === 0) ||
      (Array.isArray(previousPageData) && previousPageData.length === 0)
    )) return null;

    if (isCommunityCategory || isAktivCategory) {
      const cursor = pageIndex === 0 ? null : previousPageData[previousPageData.length - 1]?.createdAt;
      return { type: 'activities', subType: isCommunityCategory ? 'community' : 'location', cursorValue: cursor, pageIndex };
    }

    if (isHighlightsCategory) {
      const cursor = pageIndex === 0 ? null : previousPageData[previousPageData.length - 1]?.upvotes;
      return { type: 'highlights', cursorValue: cursor, pageIndex };
    }

    if (!userLocation) return null;
    let categoriesToFetch: string[] = (activeCategory.length === 0 || activeCategory.includes('has_activities')) 
      ? ["tourism", "entertainment", "heritage"] 
      : activeCategory;

    const offset = pageIndex * PLACES_PER_PAGE;
    const radiusMeters = 15000;
    const url = `https://api.geoapify.com/v2/places?categories=${categoriesToFetch.join(',')}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=${PLACES_PER_PAGE}&offset=${offset}&conditions=named&exclude=${GLOBAL_EXCLUDE_STRING}&apiKey=${GEOAPIFY_API_KEY}`;
    
    return { type: 'geoapify', url, pageIndex };
  }

  const { data, size, setSize, isValidating, error } = useSWRInfinite(getKey, multiFetcher, {
    revalidateFirstPage: false,
    dedupingInterval: 60000,
  });

  const isLoadingInitialData = !data && !error;
  const isEmpty = data?.[0]?.features ? data[0].features.length === 0 : (data?.[0]?.length === 0);
  const isFetchingNextPage = Boolean(size > 0 && data && typeof data[size - 1] === "undefined");
  
  const isReachingEnd = useMemo(() => {
    if (isEmpty) return true;
    if (!data || data.length === 0) return false;
    const lastPage = data[data.length - 1];
    if (isCommunityCategory || isAktivCategory || isHighlightsCategory) {
      return Boolean(lastPage && lastPage.length < PLACES_PER_PAGE);
    }
    return Boolean(lastPage && lastPage.features?.length < PLACES_PER_PAGE);
  }, [data, isEmpty, isCommunityCategory, isAktivCategory, isHighlightsCategory]);

  const userPrefs: UserPreferences = useMemo(() => ({
    likedTags: userProfile?.likedTags || [],
    dislikedTags: userProfile?.dislikedTags || []
  }), [userProfile]);

  const places = useMemo(() => {
    if (!data || isCommunityCategory || isAktivCategory || isFavoritesCategory) return [];
    if (isHighlightsCategory) return data.flat() as Place[];

    return data.flatMap(page => {
      const features = page?.features || [];
      return features.map((feature: GeoapifyFeature) => {
        const props = feature.properties;
        let rating;
        if (props.datasource?.raw?.rating) {
          const parsedRating = parseFloat(props.datasource.raw.rating);
          if (!isNaN(parsedRating)) rating = Math.max(0, Math.min(5, parsedRating));
        }
        const cats = Array.isArray(props.categories) ? props.categories : [props.categories];
        const distance = props.distance || 0;
        return {
          id: props.place_id,
          name: props.name || props.address_line1 || "Unbekannter Ort",
          address: props.address_line2 || "Keine Adresse verfügbar",
          categories: cats,
          lat: props.lat,
          lon: props.lon,
          rating: rating,
          distance: distance,
          relevanceScore: calculateRelevanceScore(cats, distance, userPrefs),
        } as Place;
      });
    });
  }, [data, userPrefs, isCommunityCategory, isAktivCategory, isHighlightsCategory, isFavoritesCategory]);

  const observer = useRef<IntersectionObserver>();
  const lastElementRef = useCallback(node => {
    if (observer.current) observer.current.disconnect();
    const options = { rootMargin: '0px 0px -50px 0px', threshold: 1.0 };
    observer.current = new IntersectionObserver(entries => { 
      const target = entries[0];
      if (target.isIntersecting) {
        if (!isReachingEnd && !isFetchingNextPage && !isValidating) {
          setTimeout(() => { setSize(prev => prev + 1); }, 500);
        }
      }
    }, options);
    if (node) observer.current.observe(node);
  }, [isFetchingNextPage, isReachingEnd, isValidating, setSize]);

  useEffect(() => {
    const reverseGeocode = async (lat: number, lng: number) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        setCityName(data.address.city || data.address.town || data.address.village || "Unbekannter Ort");
      } catch (error) { setCityName("Unbekannter Ort"); }
    };
    if (planningState.isPlanning && planningState.destination) {
      setUserLocation(planningState.destination);
      setCityName(planningState.destination.name);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(location);
          if (location.lat && location.lng) reverseGeocode(location.lat, location.lng);
        }, () => {
          setUserLocation({ lat: 53.5395, lng: 8.5809 });
          setCityName("Bremerhaven");
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setUserLocation({ lat: 53.5395, lng: 8.5809 });
      setCityName("Bremerhaven");
    }
  }, [planningState]);

  const handleCategoryChange = (categoryId: string[], tabId: string) => {
    setSearchQuery('');
    setActiveCategory(categoryId);
    setActiveTabId(tabId);
    setSortBy('recommended');
    setMaxDistance(null); 
    setActivityCategoryFilter('Alle'); // Reset activity filter on main category change
  };

  const handlePlaceSelect = (place: Place) => setSelectedPlace(place);
  const handleDialogClose = () => setSelectedPlace(null);
  const handleOpenActivityModal = (place: Place) => { if (!user) { router.push('/login'); return; } setActivityModalPlace(place); };
  const handleOpenCustomActivityModal = () => { if (!user) { router.push('/login'); return; } setActivityModalPlace('custom'); };

  const handleCreateActivity = async (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number, isBoosted?: boolean, isPaid?: boolean, price?: number, category?: ActivityCategory): Promise<boolean> => {
    if (!user) return false;
    try {
      const isCustom = activityModalPlace === 'custom';
      const payload = isCustom 
        ? { customLocationName: customLocationName!, startDate, endDate, user, isTimeFlexible, maxParticipants, isBoosted, isPaid, price, category: category! } 
        : { place: activityModalPlace as Place, startDate, endDate, user, isTimeFlexible, maxParticipants, isBoosted, isPaid, price, category: category! };
      const newActivityRef = await createActivity(payload);
      setActivityModalPlace(null);
      router.push(`/chat/${newActivityRef.id}`);
      return true;
    } catch (error: any) { return false; }
  };

  const handleJoin = async (activityId: string) => {
    if (!user) { router.push('/login'); throw new Error('Login Required'); }
    try {
        await joinActivity(activityId, user);
        router.push(`/chat/${activityId}`);
    } catch (error: any) { throw error; }
  };

  const handleMapToggle = () => {
    if (!userProfile?.isPremium) {
      setIsPremiumUpsellOpen(true);
      return;
    }
    setViewMode('map');
  };

  const renderContent = () => {
    if (isLoadingInitialData) {
      return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
    }
    if (!userLocation && !isLoadingInitialData) {
      return <div className="flex h-full w-full items-center justify-center"><div className="flex flex-col items-center gap-2 text-muted-foreground"><MapPin className="h-8 w-8 animate-bounce text-primary" /><p className="font-bold text-sm">Standort wird ermittelt...</p></div></div>;
    }
    if (error) return <div className="flex h-full w-full items-center justify-center p-6 text-center text-destructive font-bold">Verbindungsproblem.</div>;

    const EmptySearchState = () => (
        <div className="flex h-full w-full items-center justify-center p-6 text-center">
            <div className="space-y-4">
                <h3 className="font-black text-xl text-[#0f172a] dark:text-neutral-200">Keine Ergebnisse</h3>
                <p className="text-[#64748b] dark:text-neutral-400 font-medium">Passe deine Suche oder die Filter an.</p>
                <Button onClick={() => { handleCategoryChange([], ''); setMaxDistance(null); setActivityCategoryFilter('Alle'); }} variant="outline" className="rounded-xl font-bold">Filter zurücksetzen</Button>
            </div>
        </div>
    );

    if (viewMode === 'list') {
        const renderList = () => {
            if (isFavoritesCategory) {
                if (favorites.length === 0) {
                     return <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center h-full"><div className="bg-primary/10 p-6 rounded-3xl"><Bookmark className="h-12 w-12 text-primary" /></div><h2 className="text-xl font-black text-[#0f172a] dark:text-neutral-200">Noch keine Favoriten</h2></div>;
                }
                return (
                  <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {favorites.map(place => (
                      <div key={place.id} className="min-h-[180px] w-full">
                        <PlaceCard place={place as Place} onClick={() => handlePlaceSelect(place as Place)} onAddActivity={() => handleOpenActivityModal(place as Place)} />
                      </div>
                    ))}
                  </div>
                );
            }

            if (isCommunityCategory || isAktivCategory) {
                const list = data?.flat() || [];
                
                // --- ARCHITEKTUR UPDATE: FEED FILTER FÜR AKTIVE & SICHERE ENTITÄTEN ---
                const safeActivities = list.filter((item: any) => {
                  if (!item) return false;
                  return item.status !== 'completed' && 
                         item.status !== 'cancelled' &&
                         (item.reportCount || 0) < QUARANTINE_THRESHOLD;
                });

                // --- MODUL 12: SEMANTISCHE FILTERUNG ---
                let semanticFiltered = safeActivities;
                if (activityCategoryFilter !== 'Alle') {
                  semanticFiltered = semanticFiltered.filter((item: any) => item.category === activityCategoryFilter);
                }

                // --- MODUL 6: GEODATEN INJEKTION & DISTANZ-FILTER ---
                const listWithDistance = semanticFiltered.map((item: any) => {
                  const distance = (userLocation && item.lat && item.lon)
                    ? calculateDistance(userLocation.lat, userLocation.lng, item.lat, item.lon)
                    : null;
                  return { ...item, distance };
                });

                let filtered = listWithDistance.filter(item => {
                    const name = item.placeName || "";
                    return name.toLowerCase().includes(searchQuery.toLowerCase());
                });
                
                if (maxDistance !== null) {
                  filtered = filtered.filter(item => item.distance !== null && item.distance <= maxDistance);
                }

                // Client-Side Sortierung: 1. Booster, 2. Distanz (Modul 6), 3. Erstellungsdatum
                const sortedList = [...filtered].sort((a, b) => {
                  if (a.isBoosted && !b.isBoosted) return -1;
                  if (!a.isBoosted && b.isBoosted) return 1;
                  
                  if (a.distance !== null && b.distance !== null) {
                    return a.distance - b.distance;
                  }
                  
                  const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                  const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                  return timeB - timeA;
                });

                if (sortedList.length === 0 && !isFetchingNextPage) return <EmptySearchState />;
                return (
                  <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedList.map((item) => (
                      <div key={item.id} className="min-h-[180px] w-full">
                        {isCommunityCategory ? (
                          <ActivityListItem activity={item as any} user={user} onJoin={handleJoin} />
                        ) : (
                          <PlaceCard 
                            place={{
                              id: item.placeId || "unknown",
                              name: item.placeName || "Unbekannter Ort",
                              address: item.placeAddress || "Keine Adresse",
                              categories: item.categories || [],
                              lat: item.lat || 0,
                              lon: item.lon || 0,
                              activityCount: 1,
                              distance: item.distance ? item.distance * 1000 : undefined 
                            } as Place}
                            onClick={() => handlePlaceSelect(item as any)} 
                            onAddActivity={() => handleOpenActivityModal(item as any)} 
                          />
                        )}
                      </div>
                    ))}
                  </div>
                );
            }
            
            const filtered = places.filter(place => {
                const name = place.name || "";
                return name.toLowerCase().includes(searchQuery.toLowerCase());
            });
            const sorted = filtered.sort((a, b) => (sortBy === 'recommended' ? (b.relevanceScore || 0) - (a.relevanceScore || 0) : (sortBy === 'rating' ? (b.rating || 0) - (a.rating || 0) : 0)));
            if (sorted.length === 0 && !isFetchingNextPage) return <EmptySearchState />;
            
            return (
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sorted.map((place) => (
                  <div key={place.id} className="min-h-[180px] w-full">
                    <PlaceCard place={place} onClick={() => handlePlaceSelect(place)} onAddActivity={() => handleOpenActivityModal(place)} />
                  </div>
                ))}
              </div>
            );
        };

        return (
          <div className="max-w-7xl mx-auto w-full min-h-[100vh] flex flex-col">
            {renderList()}
            {isFetchingNextPage && !isReachingEnd && (
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <CardSkeleton />
              </div>
            )}
            {!isReachingEnd && !isLoadingInitialData && (
              <div ref={lastElementRef} className="h-1 w-full flex-shrink-0 bg-transparent" aria-hidden="true" />
            )}
          </div>
        );
    }

    if (viewMode === 'map') {
        if (!userLocation) return <div className="flex h-full w-full items-center justify-center"><MapPin className="h-8 w-8 animate-bounce text-primary" /></div>;
        if (!userProfile?.isPremium) {
            return (
              <div className="flex flex-col items-center justify-center p-10 h-[calc(100%-80px)] text-center space-y-6">
                <div className="bg-white dark:bg-neutral-800 p-8 rounded-full shadow-xl relative">
                  <Lock className="h-12 w-12 text-neutral-400" />
                </div>
                <h2 className="text-2xl font-black text-[#0f172a] dark:text-neutral-200">Kartenansicht gesperrt</h2>
                <Button onClick={() => setIsPremiumUpsellOpen(true)} className="rounded-2xl px-10 h-14 font-black">
                  Premium freischalten
                </Button>
              </div>
            );
        }
        return <MapView places={places} userLocation={userLocation} onPlaceSelect={handlePlaceSelect} />;
    }
  };

  return (
    <>
      <div className="flex h-full w-full flex-col bg-secondary/30">
        <header className="flex-none w-full border-b border-neutral-100 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/90 backdrop-blur-md z-20">
          <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 max-w-7xl mx-auto w-full">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className={cn(
                    "h-12 w-12 border-2",
                    userProfile?.isPremium ? "border-amber-400" : (userProfile?.isSupporter ? "border-pink-400" : "border-primary/20")
                  )}>
                    <AvatarImage src={userProfile?.photoURL || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {userProfile?.displayName?.charAt(0) || 'E'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-xl font-black tracking-tight text-[#0f172a] dark:text-neutral-200">
                        Hey {userProfile?.displayName?.split(' ')[0] || 'Entdecker'} 👋
                      </h1>
                      <UserBadge isPremium={userProfile?.isPremium} isSupporter={userProfile?.isSupporter} size="sm" />
                    </div>
                    <button onClick={() => setIsLocationSearchOpen(true)} className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 font-bold text-xs uppercase tracking-wide">
                      <MapPin className="h-3 w-3" />
                      <span>{cityName}</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                    <NotificationBell />
                    <div className="flex items-center gap-1 rounded-2xl bg-neutral-50 dark:bg-neutral-800 p-1">
                        <Button 
                          variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                          size="icon" 
                          className={cn("h-9 w-9 rounded-xl", viewMode === 'list' ? "bg-white dark:bg-neutral-700 text-primary shadow-sm" : "text-neutral-500")} 
                          onClick={() => setViewMode('list')}
                        >
                          <List className="h-5 w-5" />
                        </Button>
                        <Button 
                          variant={viewMode === 'map' ? 'secondary' : 'ghost'} 
                          size="icon" 
                          className={cn("h-9 w-9 rounded-xl relative", viewMode === 'map' ? "bg-white dark:bg-neutral-700 text-primary shadow-sm" : "text-neutral-500")} 
                          onClick={handleMapToggle}
                        >
                          <MapIcon className="h-5 w-5" />
                          {!userProfile?.isPremium && <Lock className="absolute -top-1 -right-1 h-3 w-3 text-amber-500 fill-amber-500" />}
                        </Button>
                    </div>
                    <Button variant="default" size="icon" className="h-10 w-10 rounded-2xl shadow-lg shadow-primary/20" onClick={handleOpenCustomActivityModal}><Plus className="h-6 w-6" strokeWidth={3} /></Button>
                </div>
            </div>
            
            <CategoryFilters activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
            
            {/* --- MODUL 12: AKTIVITÄTS-KATEGORIEN FILTER --- */}
            {(isAktivCategory || isCommunityCategory) && (
              <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar">
                {ACTIVITY_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActivityCategoryFilter(cat)}
                    className={cn(
                      "flex-shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                      activityCategoryFilter === cat
                        ? "bg-slate-900 text-white shadow-md"
                        : "bg-white dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border border-slate-100 dark:border-neutral-700 hover:bg-slate-50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* --- MODUL 6: DISTANZ-FILTER CHIPS --- */}
            {(isAktivCategory || isCommunityCategory) && (
              <div className="flex overflow-x-auto gap-2 pb-1 hide-scrollbar">
                {DISTANCE_FILTERS.map((filter) => (
                  <button
                    key={filter.label}
                    onClick={() => setMaxDistance(filter.value)}
                    className={cn(
                      "flex-shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                      maxDistance === filter.value
                        ? "bg-primary text-white shadow-md"
                        : "bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 hover:bg-slate-200"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-1 flex w-full items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                <Input
                    type="search"
                    placeholder="Suchen nach Orten..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-2xl bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 border-none pl-12 h-12 text-sm font-bold dark:placeholder-neutral-500 focus-visible:ring-0"
                />
              </div>
              {!isFavoritesCategory && (
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[140px] rounded-2xl h-12 bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700 border-none focus:ring-0 font-bold text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl font-bold dark:bg-neutral-800 dark:text-neutral-200"><SelectItem value="recommended">Empfohlen</SelectItem><SelectItem value="rating">Bewertung</SelectItem></SelectContent>
                </Select>
              )}
            </div>
          </div>
        </header>
        <div className={`flex-1 w-full pb-24 ${viewMode === 'list' ? 'overflow-y-auto' : 'overflow-hidden'}`}>{renderContent()}</div>
      </div>

      <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="max-h-[95vh] flex flex-col p-0 w-full max-w-4xl gap-0 overflow-hidden rounded-3xl border-none dark:bg-neutral-900">
          <DialogTitle className="sr-only">{selectedPlace?.name || 'Ort Details'}</DialogTitle>
          {selectedPlace && <PlaceDetails place={selectedPlace} onClose={handleDialogClose} />}
        </DialogContent>
      </Dialog>

      <CreateActivityDialog place={activityModalPlace === 'custom' ? null : activityModalPlace} open={!!activityModalPlace} onOpenChange={(open) => !open && setActivityModalPlace(null)} onCreateActivity={handleCreateActivity} />
      <LocationSearchDialog open={isLocationSearchOpen} onOpenChange={setIsLocationSearchOpen} />

      <Dialog open={isPremiumUpsellOpen} onOpenChange={setIsPremiumUpsellOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500" />
          <DialogHeader className="pt-6">
            <div className="mx-auto bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full w-fit mb-4">
              <Crown className="h-10 w-10 text-amber-500" />
            </div>
            <DialogTitle className="text-2xl font-black text-center">Premium-Funktion</DialogTitle>
            <DialogDescription className="text-center text-base font-medium px-2 pt-2">
              Die interaktive Kartenansicht ist ein exklusives Feature für Premium-Mitglieder. Schalte Premium frei, um alle Orte in deiner Umgebung visuell zu entdecken.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500" strokeWidth={3} />
                <span className="font-bold text-sm">Vollständige interaktive Karte</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500" strokeWidth={3} />
                <span className="font-bold text-sm">Keine Werbung mehr</span>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-3 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsPremiumUpsellOpen(false)} className="rounded-xl font-bold h-12">Abbrechen</Button>
            <Button onClick={() => setIsPremiumUpsellOpen(false)} className="rounded-xl font-black h-12 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20">
              Upgrade freischalten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
