
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useToast } from '@/hooks/use-toast';
import { CategoryFilters } from '@/components/aktvia/category-filters';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { PlaceCard } from '@/components/aktvia/place-card';
import type { Place, Activity, GeoapifyFeature, UserPreferences } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { MapPin, Map as MapIcon, List, Plus, Search, Bookmark, RotateCcw, Lock, Sparkles, Check, Loader2, Crown, MessageSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createActivity, joinActivity } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, Timestamp, onSnapshot, orderBy } from "firebase/firestore";
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
import { GLOBAL_EXCLUDE_STRING, BASE_HARD_VETO, BASE_SOFT_VETO, CONDITION_PREFIXES, calculateRelevanceScore } from '@/lib/geoapify';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Dynamic import for MapView to avoid SSR issues
const MapView = dynamic(() => import('@/components/aktvia/map-view').then(mod => mod.MapView), { 
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-muted"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
});

const CardSkeleton = () => (
    <div className="w-full overflow-hidden rounded-3xl bg-white shadow-sm flex flex-row p-0 border border-slate-100/50">
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

const PLACES_PER_PAGE = 50;
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Home() {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activityModalPlace, setActivityModalPlace] = useState<Place | 'custom' | null>(null);
  const [activeCategory, setActiveCategory] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [customActivities, setCustomActivities] = useState<Activity[]>([]);
  const [allUpcomingActivities, setAllUpcomingActivities] = useState<Activity[]>([]);
  const [placeMetrics, setPlaceMetrics] = useState<Record<string, {upvotes: number, downvotes: number}>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [cityName, setCityName] = useState<string>("Wird geladen...");
  const [sortBy, setSortBy] = useState("recommended");
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
  const [isPremiumUpsellOpen, setIsPremiumUpsellOpen] = useState(false);

  // Fixer Suchradius von 15km für bessere Abdeckung
  const searchRadiusKm = 15;

  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { planningState } = usePlanningMode();
  const { favorites } = useFavorites();

  const isCommunityCategory = activeTabId === "Community";
  const isFavoritesCategory = activeTabId === "Favorites";
  const isHighlightsCategory = activeTabId === "Highlights";
  const isAktivCategory = activeTabId === "Aktiv";

  const getKey = (pageIndex: number, previousPageData: any) => {
    if (isCommunityCategory || isFavoritesCategory) return null;
    if (!userLocation) return null;
    if (previousPageData && (!previousPageData.features || previousPageData.features.length === 0)) return null;

    // Wenn kein Filter aktiv ist oder der "Aktiv" Filter (frontend-filtering) gewählt wurde, 
    // laden wir ein Standard-Set an Orten.
    let categoriesToFetch: string[] = (activeCategory.length === 0 || activeCategory.includes('has_activities')) 
      ? ["tourism", "entertainment", "heritage"] 
      : activeCategory;

    const offset = pageIndex * PLACES_PER_PAGE;
    const radiusMeters = searchRadiusKm * 1000;
    
    return `https://api.geoapify.com/v2/places?categories=${categoriesToFetch.join(',')}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=${PLACES_PER_PAGE}&offset=${offset}&conditions=named&exclude=${GLOBAL_EXCLUDE_STRING}&apiKey=${GEOAPIFY_API_KEY}`;
  }

  const { data, size, setSize, isLoading, isValidating, error } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
    dedupingInterval: 60000,
  });

  const userPrefs: UserPreferences = useMemo(() => ({
    likedTags: userProfile?.likedTags || [],
    dislikedTags: userProfile?.dislikedTags || []
  }), [userProfile]);

  const rawPlaces = useMemo(() => {
    if (!data) return [];
    const combinedSoftVetoList = [...BASE_SOFT_VETO];
    
    const mapped = data.flatMap(page => {
      const features = page.features || [];
      const safeFeatures = features.filter((feature: any) => {
        const isStolperstein = feature.properties?.datasource?.raw?.memorial === 'stolperstein';
        if (isStolperstein) return false;

        const allTags: string[] = Array.isArray(feature.properties?.categories) ? feature.properties.categories : [feature.properties?.categories];
        const violatesHardVeto = allTags.some(tag => BASE_HARD_VETO.some(veto => tag === veto || tag.startsWith(`${veto}.`)));
        if (violatesHardVeto) return false;
        
        const coreTags = allTags.filter(tag => !CONDITION_PREFIXES.some(prefix => tag === prefix || tag.startsWith(`${prefix}.`)) && (!tag.startsWith("building") || combinedSoftVetoList.includes(tag)));
        const specificCoreTags = coreTags.filter(tag => !coreTags.some(otherTag => otherTag !== tag && otherTag.startsWith(`${tag}.`)));
        if (specificCoreTags.length > 0) {
          const isSolelyExcludedIdentity = specificCoreTags.every(specificTag => combinedSoftVetoList.includes(specificTag));
          if (isSolelyExcludedIdentity) return false;
        }
        return true; 
      });
      return safeFeatures.map((feature: GeoapifyFeature) => {
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
          name: props.name || props.address_line1,
          address: props.address_line2,
          categories: cats,
          lat: props.lat,
          lon: props.lon,
          rating: rating,
          distance: distance,
          relevanceScore: calculateRelevanceScore(cats, distance, userPrefs),
        } as Place;
      });
    });

    const nsfwBlacklist = ['sex', 'erotik', 'porn', 'strip', 'swinger', 'bordell', 'peep'];
    return mapped.filter(place => {
      const placeName = (place.name || '').toLowerCase();
      return !nsfwBlacklist.some(term => placeName.includes(term));
    });
  }, [data, userPrefs]);
  
  const places = useMemo(() => {
    return rawPlaces.map(p => ({
        ...p,
        upvotes: placeMetrics[p.id]?.upvotes || 0,
        downvotes: placeMetrics[p.id]?.downvotes || 0,
        activityCount: allUpcomingActivities.filter(a => a.placeId === p.id).length
    }));
  }, [rawPlaces, allUpcomingActivities, placeMetrics]);

  const isLoadingInitialData = isLoading;
  // Nur anzeigen, wenn wir wirklich aktiv eine neue Seite laden (SWR Infinite Pattern)
  const isFetchingMore = size > 0 && data && typeof data[size - 1] === 'undefined';
  const isEmpty = !data || data.length === 0 || !(data[0]?.features?.length > 0);
  const hasMore = !isEmpty && data && (data[data.length - 1]?.features?.length === PLACES_PER_PAGE);

  const resetFilters = () => {
    handleCategoryChange([], '');
    setSearchQuery('');
    setSortBy('recommended');
  };

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
  
  // Echtzeit-Überwachung der Aktivitäten mit Query-Splitting
  useEffect(() => {
    if (!db) return;

    try {
        const collectionRef = collection(db, "activities");
        const constraints: any[] = [];

        // PFAD-SPLITTING: Wir verzichten auf orderBy in der DB, um zusammengesetzte Indizes zu vermeiden.
        if (isCommunityCategory) {
            constraints.push(where('isCustomActivity', '==', true));
        } else {
            constraints.push(where('status', '==', 'active'));
        }

        const activitiesQuery = query(collectionRef, ...constraints);
        
        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Activity[];
            
            // Clientseitige Sortierung nach activityDate (ASC), um fehlende Indizes zu vermeiden
            activitiesData.sort((a, b) => {
                const timeA = a.activityDate?.toMillis() || 0;
                const timeB = b.activityDate?.toMillis() || 0;
                return timeA - timeB;
            });

            setAllUpcomingActivities(activitiesData);
        }, (error) => {
            // Aggressives Error-Logging für Index-Tracing
            console.error("CRITICAL FIRESTORE ERROR (Check for Index links):", error.message);
        });

        return () => unsubscribe();
    } catch (err: any) {
        console.error("Activities dynamic listener setup failed:", err.message);
    }
  }, [isCommunityCategory, isAktivCategory]);

  useEffect(() => {
    if (!db || rawPlaces.length === 0) return;
    const fetchMetrics = async () => {
        const newMetrics: Record<string, any> = {};
        const ids = rawPlaces.map(p => p.id);
        for (let i = 0; i < ids.length; i += 30) {
            const chunk = ids.slice(i, i + 30);
            const q = query(collection(db, 'places'), where('__name__', 'in', chunk));
            const snap = await getDocs(q);
            snap.forEach(doc => { newMetrics[doc.id] = doc.data(); });
        }
        setPlaceMetrics(prev => ({...prev, ...newMetrics}));
    };
    fetchMetrics();
  }, [rawPlaces]);

  useEffect(() => { if (isCommunityCategory) setCustomActivities(allUpcomingActivities.filter(act => act.isCustomActivity)); }, [isCommunityCategory, allUpcomingActivities]);

  const observer = useRef<IntersectionObserver>();
  const lastElementRef = useCallback(node => {
    if (isFetchingMore || !hasMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => { if (entries[0].isIntersecting && hasMore) setSize(size + 1); });
    if (node) observer.current.observe(node);
  }, [isFetchingMore, hasMore, setSize, size]);

  const handleCategoryChange = (categoryId: string[], tabId: string) => {
    setSearchQuery('');
    setActiveCategory(categoryId);
    setActiveTabId(tabId);
    setSortBy('recommended');
  };

  const handlePlaceSelect = (place: Place) => setSelectedPlace(place);
  const handleDialogClose = () => setSelectedPlace(null);
  const handleOpenActivityModal = (place: Place) => { if (!user) { router.push('/login'); return; } setActivityModalPlace(place); };
  const handleOpenCustomActivityModal = () => { if (!user) { router.push('/login'); return; } setActivityModalPlace('custom'); };

  const handleCreateActivity = async (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number, isBoosted?: boolean): Promise<boolean> => {
    if (!user) return false;
    try {
      const isCustom = activityModalPlace === 'custom';
      const payload = isCustom ? { customLocationName: customLocationName!, startDate, endDate, user, isTimeFlexible, maxParticipants, isBoosted } : { place: activityModalPlace as Place, startDate, endDate, user, isTimeFlexible, maxParticipants, isBoosted };
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
                <Button onClick={resetFilters} variant="outline" className="rounded-xl font-bold">Filter zurücksetzen</Button>
            </div>
        </div>
    );

    if (viewMode === 'list') {
        const renderList = () => {
            if (isFavoritesCategory) {
                if (favorites.length === 0) {
                     return <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center h-full"><div className="bg-primary/10 p-6 rounded-3xl"><Bookmark className="h-12 w-12 text-primary" /></div><h2 className="text-xl font-black text-[#0f172a] dark:text-neutral-200">Noch keine Favoriten</h2></div>;
                }
                return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{favorites.map(place => <PlaceCard key={place.id} place={place as Place} onClick={() => handlePlaceSelect(place as Place)} onAddActivity={() => handleOpenActivityModal(place as Place)} />)}</div>;
            }
            if (isCommunityCategory) {
                const filtered = customActivities.filter(act => act.placeName.toLowerCase().includes(searchQuery.toLowerCase()));
                const sorted = filtered.sort((a, b) => (a.isBoosted && !b.isBoosted ? -1 : (!a.isBoosted && b.isBoosted ? 1 : (sortBy === 'newest' ? (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0) : 0))));
                if (sorted.length === 0) return searchQuery ? <EmptySearchState /> : <div className="flex h-full w-full items-center justify-center p-10 text-center font-bold text-[#64748b] dark:text-neutral-400">Keine Community-Aktivitäten.</div>;
                return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{sorted.map((activity) => <ActivityListItem key={activity.id} activity={activity} user={user} onJoin={handleJoin} />)}</div>;
            }
            
            if (isAktivCategory) {
                const filtered = places.filter(place => (place.activityCount || 0) > 0 && place.name.toLowerCase().includes(searchQuery.toLowerCase()));
                const sorted = filtered.sort((a, b) => (sortBy === 'recommended' ? (b.relevanceScore || 0) - (a.relevanceScore || 0) : (sortBy === 'rating' ? (b.rating || 0) - (a.rating || 0) : (sortBy === 'popular' ? (b.activityCount || 0) - (a.activityCount || 0) : 0))));
                if (sorted.length === 0 && !isFetchingMore) {
                    return (
                        <div className="flex h-full w-full items-center justify-center p-10 text-center">
                            <div className="space-y-4">
                                <div className="bg-primary/10 p-6 rounded-3xl inline-block"><MessageSquare className="h-12 w-12 text-primary" /></div>
                                <h3 className="font-black text-xl text-[#0f172a] dark:text-neutral-200">Keine aktiven Räume</h3>
                                <p className="text-[#64748b] dark:text-neutral-400 font-medium max-w-xs mx-auto">Hier erscheinen Orte, an denen bereits Aktivitäten geplant sind.</p>
                            </div>
                        </div>
                    );
                }
                return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{sorted.map((place, index) => <div ref={index === sorted.length - 1 ? lastElementRef : null} key={place.id}><PlaceCard place={place} onClick={() => handlePlaceSelect(place)} onAddActivity={() => handleOpenActivityModal(place)} /></div>)}</div>;
            }

            if (isHighlightsCategory) {
                const filtered = places.filter(place => {
                    const up = place.upvotes || 0;
                    const down = place.downvotes || 0;
                    const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase());
                    return up >= 1 && up > down && matchesSearch;
                });
                const sorted = filtered.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
                if (sorted.length === 0 && !isFetchingMore) {
                    return (
                        <div className="flex h-full w-full items-center justify-center p-10 text-center">
                            <div className="space-y-4">
                                <div className="bg-primary/10 p-6 rounded-3xl inline-block"><Sparkles className="h-12 w-12 text-primary" /></div>
                                <h3 className="font-black text-xl text-[#0f172a] dark:text-neutral-200">Keine Highlights</h3>
                                <p className="text-[#64748b] dark:text-neutral-400 font-medium max-w-xs mx-auto">Votings der Community bestimmen, was hier erscheint.</p>
                            </div>
                        </div>
                    );
                }
                return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{sorted.map((place, index) => <div ref={index === sorted.length - 1 ? lastElementRef : null} key={place.id}><PlaceCard place={place} onClick={() => handlePlaceSelect(place)} onAddActivity={() => handleOpenActivityModal(place)} /></div>)}</div>;
            } else {
                const filtered = places.filter(place => place.name.toLowerCase().includes(searchQuery.toLowerCase()));
                const sorted = filtered.sort((a, b) => (sortBy === 'recommended' ? (b.relevanceScore || 0) - (a.relevanceScore || 0) : (sortBy === 'rating' ? (b.rating || 0) - (a.rating || 0) : (sortBy === 'popular' ? (b.activityCount || 0) - (a.activityCount || 0) : 0))));
                if (sorted.length === 0 && !isFetchingMore) return <EmptySearchState />;
                return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{sorted.map((place, index) => <div ref={index === sorted.length - 1 ? lastElementRef : null} key={place.id}><PlaceCard place={place} onClick={() => handlePlaceSelect(place)} onAddActivity={() => handleOpenActivityModal(place)} /></div>)}</div>;
            }
        };
        return <div className="max-w-7xl mx-auto w-full">{renderList()}{isFetchingMore && <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><CardSkeleton /></div>}</div>;
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
        const placesForMap = isFavoritesCategory 
            ? (favorites as Place[]) 
            : (isAktivCategory 
                ? places.filter(place => (place.activityCount || 0) > 0 && place.name.toLowerCase().includes(searchQuery.toLowerCase()))
                : places.filter(place => place.name.toLowerCase().includes(searchQuery.toLowerCase())));
        return <MapView places={placesForMap} userLocation={userLocation} onPlaceSelect={handlePlaceSelect} />;
    }
  };

  return (
    <>
      <div className="flex h-full w-full flex-col bg-secondary/30">
        <header className="flex-none w-full border-b border-neutral-100 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/90 backdrop-blur-md z-20">
          <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 max-w-7xl mx-auto w-full">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    <AvatarImage src={userProfile?.photoURL || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {userProfile?.displayName?.charAt(0) || 'E'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-[#0f172a] dark:text-neutral-200">
                      Hey {userProfile?.displayName?.split(' ')[0] || 'Entdecker'} 👋
                    </h1>
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
            
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 -mt-1">
              Was möchtest du heute in {cityName} erleben?
            </p>

            <CategoryFilters activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
            
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
                    <SelectContent className="rounded-2xl border-none shadow-2xl font-bold dark:bg-neutral-800 dark:text-neutral-200"><SelectItem value="recommended">Empfohlen</SelectItem><SelectItem value="rating">Bewertung</SelectItem><SelectItem value="popular">Beliebt</SelectItem><SelectItem value="newest">Neueste</SelectItem></SelectContent>
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

      {/* Premium Upsell Dialog */}
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
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500" strokeWidth={3} />
                <span className="font-bold text-sm">Eigene Akzentfarben wählen</span>
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
