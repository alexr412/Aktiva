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
import { MapPin, Map as MapIcon, List, Plus, Search, Bookmark, RotateCcw, Lock, Sparkles, Check, Loader2, Crown, MessageSquare, ChevronDown, Globe, Users } from 'lucide-react';
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
import { GLOBAL_EXCLUDE_STRING, applyFilters, searchTextPlaces } from '@/lib/geoapify';
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
    const error = new Error(`Geoapify API error: ${res.status} URL: ${url}`);
    (error as any).status = res.status;
    (error as any).url = url;
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
  const isActiveCategory = activeTabId === "Active";

  // MULTI-SOURCE FETCHER (Geoapify vs Firestore)
  const multiFetcher = async (key: any) => {
    if (!key) return null;
    const { type, pageIndex } = key;
    
    console.log(`🚀 [Discovery] Fetching ${type} (Page: ${pageIndex})`, key);

    // FAIL-SAFE: 8s Timeout via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      if (type === 'search') {
        const { query, lat, lon } = key;
        return searchTextPlaces(query, lat, lon);
      }

      if (type === 'geoapify') {
        const { urls, url: singleUrl } = key;
        const disablePenalty = key.disablePenalty || false;
        
        const fetchWithTimeout = async (u: string) => {
          const response = await fetch(u, { signal: controller.signal });
          if (!response.ok) throw new Error(`API Error: ${response.status}`);
          return response.json();
        };

        if (Array.isArray(urls)) {
          const settles = await Promise.allSettled(urls.map(u => fetchWithTimeout(u)));
          clearTimeout(timeoutId);

          const successfulData = settles
            .filter((s): s is PromiseFulfilledResult<any> => s.status === 'fulfilled')
            .flatMap((s, idx) => {
              const features = s.value.features || [];
              console.log(`📡 [Stream ${idx}] Returned ${features.length} items from URL: ${urls[idx].substring(0, 80)}...`);
              return features.map((f: any) => ({ ...f, disablePenalty, streamSource: idx }));
            });
            
          console.log(`📥 [Discovery] API Response: ${successfulData.length} items total.`);
          return successfulData;
        }
        
        const result = await fetchWithTimeout(singleUrl || key.url);
        clearTimeout(timeoutId);
        const features = (result.features || []).map((f: any) => ({ ...f, disablePenalty }));
        console.log(`📥 [Discovery] Single Stream Success: ${features.length} items.`);
        return features;
      }

      if (type === 'activities') {
        const q = query(collection(db!, 'activities'), limit(250));
        const snap = await getDocs(q);
        clearTimeout(timeoutId);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() as Activity }));
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
        clearTimeout(timeoutId);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutErr = new Error('Timeout');
        (timeoutErr as any).isTimeout = true;
        throw timeoutErr;
      }
      throw error;
    }

    return null;
  };

  // Hard cap: Geoapify rejects offset values that are too high (400 Bad Request).
  // limit=500 is the documented max; we keep offset + limit <= 500 to stay safe.
  const GEOAPIFY_MAX_OFFSET = 500;

  const getKey = (pageIndex: number, previousPageData: any) => {
    if (previousPageData && !previousPageData.length) return null;
    if (!userLocation) return null;

    // 1. HIGHLIGHTS (Spots mit hoher Upvote-Rate aus Firestore)
    if (isHighlightsCategory) {
      const cursor = pageIndex === 0 ? null : previousPageData[previousPageData.length - 1]?.upvotes;
      return { type: 'highlights', cursorValue: cursor, pageIndex };
    }

    // 2. COMMUNITY / ACTIVE (Aktivitäten aus Firestore)
    if (isCommunityCategory || isActiveCategory) {
      const cursor = pageIndex === 0 ? null : previousPageData[previousPageData.length - 1]?.createdAt;
      return { type: 'activities', subType: isCommunityCategory ? 'community' : 'location', cursorValue: cursor, pageIndex };
    }

    // --- GEOAPIFY LOGIK ---
    const radiusMeters = Math.min(50000, maxDistance ? maxDistance * 1000 : 50000);
    const pOffset = pageIndex === 0 ? 0 : 100 + (pageIndex - 1) * 100;
    const cOffset = pageIndex === 0 ? 0 : 50 + (pageIndex - 1) * 50;
    const gOffset = pageIndex === 0 ? 0 : 5 + (pageIndex - 1) * 5;

    // 3. SEARCH ROUTING (Kurze Suche vs. Intens-Analyse)
    if (debouncedSearchQuery && activeCategory.length === 0) {
      if (debouncedSearchQuery.split(' ').length > 2 || /mit|für|bei|Ausflug/i.test(debouncedSearchQuery)) {
        // Semantic/Vibe-Intent Analysis (Simplified)
        let intentCats = ['entertainment'];
        if (/kinder|familie|kids/i.test(debouncedSearchQuery)) intentCats = ['entertainment.zoo', 'entertainment.theme_park', 'entertainment.water_park'];
        if (/regen|schlechtwetter|drinnen/i.test(debouncedSearchQuery)) intentCats = ['entertainment.cinema', 'entertainment.museum'];
        
        return { type: 'geoapify', url: `https://api.geoapify.com/v2/places?categories=${intentCats.join(',')}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=100&apiKey=${GEOAPIFY_API_KEY}`, pageIndex };
      } 
      // Exact Match Mode (Textsuche für Begriffe wie "Cinestar")
      return { type: 'geoapify', url: `https://api.geoapify.com/v2/places?text=${encodeURIComponent(debouncedSearchQuery)}&filter=circle:${userLocation.lng},${userLocation.lat},50000&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=100&apiKey=${GEOAPIFY_API_KEY}`, pageIndex };
    }

    // 4. VIBE-CLUSTER CHECK
    const vibeClusters: Record<string, { cats: string[], radius: number }> = {
      "Schlechtwetter-Retter": { cats: ['entertainment.cinema', 'entertainment.museum', 'entertainment.escape_game', 'leisure.spa'], radius: 20000 },
      "Familien-Action": { cats: ['entertainment.zoo', 'entertainment.water_park', 'entertainment.theme_park', 'entertainment.activity_park'], radius: 20000 },
      "Natur & Rausgehen": { cats: ['leisure.park', 'natural.protected_area'], radius: 15000 },
      "Nachtleben & Drinks": { cats: ['adult.nightclub', 'catering.bar', 'catering.pub'], radius: 10000 },
      "Gruppen-Spaß": { cats: ['entertainment.escape_game', 'entertainment.bowling_alley'], radius: 15000 },
      "Adrenalin & Sport": { cats: ['entertainment.activity_park.trampoline', 'sport', 'entertainment.water_park'], radius: 20000 },
      "Kaffee & Genuss": { cats: ['catering.cafe', 'catering.restaurant'], radius: 5000 },
      "Kultur & Geschichte": { cats: ['entertainment.museum', 'tourism.sights'], radius: 15000 }
    };

    const activeVibe = Object.keys(vibeClusters).find(v => activeCategory.includes(v));
    if (activeVibe) {
      const v = vibeClusters[activeVibe];
      return { type: 'geoapify', url: `https://api.geoapify.com/v2/places?categories=${v.cats.join(',')}&filter=circle:${userLocation.lng},${userLocation.lat},${v.radius}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=100&apiKey=${GEOAPIFY_API_KEY}`, pageIndex };
    }

    // 5. TRIPLE-STREAM DISCOVERY (Hero, Food-Cap, Nature-Cap)
    let categoriesToFetch: string[] = (activeCategory.length === 0 || activeCategory.includes('has_activities')) ? [] : activeCategory;

    if (categoriesToFetch.length === 0) {
      const uCats = ["entertainment", "adult.nightclub", "sport.sports_centre"];
      const fCats = ["catering.pub", "catering.bar", "catering.restaurant"];
      const nCats = ["commercial.shopping_mall", "leisure.park"];

      // TASK 1: Force LARGE Radius for Hero Content (regardless of UI)
      const url1 = `https://api.geoapify.com/v2/places?categories=${uCats.join(',')}&filter=circle:${userLocation.lng},${userLocation.lat},50000&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=100&offset=${pOffset}&apiKey=${GEOAPIFY_API_KEY}`;
      
      // TASK 2: Radical Caps (max 2 per stream for page 0)
      const a2LimitForPage0 = 2;
      const a3LimitForPage0 = 2;
      
      const url2 = `https://api.geoapify.com/v2/places?categories=${fCats.join(',')}&filter=circle:${userLocation.lng},${userLocation.lat},10000&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=${pageIndex === 0 ? a2LimitForPage0 : 50}&offset=${cOffset}&apiKey=${GEOAPIFY_API_KEY}`;
      const url3 = `https://api.geoapify.com/v2/places?categories=${nCats.join(',')}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=${pageIndex === 0 ? a3LimitForPage0 : 5}&offset=${gOffset}&apiKey=${GEOAPIFY_API_KEY}`;
      return { type: 'geoapify', urls: [url1, url2, url3], pageIndex };
    }

    // Fallback für sonstige Kategorien
    const fallbackCats = categoriesToFetch.join(',');
    return { type: 'geoapify', url: `https://api.geoapify.com/v2/places?categories=${fallbackCats}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=150&offset=${pOffset}&apiKey=${GEOAPIFY_API_KEY}`, pageIndex };
  };

  const { data, size, setSize, isValidating, error } = useSWRInfinite(getKey, multiFetcher, {
    revalidateFirstPage: false,
    dedupingInterval: 60000,
    keepPreviousData: true,
  });

  const isLoadingInitialData = !data && !error;
  const isEmpty = data?.[0]?.features ? data[0].features.length === 0 : (data?.[0]?.length === 0);
  const isFetchingNextPage = Boolean(size > 0 && data && typeof data[size - 1] === "undefined");

  const isReachingEnd = useMemo(() => {
    if (isEmpty) return true;
    const lastPage = data?.[data.length - 1];
    if (Array.isArray(lastPage)) return lastPage.length < 5;
    return (lastPage?.features?.length || 0) < 5;
  }, [data, isEmpty]);

  const userPrefs: UserPreferences = useMemo(() => ({
    likedTags: userProfile?.likedTags || [],
    dislikedTags: userProfile?.dislikedTags || []
  }), [userProfile]);

  // Vote-Daten aus Firestore für Ranking-Integration
  const [votesMap, setVotesMap] = useState<Record<string, { upvotes: number; downvotes: number }>>({});

  // Client-seitiges Merging, Deduplizierung und FINAL SORTING (Audit-Konform)
  const places = useMemo(() => {
    console.log("🔍 [X-Ray] Raw SWR Data Type:", typeof data, "IsArray:", Array.isArray(data), "Content:", data);
    try {
      if (!data || isCommunityCategory || isActiveCategory || isFavoritesCategory) return [];
      const deduplicatedMap = new Map<string, Place>();
    
      data.forEach((pageData: any, pageIdx: number) => {
        if (!Array.isArray(pageData)) {
          console.warn(`⚠️ [Pipeline] Page ${pageIdx} is not an array:`, pageData);
          return;
        }

        pageData.forEach((f: any) => {
          const props = f?.properties || f;
          // FIX: Correct ID extraction for Geoapify (properties.place_id) and Firestore (id)
          const placeId = props?.place_id || f?.id || `fallback-${props?.lat}-${props?.lon}-${props?.name}`;
          if (!placeId) return;

          const disablePenalty = f?.disablePenalty || false;
          const votes = votesMap[placeId] || { upvotes: 0, downvotes: 0 };
          const tags = Array.isArray(props?.categories) ? props.categories : (props?.categories ? [props.categories] : []);
          
          const placeName = props?.name || props?.formatted || props?.address_line1;
          if (!placeName || placeName.includes(',') || placeName.length < 2) return;

          const processedPlace = {
            id: placeId,
            name: placeName,
            address: props?.address_line2 || props?.formatted || (language === "de" ? "Keine Adresse" : "No address available"),
            categories: tags,
            lat: props?.lat || 0,
            lon: props?.lon || 0,
            rating: props?.rating || 0,
            distance: props?.distance || calculateDistance(userLocation?.lat || 0, userLocation?.lng || 0, props?.lat || 0, props?.lon || 0),
            relevanceScore: calculateRelevance(
              { ...props, categories: tags, upvotes: votes.upvotes, downvotes: votes.downvotes },
              userProfile || { role: 'user' } as any,
              userLocation || { lat: 0, lng: 0 },
              { disableBoringPenalty: disablePenalty }
            ),
            openingHours: props?.opening_hours || props?.datasource?.raw?.opening_hours || null
          } as Place;

          deduplicatedMap.set(placeId, processedPlace);
        });
      });

        console.log("🚦 [Pipeline] Deduplizierte Orte vor Ranking:", deduplicatedMap.size);

      const sorted = Array.from(deduplicatedMap.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
      const top150 = sorted.slice(0, 150);

      if (top150.length > 0) {
        // TASK 4: Top 20 Log inklusive Distanz
        console.log("🏆 [HMFR 2.0] Ranking complete. Current Top 20:");
        top150.slice(0, 20).forEach((p, i) => {
          console.log(`${i + 1}. ${p.name} - Score: ${p.relevanceScore.toFixed(1)}, Dist: ${(p.distance / 1000).toFixed(1)}km`);
        });
      }

      return top150;
    } catch (err) {
      console.error("💥 [HMFR Crash] Fehler beim Verarbeiten der Orte:", err);
      return [];
    }
  }, [data, isHighlightsCategory, activeCategory, userProfile, language, votesMap, userLocation, isCommunityCategory, isActiveCategory, isFavoritesCategory]);

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
  }, [data, isCommunityCategory, isActiveCategory, isHighlightsCategory, isFavoritesCategory]);

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
        if (!isFavoritesCategory && !isCommunityCategory && !isActiveCategory && !isHighlightsCategory) {
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
  }, [isFetchingNextPage, isReachingEnd, isValidating, setSize, data, visibleCount, isFavoritesCategory, isCommunityCategory, isActiveCategory, isHighlightsCategory]);

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

    const EmptySearchState = () => {
      const isActuallyEmpty = !debouncedSearchQuery && activeCategory.length === 0;
      const showCreateCTA = isCommunityCategory || isActiveCategory;

      return (
        <div className="flex flex-col h-full w-full items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
          <div className="space-y-6 max-w-sm">
            <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              {showCreateCTA ? <Users className="h-10 w-10 text-primary" /> : <MapPin className="h-10 w-10 text-primary" />}
            </div>
            <h3 className="font-black text-2xl text-[#0f172a] dark:text-neutral-200">
              {showCreateCTA
                ? (language === "de" ? "Noch keine Aktivitäten" : "No activities yet")
                : (language === "de" ? "Keine Ergebnisse" : "No results")}
            </h3>
            <p className="text-[#64748b] dark:text-neutral-400 font-bold leading-relaxed">
              {showCreateCTA
                ? (language === "de" ? "Sei der Erste und erstelle eine neue Aktivität in deiner Nähe!" : "Be the first to create an activity in your area!")
                : (language === "de" ? "Passe deine Suche oder die Filter an, um mehr zu entdecken." : "Adjust your search or filters to discover more.")}
            </p>

            <div className="flex flex-col gap-3">
              {showCreateCTA && (
                <Button onClick={handleOpenCustomActivityModal} className="rounded-2xl font-black h-14 text-lg shadow-lg shadow-primary/20">
                  <Plus className="mr-2 h-5 w-5 stroke-[3px]" />
                  {language === "de" ? "Aktivität erstellen" : "Create Activity"}
                </Button>
              )}
              <Button
                onClick={() => { handleCategoryChange([], ''); setMaxDistance(10); setActivityCategoryFilter(language === 'de' ? 'Alle' : 'All'); }}
                variant="ghost"
                className="rounded-2xl font-black text-neutral-400 hover:text-primary transition-colors"
              >
                {language === "de" ? "Filter zurücksetzen" : "Reset filters"}
              </Button>
            </div>
          </div>
        </div>
      );
    };

    if (viewMode === 'list') {
      const renderList = () => {
        if (isLoadingInitialData) {
          return (
            <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {[...Array(8)].map((_, i) => <CardSkeleton key={`loading-skel-${i}`} />)}
            </div>
          );
        }

        if (error) {
          return (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-full">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div>
                <h3 className="font-black text-lg">{error.isTimeout ? (language === 'de' ? 'API Timeout' : 'API Timeout') : (language === 'de' ? 'Fehler beim Laden' : 'Loading Error')}</h3>
                <p className="text-neutral-500 text-sm font-medium">
                  {error.isTimeout 
                    ? (language === 'de' ? 'Die Anfrage hat zu lange gedauert. Bitte verkleinere deinen Radius oder ändere die Filter.' : 'The request took too long. Please reduce your radius or change filters.')
                    : (language === 'de' ? 'Bitte versuche es später erneut.' : 'Please try again later.')}
                </p>
              </div>
              <Button onClick={() => mutate()} variant="outline" className="rounded-xl font-bold">
                {language === 'de' ? 'Erneut versuchen' : 'Try Again'}
              </Button>
            </div>
          );
        }

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

        if (isCommunityCategory || isActiveCategory) {
          const rawItems = (data?.flat() || []) as any[];
          if (rawItems.length === 0 && !isValidating) return <EmptySearchState />;
          
          return (
            <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6 pb-24">
              {rawItems.map((item: any) => (
                <div key={`act-${item.id}`} className="min-h-[280px] w-full">
                   {isCommunityCategory ? (
                      <ActivityListItem activity={item} user={user} onJoin={handleJoin} />
                    ) : (
                      <PlaceCard
                        place={item as any}
                        onClick={() => handlePlaceSelect(item as any)}
                        onAddActivity={() => handleOpenActivityModal(item as any)}
                      />
                    )}
                </div>
              ))}
            </div>
          );
        }

        if (places.length === 0 && !isValidating) return <EmptySearchState />;

        return (
          <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {places.map((place) => (
              <div key={`place-${place.id}`} className="min-h-[280px] w-full">
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
          {/* OBSERVER BLOCKADE: Prevent infinite triggering on empty or error states */}
          {!isReachingEnd && !isLoadingInitialData && !isValidating && places.length > 0 && !debouncedSearchQuery && !error && (
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
