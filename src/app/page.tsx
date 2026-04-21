'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { CategoryFilters } from '@/components/aktvia/category-filters';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { PlaceCard } from '@/components/aktvia/place-card';
import { SpotActionSheet } from '@/components/aktvia/spot-action-sheet';
import type { Place, Activity, GeoapifyFeature, UserPreferences, ActivityCategory } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { MapPin, Map as MapIcon, List, Plus, Search, Bookmark, RotateCcw, Lock, Sparkles, Check, Loader2, Crown, MessageSquare, ChevronDown, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createActivity, joinActivity, searchActivitiesBySemanticVector, castActivityVote, votePlace } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, startAfter, doc, documentId } from "firebase/firestore";
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
import { GLOBAL_EXCLUDE_STRING, applyFilters } from '@/lib/geoapify';
import { calculateRelevance } from '@/lib/ranking';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { UserBadge } from '@/components/common/UserBadge';
import { calculateDistance } from '@/lib/geo-utils';
import { useLanguage } from '@/hooks/use-language';

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

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error(`Geoapify API error: ${res.status}`);
    (error as any).status = res.status;
    throw error;
  }
  return res.json();
};

const DISTANCE_FILTERS = [
  { label: 'Alle', labelEn: 'All', value: null },
  { label: '< 5km', labelEn: '< 5km', value: 5 },
  { label: '< 10km', labelEn: '< 10km', value: 10 },
  { label: '< 25km', labelEn: '< 25km', value: 25 },
];

