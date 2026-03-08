'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CategoryFilters } from '@/components/aktvia/category-filters';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { PlaceCard } from '@/components/aktvia/place-card';
import type { Place, Activity, GeoapifyFeature, UserPreferences } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { MapPin, Map as MapIcon, List, Plus, Search, Bookmark, RotateCcw, Lock, Sparkles, Check } from 'lucide-react';
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
import { GLOBAL_EXCLUDE_STRING, BASE_HARD_VETO, BASE_SOFT_VETO, CONDITION_PREFIXES, calculateRelevanceScore } from '@/lib/geoapify';
import { cn } from '@/lib/utils';

const CardSkeleton = () => (
    <div className="w-full overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-sm p-4">
        <div className="flex gap-4">
          <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-2 py-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
          </div>
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
  const [activeTabId, setActiveTabId] = useState<string>("All");
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [customActivities, setCustomActivities] = useState<Activity[]>([]);
  const [allUpcomingActivities, setAllUpcomingActivities] = useState<Activity[]>([]);
  const [placeMetrics, setPlaceMetrics] = useState<Record<string, {upvotes: number, downvotes: number}>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [cityName, setCityName] = useState<string>("Locating...");
  const [sortBy, setSortBy] = useState("recommended");
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
  const [searchRadiusKm, setSearchRadiusKm] = useState<number>(5);
  const [isPremiumUpsellOpen, setIsPremiumUpsellOpen] = useState(false);

  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { planningState } = usePlanningMode();
  const { favorites } = useFavorites();

  const isCommunityCategory = activeTabId === "Community";
  const isFavoritesCategory = activeTabId === "Favorites";
  const isHighlightsCategory = activeTabId === "Highlights";

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
        const isSponsored = cats.some(c => c.includes('office.coworking') || c.includes('rental.'));
        const distance = props.distance || 0;
        const relevanceScore = calculateRelevanceScore(cats, distance, userPrefs);
        return {
          id: props.place_id,
          name: props.name || props.address_line1,
          address: props.address_line2,
          categories: cats,
          lat: props.lat,
          lon: props.lon,
          rating: rating,
          distance: distance,
          relevanceScore: relevanceScore,
          isSponsored: isSponsored,
          affiliateUrl: isSponsored ? 'https://example.com/booking?ref=aktvia' : undefined
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
  const isFetchingMore = isValidating && !isLoadingInitialData;
  const isEmpty = !data || data.length === 0 || !(data[0]?.features?.length > 0);
  const hasMore = !isEmpty && data && (data[data.length - 1]?.features?.length === PLACES_PER_PAGE);

  const resetFilters = () => {
    handleCategoryChange(['all'], 'All');
    setSearchQuery('');
    setSortBy('recommended');
    setSearchRadiusKm(5);
  };

  useEffect(() => {
    const reverseGeocode = async (lat: number, lng: number) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        setCityName(data.address.city || data.address.town || data.address.village || "Unknown location");
      } catch (error) { setCityName("Unknown location"); }
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
          setUserLocation({ lat: 53.5451, lng: 8.5746 });
          setCityName("Bremerhaven");
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setUserLocation({ lat: 53.5451, lng: 8.5746 });
      setCityName("Bremerhaven");
    }
  }, [planningState]);
  
  useEffect(() => {
    const fetchAllUpcomingActivities = async () => {
        if (!db) return;
        const activitiesQuery = query(collection(db, "activities"), where("activityDate", ">=", Timestamp.now()));
        const querySnapshot = await getDocs(activitiesQuery);
        const activitiesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Activity[];
        setAllUpcomingActivities(activitiesData);
    };
    fetchAllUpcomingActivities();
  }, []);

  useEffect(() => {
    if (!db || rawPlaces.length === 0) return;
    
    const fetchMetrics = async () => {
        const newMetrics: Record<string, any> = {};
        const ids = rawPlaces.map(p => p.id);
        
        for (let i = 0; i < ids.length; i += 30) {
            const chunk = ids.slice(i, i + 30);
            const q = query(collection(db, 'places'), where('__name__', 'in', chunk));
            const snap = await getDocs(q);
            snap.forEach(doc => {
                newMetrics[doc.id] = doc.data();
            });
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
      if (isCustom && !customLocationName?.trim()) return false;
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

  const renderContent = () => {
    if (isLoadingInitialData) {
      return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
    }
    if (!userLocation && !isLoadingInitialData) {
      return <div className="flex h-full w-full items-center justify-center"><div className="flex flex-col items-center gap-2 text-muted-foreground"><MapPin className="h-8 w-8 animate-bounce text-primary" /><p className="font-bold text-sm">Standort wird ermittelt...</p></div></div>;
    }
    if (error) return <div className="flex h-full w-full items-center justify-center p-6 text-center text-destructive font-bold">Verbindungsproblem. Bitte später erneut versuchen.</div>;

    const EmptySearchState = () => (
        <div className="flex h-full w-full items-center justify-center p-6 text-center">
            <div className="space-y-4">
                <h3 className="font-black text-xl text-[#0f172a] dark:text-slate-100">Keine Ergebnisse</h3>
                <p className="text-[#64748b] dark:text-slate-400 font-medium">Passe deine Suche oder die Filter an.</p>
                <Button onClick={resetFilters} variant="outline" className="rounded-xl font-bold">Filter zurücksetzen</Button>
            </div>
        </div>
    );

    if (viewMode === 'list') {
        const renderList = () => {
            if (isFavoritesCategory) {
                if (favorites.length === 0) {
                     return <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center h-full"><div className="bg-primary/10 p-6 rounded-3xl"><Bookmark className="h-12 w-12 text-primary" /></div><h2 className="text-xl font-black text-[#0f172a] dark:text-slate-100">Noch keine Favoriten</h2><p className="text-[#64748b] dark:text-slate-400 font-medium max-w-xs">Speichere Orte mit dem Lesezeichen-Symbol, um sie hier zu sehen.</p></div>;
                }
                return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{favorites.map(place => <PlaceCard key={place.id} place={place as Place} onClick={() => handlePlaceSelect(place as Place)} onAddActivity={() => handleOpenActivityModal(place as Place)} />)}</div>;
            }
            if (isCommunityCategory) {
                const filtered = customActivities.filter(act => act.placeName.toLowerCase().includes(searchQuery.toLowerCase()));
                const sorted = filtered.sort((a, b) => (a.isBoosted && !b.isBoosted ? -1 : (!a.isBoosted && b.isBoosted ? 1 : (sortBy === 'newest' ? (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0) : 0))));
                const visible = sorted.filter(act => !userProfile?.hiddenEntityIds?.includes(act.id!));
                if (visible.length === 0) return searchQuery ? <EmptySearchState /> : <div className="flex h-full w-full items-center justify-center p-10 text-center font-bold text-[#64748b] dark:text-slate-400">Keine Community-Aktivitäten gefunden.</div>;
                return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{visible.map((activity) => <ActivityListItem key={activity.id} activity={activity} user={user} onJoin={handleJoin} />)}</div>;
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
                                <div className="bg-primary/10 p-6 rounded-3xl inline-block">
                                    <Sparkles className="h-12 w-12 text-primary" />
                                </div>
                                <h3 className="font-black text-xl text-[#0f172a] dark:text-slate-100">Keine Highlights</h3>
                                <p className="text-[#64748b] dark:text-slate-400 font-medium max-w-xs mx-auto">Votings der Community bestimmen, was hier erscheint. Aktuell gibt es keine Orte mit positiver Bilanz.</p>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sorted.map((place, index) => (
                            <div ref={index === sorted.length - 1 ? lastElementRef : null} key={place.id}>
                                <PlaceCard place={place} onClick={() => handlePlaceSelect(place)} onAddActivity={() => handleOpenActivityModal(place)} />
                            </div>
                        ))}
                    </div>
                );
            } else {
                const filtered = places.filter(place => place.name.toLowerCase().includes(searchQuery.toLowerCase()));
                const sorted = filtered.sort((a, b) => (a.isSponsored && !b.isSponsored ? -1 : (!a.isSponsored && b.isSponsored ? 1 : (sortBy === 'recommended' ? (b.relevanceScore || 0) - (a.relevanceScore || 0) : (sortBy === 'rating' ? (b.rating || 0) - (a.rating || 0) : (sortBy === 'popular' ? (b.activityCount || 0) - (a.activityCount || 0) : 0))))));
                if (sorted.length === 0 && !isFetchingMore) return <EmptySearchState />;
                return <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{sorted.map((place, index) => <div ref={index === sorted.length - 1 ? lastElementRef : null} key={place.id}><PlaceCard place={place} onClick={() => handlePlaceSelect(place)} onAddActivity={() => handleOpenActivityModal(place)} /></div>)}</div>;
            }
        };
        return <div className="max-w-7xl mx-auto w-full">{renderList()}{isFetchingMore && <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"><CardSkeleton /><CardSkeleton /></div>}{!isFetchingMore && !hasMore && places.length > 0 && !isCommunityCategory && !isFavoritesCategory && <p className="text-center text-[#64748b] dark:text-slate-400 p-10 font-bold text-sm">Das war's für heute! 🎉</p>}</div>;
    }

    if (viewMode === 'map') {
        if (!userLocation) return <div className="flex h-full w-full items-center justify-center"><MapPin className="h-8 w-8 animate-bounce text-primary" /></div>;
        if (!userProfile?.isPremium) {
            return <div className="flex flex-col items-center justify-center p-10 h-[calc(100%-80px)] text-center space-y-6"><div className="bg-white dark:bg-slate-800 p-8 rounded-full shadow-xl relative"><Lock className="h-12 w-12 text-[#64748b] dark:text-slate-400" /><div className="absolute -top-1 -right-1 bg-primary text-white p-2 rounded-full border-4 border-white dark:border-slate-800 shadow-lg"><Sparkles className="h-5 w-5" /></div></div><div className="space-y-2 max-w-sm"><h2 className="text-2xl font-black text-[#0f172a] dark:text-slate-100">Kartenansicht gesperrt</h2><p className="text-[#64748b] dark:text-slate-400 font-medium">Die interaktive geografische Entdeckung ist Teil der Premium-Architektur.</p></div><Button onClick={() => setIsPremiumUpsellOpen(true)} className="rounded-2xl px-10 h-14 font-black shadow-xl shadow-primary/20 gap-2 text-lg transition-transform active:scale-95">Premium freischalten</Button></div>;
        }
        const placesForMap = isFavoritesCategory ? (favorites as Place[]) : places.filter(place => place.name.toLowerCase().includes(searchQuery.toLowerCase()));
        return <MapView places={placesForMap} userLocation={userLocation} onPlaceSelect={handlePlaceSelect} />;
    }
  };

  return (
    <>
      <div className="flex h-full w-full flex-col">
        <header className="flex-none w-full border-b border-slate-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/90 backdrop-blur-md z-20">
          <div className="flex flex-col gap-4 px-4 py-5 sm:px-6 max-w-7xl mx-auto w-full">
             <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-[#0f172a] dark:text-slate-100">Entdecken</h1>
                  <button onClick={() => setIsLocationSearchOpen(true)} className="flex items-center gap-1.5 text-[#64748b] dark:text-slate-400 mt-1.5 hover:text-primary transition-colors font-bold text-sm">
                    <MapPin className="h-4 w-4" />
                    <span>{cityName}</span>
                  </button>
                </div>
                <div className="flex items-center gap-3">
                    <NotificationBell />
                    <div className="flex items-center gap-1 rounded-2xl bg-slate-50 dark:bg-slate-800 p-1.5 shadow-inner">
                        <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className={cn("h-9 w-9 rounded-xl shadow-sm transition-all", viewMode === 'list' ? "bg-white dark:bg-slate-700 text-primary" : "text-[#64748b] dark:text-slate-400")} onClick={() => setViewMode('list')}><List className="h-5 w-5" /></Button>
                        <Button variant={viewMode === 'map' ? 'secondary' : 'ghost'} size="icon" className={cn("h-9 w-9 rounded-xl shadow-sm relative transition-all", viewMode === 'map' ? "bg-white dark:bg-slate-700 text-primary" : "text-[#64748b] dark:text-slate-400")} onClick={() => { if (!userProfile?.isPremium) { setIsPremiumUpsellOpen(true); return; } setViewMode('map'); }}><MapIcon className="h-5 w-5" />{!userProfile?.isPremium && <div className="absolute -top-1 -right-1 bg-amber-400 rounded-full p-0.5 border-2 border-white dark:border-slate-800 shadow-sm"><Lock className="h-2 w-2 text-white fill-current" /></div>}</Button>
                    </div>
                    <Button variant="default" size="icon" className="h-10 w-10 rounded-2xl shadow-lg shadow-primary/20" onClick={handleOpenCustomActivityModal}><Plus className="h-6 w-6" strokeWidth={3} /></Button>
                </div>
            </div>
            <CategoryFilters activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />
            <div className="mt-2 flex w-full items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#64748b] dark:text-slate-400" />
                <Input
                    type="search"
                    placeholder="Suchen..."
                    value={searchQuery}
                    onChange={(e) => { 
                        setSearchQuery(e.target.value); 
                        if (e.target.value && activeTabId !== 'All' && !isCommunityCategory && !isFavoritesCategory) {
                            handleCategoryChange(['all'], 'All'); 
                        } 
                    }}
                    className="w-full rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 border-none pl-12 h-12 text-sm font-bold placeholder:text-slate-400 focus-visible:ring-0 focus-visible:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all"
                />
              </div>
              {!isFavoritesCategory && (
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[160px] rounded-2xl h-12 bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 border-none focus:ring-0 font-bold text-xs text-[#0f172a] shadow-inner px-4"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl border-none shadow-2xl font-bold dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"><SelectItem value="recommended">Empfohlen</SelectItem><SelectItem value="rating">Bewertung</SelectItem><SelectItem value="popular">Beliebt</SelectItem><SelectItem value="newest">Neueste</SelectItem></SelectContent>
                </Select>
              )}
            </div>
            {!isCommunityCategory && !isFavoritesCategory && (
              <div className="flex flex-col gap-2.5 mt-1 px-1">
                <div className="flex justify-between items-center text-[10px] font-black text-[#64748b] dark:text-slate-400 uppercase tracking-widest"><span>Suchradius</span><span className="text-primary">{searchRadiusKm} km</span></div>
                <input type="range" min="1" max="50" step="1" value={searchRadiusKm} onChange={(e) => setSearchRadiusKm(Number(e.target.value))} className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary" />
              </div>
            )}
          </div>
        </header>
        <div className={`flex-1 w-full pb-24 ${viewMode === 'list' ? 'overflow-y-auto' : 'overflow-hidden'}`}>{renderContent()}</div>
      </div>
      <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
        <DialogContent className="max-h-[95vh] flex flex-col p-0 w-full max-w-4xl gap-0 overflow-hidden rounded-3xl border-none shadow-2xl dark:bg-slate-900">
          <DialogTitle className="sr-only">{selectedPlace?.name || 'Ort Details'}</DialogTitle>
          <DialogDescription className="sr-only">Detaillierte Informationen und Aktivitäten zu diesem Ort.</DialogDescription>
          {selectedPlace && <PlaceDetails place={selectedPlace} onClose={handleDialogClose} />}
        </DialogContent>
      </Dialog>
      <CreateActivityDialog place={activityModalPlace === 'custom' ? null : activityModalPlace} open={!!activityModalPlace} onOpenChange={(open) => !open && setActivityModalPlace(null)} onCreateActivity={handleCreateActivity} />
      <LocationSearchDialog open={isLocationSearchOpen} onOpenChange={setIsLocationSearchOpen} />
      <Dialog open={isPremiumUpsellOpen} onOpenChange={setIsPremiumUpsellOpen}><DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl dark:bg-slate-900"><DialogHeader className="items-center text-center"><div className="bg-primary/10 p-5 rounded-3xl mb-4 shadow-inner"><Sparkles className="h-10 w-10 text-primary" /></div><DialogTitle className="text-2xl font-black text-[#0f172a] dark:text-slate-100">Werde Premium-Mitglied</DialogTitle><DialogDescription className="text-base font-medium text-[#64748b] dark:text-slate-400">Schalte exklusive Funktionen frei und unterstütze die Entwicklung.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800"><div className="mt-1 bg-primary text-white p-1 rounded-lg"><Check className="h-3 w-3" strokeWidth={4} /></div><div><p className="font-black text-sm text-[#0f172a] dark:text-slate-100">Interaktive Kartenansicht</p><p className="text-xs font-medium text-[#64748b] dark:text-slate-400">Entdecke alles direkt auf der Karte.</p></div></div><div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800"><div className="mt-1 bg-primary text-white p-1 rounded-lg"><Check className="h-3 w-3" strokeWidth={4} /></div><div><p className="font-black text-sm text-[#0f172a] dark:text-slate-100">Keine Werbung</p><p className="text-xs font-medium text-[#64748b] dark:text-slate-400">Genieße Aktvia ohne Unterbrechungen.</p></div></div></div><DialogFooter><Button className="w-full h-14 text-lg font-black rounded-2xl shadow-xl shadow-primary/20 transition-transform active:scale-95" onClick={() => setIsPremiumUpsellOpen(false)}>Jetzt upgraden</Button></DialogFooter></DialogContent></Dialog>
    </>
  );
}