export default function Home() {
  const language = useLanguage();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [activityModalPlace, setActivityModalPlace] = useState<Place | 'custom' | null>(null);
  const [activeCategory, setActiveCategory] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [cityName, setCityName] = useState<string>(language === 'de' ? "Wird geladen..." : "Loading...");
  const [isRadiusOpen, setIsRadiusOpen] = useState(false);
  const [sortBy, setSortBy] = useState("recommended");
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
  const [isPremiumUpsellOpen, setIsPremiumUpsellOpen] = useState(false);
  const [maxDistance, setMaxDistance] = useState<number | null>(10);
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<ActivityCategory | 'Alle' | 'All'>(language === 'de' ? 'Alle' : 'All');
  const [visibleCount, setVisibleCount] = useState(25);
  const [actionSheetPlace, setActionSheetPlace] = useState<Place | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { toast } = useToast();
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { planningState } = usePlanningMode();
  const { favorites } = useFavorites();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Background scroll lock
  useEffect(() => {
    const isAnyModalOpen = !!selectedPlace || !!activityModalPlace || isLocationSearchOpen || isPremiumUpsellOpen || !!actionSheetPlace;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [selectedPlace, activityModalPlace, isLocationSearchOpen, isPremiumUpsellOpen, actionSheetPlace]);

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
        const queryLimit = key.pageIndex === 0 ? 150 : 10;
        const constraints: any[] = [
          limit(queryLimit * 5)
        ];

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
        const queryLimit = key.pageIndex === 0 ? 25 : 10;
        const constraints: any[] = [
          where('upvotes', '>', 0),
          orderBy('upvotes', 'desc'),
          limit(queryLimit)
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

  // Hard cap: Geoapify rejects offset values that are too high (400 Bad Request).
  // limit=500 is the documented max; we keep offset + limit <= 500 to stay safe.
  const GEOAPIFY_MAX_OFFSET = 500;

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
      ? ["entertainment", "leisure", "catering", "tourism.attraction", "adult.nightclub"]
      : activeCategory;

    // Fetch 300 initially for a massive algorithmic search pool, UI renders 25 initially
    const queryLimit = pageIndex === 0 ? 300 : 50;
    const offset = pageIndex === 0 ? 0 : 300 + (pageIndex - 1) * 50;

    // Stop pagination if offset exceeds Geoapify's hard limit
    if (offset >= GEOAPIFY_MAX_OFFSET) return null;

    const radiusMeters = maxDistance ? maxDistance * 1000 : 100000;
    const url = `https://api.geoapify.com/v2/places?categories=${categoriesToFetch.join(',')}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=${queryLimit}&offset=${offset}&conditions=named&apiKey=${GEOAPIFY_API_KEY}`;

    return { type: 'geoapify', url, pageIndex };
  }

  const { data, size, setSize, isValidating, error } = useSWRInfinite(getKey, multiFetcher, {
    revalidateFirstPage: false,
    dedupingInterval: 60000,
    keepPreviousData: true,
  });

  const isLoadingInitialData = !data && !error;
  const isEmpty = data?.[0]?.features ? data[0].features.length === 0 : (data?.[0]?.length === 0);
  const isFetchingNextPage = Boolean(size > 0 && data && typeof data[size - 1] === "undefined");

  const isReachingEnd = useMemo(() => {
    if (error) return true; // STOPS THE INFINITE 400 ERROR FIRESTORM LOOP!
    if (isEmpty) return true;
    if (!data || data.length === 0) return false;
    const lastPage = data[data.length - 1];
    
    // Geoapify pagination logic: Page 0 fetches 300, Page > 0 fetches 50
    const expectedLimit = (data.length - 1) === 0 ? 300 : 50; 
    
    if (isCommunityCategory || isAktivCategory || isHighlightsCategory) {
      // Firebase fallback limits (150 and 10)
      const fbLimit = (data.length - 1) === 0 ? 150 : 10;
      return Boolean(lastPage && lastPage.length < fbLimit);
    }
    
    return Boolean(lastPage && lastPage.features?.length < expectedLimit);
  }, [data, isEmpty, error, isCommunityCategory, isAktivCategory, isHighlightsCategory]);

  const userPrefs: UserPreferences = useMemo(() => ({
    likedTags: userProfile?.likedTags || [],
    dislikedTags: userProfile?.dislikedTags || []
  }), [userProfile]);

  // Vote-Daten aus Firestore für Ranking-Integration
  const [votesMap, setVotesMap] = useState<Record<string, { upvotes: number; downvotes: number }>>({}); 

  const places = useMemo(() => {
    if (!data || isCommunityCategory || isAktivCategory || isFavoritesCategory) return [];
    if (isHighlightsCategory) return data.flat() as Place[];

    return data.flatMap(page => {
      const features = page?.features || [];
      const itemsToFilter = features.map((f: any) => ({
        tags: Array.isArray(f.properties.categories) ? f.properties.categories : [f.properties.categories],
        properties: f.properties,
        distance: f.properties.distance || 0
      }));
      const safeItems = applyFilters(itemsToFilter, activeCategory, userProfile?.blacklist?.hard || []);

      return safeItems.map((item: any) => {
        const props = item.properties;
        let rating;
        if (props.datasource?.raw?.rating) {
          const parsedRating = parseFloat(props.datasource.raw.rating);
          if (!isNaN(parsedRating)) rating = Math.max(0, Math.min(5, parsedRating));
        }
        const cats = Array.isArray(props.categories) ? props.categories : [props.categories];
        const distance = item.distance || 0;
        const placeId = props.place_id;
        const votes = votesMap[placeId] || { upvotes: 0, downvotes: 0 };
        return {
          id: placeId,
          name: props.name || props.address_line1 || (language === "de" ? "Unbekannter Ort" : "Unknown Place"),
          address: props.address_line2 || (language === "de" ? "Keine Adresse verfügbar" : "No address available"),
          categories: cats,
          lat: props.lat,
          lon: props.lon,
          rating: rating,
          distance: distance,
          relevanceScore: calculateRelevance(
            { ...props, categories: cats, distance: distance, upvotes: votes.upvotes, downvotes: votes.downvotes },
            userProfile || { role: 'user' } as any,
            userLocation || { lat: 0, lng: 0 }
          ),
          openingHours: props.opening_hours || props.datasource?.raw?.opening_hours || null
        } as Place;
      });
    });
  }, [data, userPrefs, votesMap, isCommunityCategory, isAktivCategory, isHighlightsCategory, isFavoritesCategory]);

  // Batch-Fetch & Echtzeit-Listener für Vote-Daten aller sichtbaren Orte
  useEffect(() => {
    if (!db || places.length === 0) return;
    const placeIds = [...new Set(places.map(p => p.id).filter(Boolean))];
    if (placeIds.length === 0) return;

    // Echtzeit-Listener für alle Orte in der places-Collection
    const unsubscribers: (() => void)[] = [];
    for (const id of placeIds) {
      const unsub = onSnapshot(doc(db, 'places', id), (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setVotesMap(prev => {
            const prevEntry = prev[id];
            if (prevEntry && prevEntry.upvotes === (d.upvotes || 0) && prevEntry.downvotes === (d.downvotes || 0)) {
              return prev; // Kein Update nötig
            }
            return { ...prev, [id]: { upvotes: d.upvotes || 0, downvotes: d.downvotes || 0 } };
          });
        }
      });
      unsubscribers.push(unsub);
    }

    return () => unsubscribers.forEach(unsub => unsub());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isCommunityCategory, isAktivCategory, isHighlightsCategory, isFavoritesCategory]);

  const observer = useRef<IntersectionObserver | null>(null);
  const isLoadingMore = useRef(false);
  const lastElementRef = useCallback((node: any) => {
    if (observer.current) observer.current.disconnect();
    // Early-exit: don't observe if we know there's nothing left
    if (isReachingEnd || isFetchingNextPage || isValidating) {
      return;
    }
    const options = { rootMargin: '0px 0px -50px 0px', threshold: 1.0 };
    observer.current = new IntersectionObserver(entries => {
      const target = entries[0];
      if (target.isIntersecting && !isLoadingMore.current) {
        isLoadingMore.current = true;
        if (!isFavoritesCategory && !isCommunityCategory && !isAktivCategory && !isHighlightsCategory) {
          const totalFetched = data ? data.flat().length : 0;
          if (visibleCount < totalFetched) {
            setVisibleCount(prev => prev + 25);
          } else {
            setSize(prev => prev + 1);
            setVisibleCount(prev => prev + 25);
          }
        } else {
          setSize(prev => prev + 1);
        }
        // Reset guard after a short delay so the next intersection can fire
        setTimeout(() => { isLoadingMore.current = false; }, 1000);
      }
    }, options);
    if (node) observer.current.observe(node);
  }, [isFetchingNextPage, isReachingEnd, isValidating, setSize, data, visibleCount, isFavoritesCategory, isCommunityCategory, isAktivCategory, isHighlightsCategory]);

  useEffect(() => {
    const reverseGeocode = async (lat: number, lng: number) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        const fallback = language === 'de' ? 'Unbekannter Ort' : 'Unknown Place';
        setCityName(data.address.city || data.address.town || data.address.village || fallback);
      } catch (error) { 
        setCityName(language === 'de' ? 'Unbekannter Ort' : 'Unknown Place'); 
      }
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
    setActivityCategoryFilter('Alle');
    setVisibleCount(25);
  };

  useEffect(() => {
    setVisibleCount(25);
  }, [debouncedSearchQuery]);

  const handlePlaceSelect = (place: Place) => setSelectedPlace(place);
  const handleDialogClose = () => setSelectedPlace(null);
  const handleOpenActivityModal = (place: Place) => { 
    if (!user) { 
      router.push('/login'); 
      return; 
    } 
    setActionSheetPlace(place); 
  };
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
      return <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">{Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
    }
    if (!userLocation && !isLoadingInitialData) {
      return <div className="flex h-full w-full items-center justify-center"><div className="flex flex-col items-center gap-2 text-muted-foreground"><MapPin className="h-8 w-8 animate-bounce text-primary" /><p className="font-bold text-sm">{language === 'de' ? 'Standort wird ermittelt...' : 'Locating...'}</p></div></div>;
    }
    if (error) return <div className="flex h-full w-full items-center justify-center p-6 text-center text-destructive font-bold">{language === 'de' ? 'Verbindungsproblem.' : 'Connection problem.'}</div>;

    const EmptySearchState = () => (
      <div className="flex h-full w-full items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <h3 className="font-black text-xl text-[#0f172a] dark:text-neutral-200">{language === "de" ? "Keine Ergebnisse" : "No results"}</h3>
          <p className="text-[#64748b] dark:text-neutral-400 font-medium">{language === "de" ? "Passe deine Suche oder die Filter an." : "Adjust your search or filters."}</p>
          <Button onClick={() => { handleCategoryChange([], ''); setMaxDistance(10); setActivityCategoryFilter(language === 'de' ? 'Alle' : 'All'); }} variant="outline" className="rounded-xl font-bold">{language === "de" ? "Filter zurücksetzen" : "Reset filters"}</Button>
        </div>
      </div>
    );

    if (viewMode === 'list') {
      const renderList = () => {
        if (isFavoritesCategory) {
          if (favorites.length === 0) {
            return <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center h-full"><div className="bg-primary/10 p-6 rounded-3xl"><Bookmark className="h-12 w-12 text-primary" /></div><h2 className="text-xl font-black text-[#0f172a] dark:text-neutral-200">{language === "de" ? "Noch keine Favoriten" : "No favorites yet"}</h2></div>;
          }
          return (
            <div className="p-4 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {favorites.map(place => (
                <div key={place.id} className="min-h-[280px] w-full">
                  <PlaceCard place={place as Place} onClick={() => handlePlaceSelect(place as Place)} onAddActivity={() => handleOpenActivityModal(place as Place)} />
                </div>
              ))}
            </div>
          );
        }

        if (isCommunityCategory || isAktivCategory) {
          const list = data?.flat() || [];

          const safeActivities = list.filter((item: any) => {
            if (!item) return false;
            return item.status !== 'completed' &&
              item.status !== 'cancelled' &&
              item.status !== 'blacklisted' &&
              (item.reportCount || 0) < QUARANTINE_THRESHOLD;
          });

          let semanticFiltered = safeActivities;
          if (activityCategoryFilter !== (language === 'de' ? 'Alle' : 'All')) {
            semanticFiltered = semanticFiltered.filter((item: any) => item.category === activityCategoryFilter);
          }

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

          const sortedList = [...filtered].sort((a, b) => {
            if (a.isBoosted && !b.isBoosted) return -1;
            if (!a.isBoosted && b.isBoosted) return 1;

            const collectiveWeight = 1.0;
            const personalWeight = 0.5;

            const affA = userProfile?.categoryAffinities?.[a.category || ''] || 0;
            const affB = userProfile?.categoryAffinities?.[b.category || ''] || 0;

            const hriA = (collectiveWeight * (a.globalScore || 0)) + (personalWeight * affA);
            const hriB = (collectiveWeight * (b.globalScore || 0)) + (personalWeight * affB);

            if (hriA !== hriB) return hriB - hriA;

            if (a.distance !== null && b.distance !== null) {
              return a.distance - b.distance;
            }

            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });

          if (sortedList.length === 0 && !isFetchingNextPage) return <EmptySearchState />;
          return (
            <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {sortedList.map((item) => {
                  const itemPlace: Place = {
                    id: item.placeId || "unknown",
                    name: item.placeName || (language === "de" ? "Unbekannter Ort" : "Unknown Place"),
                    address: item.placeAddress || (language === "de" ? "Keine Adresse" : "No Address"),
                    categories: item.categories || [],
                    lat: item.lat || 0,
                    lon: item.lon || 0,
                    activityCount: 1,
                    distance: item.distance ? item.distance * 1000 : undefined,
                    openingHours: item.openingHours || null
                  };

                return (
                  <div key={item.id} className="min-h-[280px] w-full">
                    {isCommunityCategory ? (
                      <ActivityListItem activity={item as any} user={user} onJoin={handleJoin} />
                    ) : (
                      <PlaceCard
                        place={itemPlace}
                        onClick={() => handlePlaceSelect(itemPlace)}
                        onAddActivity={() => handleOpenActivityModal(itemPlace)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        const filtered = places.filter(place => {
          if (!debouncedSearchQuery) return true;
          const name = place.name || "";
          return name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
        });
        const sorted = filtered.sort((a, b) => (sortBy === 'recommended' ? (b.relevanceScore || 0) - (a.relevanceScore || 0) : (sortBy === 'rating' ? (b.rating || 0) - (a.rating || 0) : 0)));

        const uniqueSorted = Array.from(new Map(sorted.map(place => [place.id, place])).values());

        if (uniqueSorted.length === 0) {
          if (isValidating) {
            return (
              <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            );
          }
          if (!isFetchingNextPage) return <EmptySearchState />;
        }

        const paginatedSorted = uniqueSorted.slice(0, visibleCount);

        return (
          <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {paginatedSorted.map((place) => (
              <div key={place.id} className="min-h-[280px] w-full">
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
            <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              <CardSkeleton />
            </div>
          )}
          {!isReachingEnd && !isLoadingInitialData && !debouncedSearchQuery && (
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
            <h2 className="text-2xl font-black text-[#0f172a] dark:text-neutral-200">{language === 'de' ? 'Kartenansicht gesperrt' : 'Map View Locked'}</h2>
            <Button onClick={() => setIsPremiumUpsellOpen(true)} className="rounded-2xl px-10 h-14 font-black">
              {language === 'de' ? 'Premium freischalten' : 'Unlock Premium'}
            </Button>
          </div>
        );
      }
      return <MapView places={places} userLocation={userLocation} onPlaceSelect={handlePlaceSelect} />;
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-white/40 dark:bg-neutral-900/40 relative">
        {/* Background Blobs for Visual Depth */}
        <div className="absolute top-[10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-[20%] right-[-10%] w-[35%] h-[35%] bg-violet-400/5 rounded-full blur-[100px] pointer-events-none" />
         <header className="flex-none w-full border-none bg-transparent pt-6 pb-2 z-20">
          <div className="flex flex-col gap-5 px-6 max-w-7xl mx-auto w-full">
            {/* Top Bar: Profile & System Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/profile">
                  <Avatar className="h-14 w-14 border-4 border-white dark:border-neutral-800 shadow-2xl shadow-primary/10 transition-transform active:scale-95 cursor-pointer">
                    <AvatarImage src={userProfile?.photoURL || user?.photoURL || undefined} alt="Avatar" />
                    <AvatarFallback className="bg-emerald-50 text-emerald-600 font-black text-xl">
                      {userProfile?.displayName ? userProfile.displayName.charAt(0) : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex flex-col">
                  <h1 className="text-2xl font-black tracking-tight text-[#0f172a] dark:text-neutral-100 font-heading">
                    {language === "de" ? `Hallo, ${userProfile?.displayName?.split(' ')[0] || 'Du'} 👋` : `Hi, ${userProfile?.displayName?.split(' ')[0] || 'You'} 👋`}
                  </h1>
                  <button onClick={() => setIsLocationSearchOpen(true)} className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500 font-bold text-[10px] uppercase tracking-[0.15em] mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{cityName}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <NotificationBell />
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-12 w-12 rounded-2xl bg-white dark:bg-neutral-800 text-neutral-500 shadow-xl shadow-slate-200/50 dark:shadow-none"
                  onClick={handleMapToggle}
                >
                  {viewMode === 'list' ? <Globe className="h-5 w-5" /> : <List className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <CategoryFilters activeCategory={activeCategory} onCategoryChange={handleCategoryChange} />

            {/* Search & Radius Area */}
            <div className="flex items-center gap-3 w-full">
              <div className="flex relative flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-300 group-focus-within:text-emerald-500 transition-colors" />
                <Input
                  type="search"
                  placeholder={language === "de" ? "Was möchtest du unternehmen?" : "What do you want to do?"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 h-14 rounded-full border-none bg-white font-bold shadow-xl shadow-slate-200/40 transition-all focus-visible:ring-4 focus-visible:ring-emerald-500/10 dark:bg-neutral-800 dark:text-neutral-100 dark:shadow-none"
                />
              </div>

              <div className="relative group">
                <DropdownMenu open={isRadiusOpen} onOpenChange={setIsRadiusOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                        variant="secondary"
                        className="h-14 px-5 rounded-3xl bg-white dark:bg-neutral-800 border-none shadow-xl shadow-slate-200/40 dark:shadow-none font-black text-emerald-500 text-xs flex items-center gap-2"
                    >
                        {maxDistance || 10} km
                        <ChevronDown className={cn("h-4 w-4 opacity-30 transition-transform", isRadiusOpen && "rotate-180")} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 p-4 rounded-3xl border-none shadow-2xl">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase text-slate-400">{language === 'de' ? 'Radius' : 'Radius'}</span>
                        <span className="text-sm font-black">{maxDistance} km</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="100" 
                        value={maxDistance || 10} 
                        onChange={(e) => setMaxDistance(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="grid grid-cols-4 gap-2">
                        {[5, 10, 25, 50].map((r) => (
                          <button 
                            key={r}
                            onClick={() => setMaxDistance(r)}
                            className={cn(
                              "py-2 rounded-xl text-[10px] font-black transition-all",
                              maxDistance === r ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                            )}
                          >
                            {r}k
                          </button>
                        ))}
                      </div>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 w-full pb-24 ${viewMode === 'list' ? 'overflow-y-auto' : 'overflow-hidden scroll-smooth'}`}>
            <div className="max-w-7xl mx-auto w-full">{renderContent()}</div>
        </div>
      </div>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-24 right-5 z-40 animate-in slide-in-from-bottom-4 fade-in duration-500">
        <Button
          variant="default"
          size="icon"
          className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
          onClick={handleOpenCustomActivityModal}
        >
          <Plus className="h-7 w-7" strokeWidth={3} />
        </Button>
      </div>

      {/* Responsive Place Details */}
      {isMobile ? (
        <Sheet open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
          <SheetContent side="bottom" className="p-0 h-[92vh] w-full border-none rounded-t-[2.5rem] overflow-hidden outline-none">
            <SheetHeader className="sr-only">
              <SheetTitle>{selectedPlace?.name}</SheetTitle>
            </SheetHeader>
            <div className="h-full w-full">
              {selectedPlace && (
                <PlaceDetails 
                  place={selectedPlace} 
                  onClose={handleDialogClose} 
                  onCreateActivity={() => setActivityModalPlace(selectedPlace)}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogContent className="p-0 w-full max-w-4xl max-h-[92vh] gap-0 overflow-hidden border-none outline-none">
            <DialogTitle className="sr-only">{selectedPlace?.name || (language === 'de' ? 'Ort Details' : 'Place Details')}</DialogTitle>
            <DialogDescription className="sr-only">{language === 'de' ? 'Details zum ausgewählten Ort' : 'Details about the selected place'}</DialogDescription>
            {selectedPlace && (
              <PlaceDetails 
                place={selectedPlace} 
                onClose={handleDialogClose} 
                onCreateActivity={() => setActivityModalPlace(selectedPlace)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      <CreateActivityDialog place={activityModalPlace === 'custom' ? null : activityModalPlace} open={!!activityModalPlace} onOpenChange={(open) => !open && setActivityModalPlace(null)} onCreateActivity={handleCreateActivity} />
      <SpotActionSheet 
        place={actionSheetPlace} 
        open={!!actionSheetPlace} 
        onOpenChange={(open) => !open && setActionSheetPlace(null)} 
        onCreateNew={(place) => setActivityModalPlace(place)} 
      />
      <LocationSearchDialog open={isLocationSearchOpen} onOpenChange={setIsLocationSearchOpen} />

      <Dialog open={isPremiumUpsellOpen} onOpenChange={setIsPremiumUpsellOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500" />
          <DialogHeader className="pt-6">
            <div className="mx-auto bg-amber-100 dark:bg-amber-900/30 p-4 rounded-full w-fit mb-4">
              <Crown className="h-10 w-10 text-amber-500" />
            </div>
            <DialogTitle className="text-2xl font-black text-center">{language === 'de' ? 'Premium-Funktion' : 'Premium Feature'}</DialogTitle>
            <DialogDescription className="text-center text-base font-medium px-2 pt-2">
              {language === 'de' 
                ? 'Die interaktive Kartenansicht ist ein exklusives Feature für Premium-Mitglieder. Schalte Premium frei, um alle Orte in deiner Umgebung visuell zu entdecken.'
                : 'The interactive map view is an exclusive feature for premium members. Unlock Premium to visually explore all places in your area.'}
            </DialogDescription>

          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500" strokeWidth={3} />
                <span className="font-bold text-sm">{language === 'de' ? 'Vollständige interaktive Karte' : 'Full interactive map'}</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-green-500" strokeWidth={3} />
                <span className="font-bold text-sm">{language === 'de' ? 'Keine Werbung mehr' : 'No more ads'}</span>
              </div>

            </div>
          </div>
          <DialogFooter className="flex flex-col gap-3 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsPremiumUpsellOpen(false)} className="rounded-xl font-bold h-12">{language === 'de' ? 'Abbrechen' : 'Cancel'}</Button>
            <Button onClick={() => setIsPremiumUpsellOpen(false)} className="rounded-xl font-black h-12 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20">
              {language === 'de' ? 'Upgrade freischalten' : 'Unlock Upgrade'}
            </Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
