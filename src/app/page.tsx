'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { CategoryFilters } from '@/components/aktiva/category-filters';
import { PlaceDetails } from '@/components/aktiva/place-details';
import { PlaceCard } from '@/components/aktiva/place-card';
import { SpotActionSheet } from '@/components/aktiva/spot-action-sheet';
import type { Place, Activity, GeoapifyFeature, UserPreferences, ActivityCategory } from '@/lib/types';
import { hasPremiumFeature } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { MapPin, Map as MapIcon, List, Plus, Search, Bookmark, RotateCcw, Lock, Sparkles, Check, Loader2, Crown, MessageSquare, ChevronDown, Globe, X, Compass, Clock, Trophy, TreePine, VolumeX, Heart, Users2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateActivityDialog } from '@/components/aktiva/create-activity-dialog';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createActivity, joinActivity, searchActivitiesBySemanticVector, castActivityVote, votePlace, updateUserLocation } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { collection, query, where, getDocs, onSnapshot, orderBy, limit, startAfter, doc, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { debugWarn, debugError } from '@/lib/debug';
import { ActivityListItem } from "@/components/aktiva/activity-list-item";
import { PremiumUpgradeModal } from '@/components/premium/PremiumUpgradeModal';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { usePlanningMode } from '@/contexts/planning-mode-context';
import { LocationSearchDialog } from '@/components/common/LocationSearchDialog';
import { useFavorites } from '@/contexts/favorites-context';
import useSWRInfinite from 'swr/infinite';
import { GEOAPIFY_API_KEY } from '@/lib/config';
import { GLOBAL_EXCLUDE_STRING, applyFilters } from '@/lib/geoapify';
import { calculateRelevance, rankPlacesPipeline } from '@/lib/ranking';
import { Slider } from '@/components/ui/slider';
import { cn, formatFirstName } from '@/lib/utils';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { UserBadge } from '@/components/common/UserBadge';
import { calculateDistance } from '@/lib/geo-utils';
import { useLanguage } from '@/hooks/use-language';
import { LocationRequirementDialog } from '@/components/common/LocationRequirementDialog';
import { getFeedCacheKey, getFeedCache, setFeedCache } from '@/lib/feed-cache';
import { trackInteraction } from '@/lib/telemetry';
import { isDuplicate } from '@/lib/duplicate-detector';
import { monitoring } from '@/lib/monitoring';

// Dynamic import for MapView to avoid SSR issues
const MapView = dynamic(() => import('@/components/aktiva/map-view').then(mod => mod.MapView), {
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

const PREMIUM_FILTERS = [
  { id: 'only_open_now', label: 'Jetzt Offen', labelEn: 'Open Now', icon: Clock },
  { id: 'hidden_gems', label: 'Geheimtipps', labelEn: 'Hidden Gems', icon: Compass },
  { id: 'high_rated', label: 'Top Bewertet', labelEn: 'Top Rated', icon: Trophy },
  { id: 'outdoor_only', label: 'Nur Draußen', labelEn: 'Outdoor Only', icon: TreePine },
  { id: 'quiet_places', label: 'Ruhige Orte', labelEn: 'Quiet Places', icon: VolumeX },
  { id: 'date_ideas', label: 'Date Ideen', labelEn: 'Date Ideas', icon: Heart },
  { id: 'group_activities', label: 'Gruppen-Aktivitäten', labelEn: 'Group Activities', icon: Users2 },
];

const placeDetailsCache = new Map<string, string[]>();

export default function Home() {
  const ENABLE_NEW_RANKING_PIPELINE = true;
  const sessionEpochRef = useRef(Date.now());
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
  const [visibleCount, setVisibleCount] = useState(PLACES_PER_PAGE);
  const [actionSheetPlace, setActionSheetPlace] = useState<Place | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [shouldFilterByName, setShouldFilterByName] = useState(false);
  const [isSwitchingTab, setIsSwitchingTab] = useState(false);
  const [showLocationRequirement, setShowLocationRequirement] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const [activePremiumFilters, setActivePremiumFilters] = useState<string[]>([]);

  const isOpenNow = (openingHours: string | null | undefined): boolean => {
    if (!openingHours) return false;
    if (openingHours.toLowerCase().includes('24/7')) return true;

    try {
      const now = new Date();
      const dayNames = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
      const currentDay = dayNames[now.getDay()];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const parts = openingHours.toLowerCase().split(';');
      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        let daysMatch = false;
        const dayRangeRegex = /([a-z]{2})\s*-\s*([a-z]{2})/;
        const singleDayRegex = /\b([a-z]{2})\b/g;

        const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
        if (!timeMatch) continue;

        const startMin = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
        const endMin = parseInt(timeMatch[3], 10) * 60 + parseInt(timeMatch[4], 10);

        const dayRange = trimmed.match(dayRangeRegex);
        if (dayRange) {
          const startDayIdx = dayNames.indexOf(dayRange[1]);
          const endDayIdx = dayNames.indexOf(dayRange[2]);
          if (startDayIdx !== -1 && endDayIdx !== -1) {
            const todayIdx = now.getDay();
            if (startDayIdx <= endDayIdx) {
              daysMatch = todayIdx >= startDayIdx && todayIdx <= endDayIdx;
            } else {
              daysMatch = todayIdx >= startDayIdx || todayIdx <= endDayIdx;
            }
          }
        } else {
          const singleDays = Array.from(trimmed.matchAll(singleDayRegex)).map(m => m[1]);
          if (singleDays.length > 0) {
            daysMatch = singleDays.includes(currentDay);
          } else {
            daysMatch = true;
          }
        }

        if (daysMatch) {
          if (endMin < startMin) {
            if (currentMinutes >= startMin || currentMinutes <= endMin) {
              return true;
            }
          } else {
            if (currentMinutes >= startMin && currentMinutes <= endMin) {
              return true;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error parsing opening hours:', err);
    }
    return false;
  };

  const handlePremiumFilterClick = (filterId: string) => {
    const isUserPremium = hasPremiumFeature(userProfile, 'advanced_filters');
    if (!isUserPremium) {
      setIsPremiumUpsellOpen(true);
      return;
    }

    setActivePremiumFilters(prev =>
      prev.includes(filterId)
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 750); // Live-Search Debounce (requested 500-800ms)
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  useEffect(() => {
    const isUserPremium = hasPremiumFeature(userProfile, 'advanced_filters');
    if (!isUserPremium && activePremiumFilters.length > 0) {
      setActivePremiumFilters([]);
    }
  }, [userProfile, activePremiumFilters]);

  const router = useRouter();
  const { planningState } = usePlanningMode();
  const { favorites } = useFavorites();
  const [isMobile, setIsMobile] = useState(false);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const { reverseGeocode: geoapifyReverse } = await import('@/lib/geoapify');
      const place = await geoapifyReverse(lat, lng);

      if (place) {
        // Geoapify properties usually contain city or address components
        const props = (place as any)._rawProperties || {};
        const city = props.city || props.town || props.village || props.suburb || props.municipality || place.name || (language === 'de' ? 'Unbekannter Ort' : 'Unknown Place');

        setCityName(city);

        if (user?.uid) {
          updateUserLocation(user.uid, lat, lng, city);
        }

        // Cache location for ultra-fast boot on next visit
        localStorage.setItem('aktiva_last_location', JSON.stringify({
          lat, lng, city, timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
      setCityName(language === 'de' ? 'Unbekannter Ort' : 'Unknown Place');
    }
  }, [language, user?.uid]);

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
  const isAktivCategory = activeTabId === "Active";

  // MULTI-SOURCE FETCHER (Geoapify vs Firestore)
  const multiFetcher = async (key: any) => {
    if (!key) return null;
    const { type, cursorValue } = key;
    const startTime = Date.now();

    try {
      let result: any = null;
      if (type === 'geoapify') {
        const { url } = key;
        result = await fetcher(url);
      } else if (type === 'multi_fetch_discovery') {
        // Parallel multi-fetch: 3 requests with broad categories, limit=30 each to conserve credits (progressive loading).
        const { lat, lng, radiusMeters: r } = key;
        const base = `https://api.geoapify.com/v2/places?filter=circle:${lng},${lat},${r}&bias=proximity:${lng},${lat}&limit=30&offset=0&apiKey=${GEOAPIFY_API_KEY}`;

        const categoryBuckets = [
          // Bucket 1: Adventure & Specific Entertainment
          "entertainment.zoo,entertainment.cinema,entertainment.water_park,sport.swimming_pool,entertainment.miniature_golf,entertainment.bowling_alley,entertainment.aquarium,entertainment.escape_game,entertainment.activity_park,entertainment.activity_park.trampoline,entertainment.amusement_arcade",
          // Bucket 2: General Leisure, Sport & Tourism
          "entertainment,leisure,adult.nightclub,sport,tourism",
          // Bucket 3: Catering & Heritage
          "catering,heritage",
        ];

        const results = await Promise.all(
          categoryBuckets.map(cats =>
            fetcher(`${base}&categories=${cats}`).catch(() => ({ features: [] }))
          )
        );

        // Deduplicate by place_id across all buckets
        const seenIds = new Set<string>();
        const merged: any[] = [];
        for (const res of results) {
          const features = res?.features || [];
          for (const f of features) {
            const pid = f.properties?.place_id;
            if (pid && !seenIds.has(pid)) {
              seenIds.add(pid);
              merged.push(f);
            }
          }
        }

        result = { features: merged };
      } else if (type === 'geocoding') {
        const { url } = key;
        const res = await fetcher(url);
        const results = res.results || [];

        // Enrichment: Geocoding V1 lacks detailed categories. We fetch them for the top 8 results
        // instead of 20, using a cache to avoid duplicate place details requests.
        const detailedFeatures = await Promise.all(results.slice(0, 8).map(async (item: any) => {
          let categories = item.categories || [];
          if (item.place_id) {
            if (placeDetailsCache.has(item.place_id)) {
              categories = placeDetailsCache.get(item.place_id)!;
            } else {
              try {
                const detailsUrl = `https://api.geoapify.com/v2/place-details?id=${item.place_id}&apiKey=${GEOAPIFY_API_KEY}`;
                const dRes = await fetch(detailsUrl);
                if (dRes.ok) {
                  const dData = await dRes.json();
                  categories = dData.features?.[0]?.properties?.categories || categories;
                  placeDetailsCache.set(item.place_id, categories);
                }
              } catch (e) {
                console.error("Detail enrichment failed for:", item.place_id, e);
              }
            }
          }
          // Normalize to GeoJSON-like structure for compatibility with places memo
          return {
            properties: {
              ...item,
              categories
            }
          };
        }));

        result = { features: detailedFeatures };
      } else if (type === 'activities') {
        const queryLimit = 300; // Fetch a large batch to avoid needing a composite index for pagination
        const constraints: any[] = [
          where('categories', 'array-contains', 'user_event'),
          limit(queryLimit)
        ];
        // We cannot use startAfter without orderBy, so we just fetch the first 300 and sort locally
        const q = query(collection(db!, 'activities'), ...constraints);
        const snap = await getDocs(q);
        result = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (type === 'active_places') {
        const queryLimit = key.pageIndex === 0 ? 50 : 10;
        const constraints: any[] = [
          where('activityCount', '>', 0),
          orderBy('activityCount', 'desc'),
          limit(queryLimit)
        ];
        if (cursorValue !== null) constraints.push(startAfter(cursorValue));
        const q = query(collection(db!, 'places'), ...constraints);
        const snap = await getDocs(q);
        result = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (type === 'highlights') {
        const queryLimit = key.pageIndex === 0 ? 50 : 10;
        const constraints: any[] = [
          where('upvotes', '>', 0),
          orderBy('upvotes', 'desc'),
          limit(queryLimit)
        ];
        if (cursorValue !== null) constraints.push(startAfter(cursorValue));
        const q = query(collection(db!, 'places'), ...constraints);
        const snap = await getDocs(q);
        result = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      if (type === 'geoapify' || type === 'multi_fetch_discovery' || type === 'geocoding') {
        monitoring.logRequest(Date.now() - startTime, true);
      }
      return result;
    } catch (error: any) {
      console.error("🔥 FIRESTORE QUERY ERROR:", error.message, "Key:", key);
      if (type === 'geoapify' || type === 'multi_fetch_discovery' || type === 'geocoding') {
        monitoring.logRequest(Date.now() - startTime, false);
      }
      throw error;
    }

    return null;
  };

  const GEOAPIFY_MAX_OFFSET = 500;

  const getKey = (pageIndex: number, previousPageData: any) => {
    if (isFavoritesCategory) return null;
    if (previousPageData && (
      (previousPageData.features && previousPageData.features.length === 0) ||
      (Array.isArray(previousPageData) && previousPageData.length === 0)
    )) return null;

    if (isCommunityCategory) {
      const cursor = pageIndex === 0 ? null : previousPageData[previousPageData.length - 1]?.createdAt;
      return { type: 'activities', subType: 'community', cursorValue: cursor, pageIndex };
    }

    if (isAktivCategory) {
      const cursor = pageIndex === 0 ? null : previousPageData[previousPageData.length - 1]?.activityCount;
      return { type: 'active_places', cursorValue: cursor, pageIndex };
    }

    if (isHighlightsCategory) {
      const cursor = pageIndex === 0 ? null : previousPageData[previousPageData.length - 1]?.upvotes;
      return { type: 'highlights', cursorValue: cursor, pageIndex };
    }
    if (!userLocation) return null;

    const radiusMeters = maxDistance ? maxDistance * 1000 : 100000;

    // CRITICAL: Pause fetching while the LLM is determining the intent/categories.
    // This prevents "Endless fetches of default categories" while the search is starting.
    if (debouncedSearchQuery && activeCategory.length === 0 && isSearching) {
      return null;
    }

    // PATH B: Specific Proper Names or Fallback Name Search
    if (shouldFilterByName && debouncedSearchQuery) {
      if (pageIndex > 0) return null;
      // Smart Radius: If we are in fallback mode (categories were found but returned 0), 
      // we expand the search radius to 5x to find something relevant further away.
      const fallbackRadius = (activeCategory.length > 0) ? Math.min(radiusMeters * 5, 100000) : radiusMeters;
      const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(debouncedSearchQuery)}&filter=circle:${userLocation.lng},${userLocation.lat},${fallbackRadius}&bias=proximity:${userLocation.lng},${userLocation.lat}&format=json&apiKey=${GEOAPIFY_API_KEY}`;
      return { type: 'geocoding', url, pageIndex };
    }

    // Default categories are ONLY for discovery (no category AND no search text).
    const rawCategories: string[] = activeCategory.length > 0
      ? activeCategory
      : (debouncedSearchQuery ? [] : [
        "entertainment",
        "adult.nightclub",
        "sport.stadium",
        "sport.ice_rink",
        "entertainment.escape_game",
        "leisure",
        "sport",
        "tourism.attraction"
      ]);

    const categoriesToFetch = rawCategories.map(tag => tag.trim()).filter(Boolean);

    // If we have a search query but NO categories to fetch (and we are NOT in Name-Search mode above),
    // we return null to avoid 400 Bad Request.
    if (debouncedSearchQuery && categoriesToFetch.length === 0 && !isSearching) {
      return null;
    }

    // ═══════════════════════════════════════════════════════════════
    // MULTI-FETCH PARALLEL DISCOVERY: Broad categories, max limits
    // ═══════════════════════════════════════════════════════════════

    // When a specific tab/category filter is active, use single-stream (reduced limits)
    if (activeCategory.length > 0) {
      const queryLimit = pageIndex === 0 ? 50 : 25;
      const offset = pageIndex === 0 ? 0 : 50 + (pageIndex - 1) * 25;
      const categoryString = categoriesToFetch.join(',');
      const url = `https://api.geoapify.com/v2/places?categories=${categoryString}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=${queryLimit}&offset=${offset}&apiKey=${GEOAPIFY_API_KEY}`;
      return { type: 'geoapify', url, pageIndex };
    }

    // Discovery mode: Parallel multi-fetch with broad top-level categories
    if (pageIndex === 0) {
      return {
        type: 'multi_fetch_discovery',
        lat: userLocation.lat,
        lng: userLocation.lng,
        radiusMeters,
        pageIndex,
      };
    }

    // Subsequent pages: standard paginated stream starting at offset 90 (since first page fetches less)
    const allCategories = "entertainment,leisure,sport,tourism,catering,adult.nightclub";
    const offset = 90 + (pageIndex - 1) * 50;
    const url = `https://api.geoapify.com/v2/places?categories=${allCategories}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=50&offset=${offset}&apiKey=${GEOAPIFY_API_KEY}`;
    return { type: 'geoapify', url, pageIndex };
  }

  const { data, size, setSize, isValidating, error } = useSWRInfinite(getKey, multiFetcher, {
    revalidateFirstPage: false,
    dedupingInterval: 300000, // Increase deduping interval to 5 mins to prevent redundant API queries
  });

  const [cachedData, setCachedData] = useState<any[] | undefined>(undefined);

  // Load cached data
  useEffect(() => {
    if (!userLocation) return;
    const cacheKey = getFeedCacheKey({
      lat: userLocation.lat,
      lng: userLocation.lng,
      activeCategory,
      activeTabId,
      debouncedSearchQuery,
    });
    const entry = getFeedCache(cacheKey);
    if (entry) {
      setCachedData(entry.data);
      monitoring.logCacheHit();
    } else {
      setCachedData(undefined);
    }
  }, [userLocation, activeCategory, activeTabId, debouncedSearchQuery]);

  // Save SWR data to cache
  useEffect(() => {
    if (!data || !userLocation || isValidating) return;
    const cacheKey = getFeedCacheKey({
      lat: userLocation.lat,
      lng: userLocation.lng,
      activeCategory,
      activeTabId,
      debouncedSearchQuery,
    });
    setFeedCache(cacheKey, data);
  }, [data, userLocation, activeCategory, activeTabId, debouncedSearchQuery, isValidating]);

  const displayData = data || cachedData;

  const isLoadingInitialData = !displayData && !error;
  const isEmpty = displayData?.[0]?.features ? displayData[0].features.length === 0 : (displayData?.[0]?.length === 0);
  const isFetchingNextPage = Boolean(size > 0 && displayData && typeof displayData[size - 1] === "undefined");

  const isReachingEnd = useMemo(() => {
    if (error) return true;
    if (isEmpty) return true;
    if (!displayData || displayData.length === 0) return false;
    const lastPage = displayData[displayData.length - 1];
    const expectedLimit = (displayData.length - 1) === 0 ? 50 : 50;
    if (isCommunityCategory || isAktivCategory || isHighlightsCategory) {
      // All three system tabs (Community, Active, Highlights) now fetch 50 initially, then 10.
      let fbLimit = (displayData.length - 1) === 0 ? 50 : 10;
      return Boolean(lastPage && lastPage.length < fbLimit);
    }
    return Boolean(lastPage && lastPage.features?.length < expectedLimit);
  }, [displayData, isEmpty, error, isCommunityCategory, isAktivCategory, isHighlightsCategory]);

  const [votesMap, setVotesMap] = useState<Record<string, { upvotes: number; downvotes: number; weightedUpvotes: number; weightedDownvotes: number; voteBoostScore: number }>>({});

  const basePlaces = useMemo(() => {
    if (!displayData || isCommunityCategory || isFavoritesCategory) return [];
    if (isHighlightsCategory || isAktivCategory) {
      return displayData.flat().map((place: any) => {
        let distance = place.distance;
        if (distance === undefined && userLocation && place.lat && place.lon) {
          distance = calculateDistance(userLocation.lat, userLocation.lng, place.lat, place.lon);
        }
        return { ...place, distance } as Place;
      });
    }

    return displayData.flatMap(page => {
      const features = page?.features || [];
      const itemsToFilter = features.map((f: any) => ({
        tags: Array.isArray(f.properties.categories) ? f.properties.categories : [f.properties.categories],
        properties: f.properties,
        distance: (f.properties.distance || 0) / 1000
      }));

      const distanceCappedItems = maxDistance
        ? itemsToFilter.filter((item: any) => item.distance <= maxDistance)
        : itemsToFilter;

      const safeItems = applyFilters(distanceCappedItems, activeCategory, userProfile?.blacklist?.hard || [], shouldFilterByName);

      return safeItems.map((item: any) => {
        const props = item.properties;
        let rating;
        if (props.datasource?.raw?.rating) {
          const parsedRating = parseFloat(props.datasource.raw.rating);
          if (!isNaN(parsedRating)) rating = Math.max(0, Math.min(5, parsedRating));
        }
        const cats = Array.isArray(props.categories) ? props.categories : [props.categories];
        const distance = item.distance || 0;
        return {
          id: props.place_id,
          name: props.name || props.address_line1 || (language === "de" ? "Unbekannter Ort" : "Unknown Place"),
          address: props.address_line2 || (language === "de" ? "Keine Adresse verfügbar" : "No address available"),
          categories: cats,
          lat: props.lat,
          lon: props.lon,
          rating: rating,
          distance: distance,
          openingHours: props.opening_hours || props.datasource?.raw?.opening_hours || null
        } as Place;
      });
    });
  }, [displayData, isCommunityCategory, isAktivCategory, isHighlightsCategory, isFavoritesCategory, language, userProfile, userLocation, activeCategory, maxDistance]);

  const places = useMemo(() => {
    if (basePlaces.length === 0) return [];

    let finalPlaces: Place[] = [];
    if (ENABLE_NEW_RANKING_PIPELINE) {
      const placesWithVotes = basePlaces.map(place => {
        const votes = votesMap[place.id] || { upvotes: 0, downvotes: 0, weightedUpvotes: 0, weightedDownvotes: 0, voteBoostScore: 0 };
        return {
          ...place,
          upvotes: votes.upvotes,
          downvotes: votes.downvotes,
          voteBoostScore: votes.voteBoostScore
        };
      });

      const ranked = rankPlacesPipeline(
        placesWithVotes,
        userProfile || { role: 'user' } as any,
        userLocation,
        sessionEpochRef.current,
        { debug: false }
      );

      // Filter duplicates
      for (const place of ranked) {
        if (!finalPlaces.some(u => isDuplicate(u, place))) {
          finalPlaces.push(place);
        }
      }
    } else {
      const scored = basePlaces.map(place => {
        const votes = votesMap[place.id] || { upvotes: 0, downvotes: 0, weightedUpvotes: 0, weightedDownvotes: 0, voteBoostScore: 0 };
        const rawScore = calculateRelevance(
          { ...place, upvotes: votes.upvotes, downvotes: votes.downvotes, voteBoostScore: votes.voteBoostScore },
          userProfile || { role: 'user' } as any,
          userLocation || { lat: 0, lng: 0 },
          { debug: false }
        );
        // Guard: ensure score is always a finite number — prevents string-coercion sort bugs
        const relevanceScore = typeof rawScore === 'number' && isFinite(rawScore) ? rawScore : 0;
        return { ...place, relevanceScore };
      });

      // Strict descending sort by numeric score
      scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Filter duplicates
      for (const place of scored) {
        if (!finalPlaces.some(u => isDuplicate(u, place))) {
          finalPlaces.push(place);
        }
      }
    }

    // Apply activePremiumFilters if user is Premium
    if (activePremiumFilters.length > 0 && hasPremiumFeature(userProfile, 'advanced_filters')) {
      finalPlaces = finalPlaces.filter(place => {
        return activePremiumFilters.every(filterId => {
          if (filterId === 'only_open_now') {
            return isOpenNow(place.openingHours);
          }
          if (filterId === 'hidden_gems') {
            const hasRatingMatch = typeof place.rating === 'number' && place.rating >= 4.2;
            const hasVotesMatch = typeof place.upvotes === 'number' && place.upvotes >= 1 && (!place.downvotes || place.downvotes === 0);
            return (hasRatingMatch || hasVotesMatch) && !place.categories.some(cat => cat.startsWith('tourism.attraction'));
          }
          if (filterId === 'high_rated') {
            return typeof place.rating === 'number' && place.rating >= 4.4;
          }
          if (filterId === 'outdoor_only') {
            return place.categories.some(cat =>
              cat.includes('outdoor') || cat.includes('nature') || cat.includes('park') || cat.includes('beach') || cat.includes('zoo')
            );
          }
          if (filterId === 'quiet_places') {
            return place.categories.every(cat =>
              !['party', 'nightclub', 'bar', 'pub', 'stadium', 'arcade', 'casino', 'entertainment'].some(bad => cat.includes(bad))
            );
          }
          if (filterId === 'date_ideas') {
            return place.categories.some(cat =>
              ['catering.restaurant', 'catering.cafe', 'catering.bar', 'entertainment.cinema', 'tourism.sights', 'entertainment.museum', 'leisure.spa'].some(target => cat === target || cat.startsWith(target + '.'))
            );
          }
          if (filterId === 'group_activities') {
            return place.categories.some(cat =>
              ['sport', 'entertainment.escape_game', 'entertainment.bowling_alley', 'entertainment.miniature_golf', 'entertainment.theme_park', 'sport.stadium'].some(target => cat === target || cat.startsWith(target + '.'))
            );
          }
          return true;
        });
      });
    }


    monitoring.logFeedSize(finalPlaces.length);
    return finalPlaces;
  }, [basePlaces, votesMap, userProfile, userLocation, activePremiumFilters]);

  // Live Vote-Daten: onSnapshot-Listener für alle sichtbaren Spot-IDs.
  // Wenn ein Vote eingeht (auch von anderen Usern/Admins), wird votesMap live aktualisiert
  // → places memo recalculated → Startseite automatisch neu sortiert.
  const basePlaceIdsKey = useMemo(() => {
    if (basePlaces.length === 0) return '';
    return [...new Set(basePlaces.map(p => p.id).filter(Boolean))].sort().join(',');
  }, [basePlaces]);

  useEffect(() => {
    if (!db || !basePlaceIdsKey) return;
    const placeIds = basePlaceIdsKey.split(',');
    if (placeIds.length === 0) return;

    const unsubscribes: (() => void)[] = [];
    const batchSize = 30; // Firestore 'in' query limit

    for (let i = 0; i < placeIds.length; i += batchSize) {
      const batch = placeIds.slice(i, i + batchSize);
      const q = query(collection(db!, 'places'), where(documentId(), 'in', batch));

      const unsub = onSnapshot(q, (snap) => {
        setVotesMap(prev => {
          const updated = { ...prev };
          let changed = false;
          snap.forEach(docSnap => {
            const d = docSnap.data();
            const newEntry = {
              upvotes: d.upvotes || 0,
              downvotes: d.downvotes || 0,
              weightedUpvotes: d.weightedUpvotes ?? d.upvotes ?? 0,
              weightedDownvotes: d.weightedDownvotes ?? d.downvotes ?? 0,
              voteBoostScore: d.voteBoostScore ?? ((d.weightedUpvotes ?? d.upvotes ?? 0) - (d.weightedDownvotes ?? d.downvotes ?? 0))
            };
            const existing = prev[docSnap.id];
            if (!existing ||
                existing.upvotes !== newEntry.upvotes ||
                existing.downvotes !== newEntry.downvotes ||
                existing.weightedUpvotes !== newEntry.weightedUpvotes ||
                existing.weightedDownvotes !== newEntry.weightedDownvotes ||
                existing.voteBoostScore !== newEntry.voteBoostScore) {
              updated[docSnap.id] = newEntry;
              changed = true;
            }
          });
          return changed ? updated : prev;
        });
      }, (error) => {
        console.error("Vote snapshot listener error:", error);
      });

      unsubscribes.push(unsub);
    }

    return () => unsubscribes.forEach(unsub => unsub());
  }, [basePlaceIdsKey]);

  const observer = useRef<IntersectionObserver | null>(null);
  const isLoadingMore = useRef(false);
  const lastElementRef = useCallback((node: any) => {
    if (observer.current) observer.current.disconnect();
    if (isReachingEnd || isFetchingNextPage || isValidating) return;
    const options = { rootMargin: '0px 0px -50px 0px', threshold: 1.0 };
    observer.current = new IntersectionObserver(entries => {
      const target = entries[0];
      if (target.isIntersecting && !isLoadingMore.current) {
        isLoadingMore.current = true;
        if (!isFavoritesCategory && !isCommunityCategory && !isAktivCategory && !isHighlightsCategory) {
          const totalFetched = displayData ? displayData.flat().length : 0;
          if (visibleCount < totalFetched) {
            setVisibleCount(prev => prev + PLACES_PER_PAGE);
          } else {
            setSize(prev => prev + 1);
            setVisibleCount(prev => prev + PLACES_PER_PAGE);
          }
        } else {
          setSize(prev => prev + 1);
        }
        setTimeout(() => { isLoadingMore.current = false; }, 1000);
      }
    }, options);
    if (node) observer.current.observe(node);
  }, [isFetchingNextPage, isReachingEnd, isValidating, setSize, displayData, visibleCount, isFavoritesCategory, isCommunityCategory, isAktivCategory, isHighlightsCategory]);

  const requestLocation = useCallback(() => {
    // Check for cached location for instant boot
    const cached = localStorage.getItem('aktiva_last_location');
    if (cached) {
      try {
        const { lat, lng, city, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        if (age < 4 * 60 * 60 * 1000) { // 4 hours TTL
          setUserLocation({ lat, lng });
          setCityName(city);
          setIsLocationLoading(false);
          // Still request fresh location in background
        }
      } catch (e) {
        localStorage.removeItem('aktiva_last_location');
      }
    }

    if (planningState.isPlanning && planningState.destination) {
      setUserLocation(planningState.destination);
      setCityName(planningState.destination.name);
      setIsLocationLoading(false);
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(location);
          setShowLocationRequirement(false);
          setIsLocationLoading(false);
          if (location.lat && location.lng) reverseGeocode(location.lat, location.lng);
        },
        (error) => {
          console.warn("Geolocation error:", error);
          setIsLocationLoading(false);
          setShowLocationRequirement(true);

          if (error.code === 1) { // PERMISSION_DENIED
            toast({
              title: language === 'de' ? "Standort blockiert" : "Location blocked",
              description: language === 'de' ? "Bitte aktiviere den Standortzugriff in deinen Browsereinstellungen." : "Please enable location access in your browser settings.",
              variant: "destructive"
            });
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    } else {
      setIsLocationLoading(false);
      setShowLocationRequirement(true);
    }
  }, [planningState, reverseGeocode, language, toast, userProfile]);

  useEffect(() => {
    if (user) {
      requestLocation();
    }
  }, [requestLocation, user]);

  const handleUseHomeLocation = () => {
    if (userProfile?.lastLocation) {
      const { lat, lng } = userProfile.lastLocation;
      setUserLocation({ lat, lng });
      reverseGeocode(lat, lng);
    } else {
      // Fallback to defaults
      setUserLocation({ lat: 53.5395, lng: 8.5809 });
      setCityName("Bremerhaven");
    }
    setShowLocationRequirement(false);
  };

  useEffect(() => {
    // Fallback termination: If we are specifically searching for a name, we don't fallback to defaults.
    if (shouldFilterByName) return;

    // ONLY do this fallback if the user actually typed a search query!
    // Otherwise, clicking a category with no results will incorrectly clear the category and show everything.
    if (!debouncedSearchQuery) return;

    const hasZeroResults = !isLoadingInitialData && !isValidating && activeCategory.length > 0 && places.length === 0;
    const hasError = !!error && activeCategory.length > 0;
    if (hasZeroResults || hasError) {
      setShouldFilterByName(true);
      setActiveCategory([]);
    }
  }, [isLoadingInitialData, isValidating, activeCategory, places.length, debouncedSearchQuery, error, shouldFilterByName]);

  const handleCategoryChange = (categoryId: string[], tabId: string) => {
    if (activeTabId !== tabId) {
      setIsSwitchingTab(true);
      setTimeout(() => setIsSwitchingTab(false), 800); // Guarantee skeleton animation for at least 800ms
    }
    setSearchQuery("");
    setShouldFilterByName(false);
    setActiveCategory(categoryId);
    setActiveTabId(tabId);
    setSortBy('recommended');
    setActivityCategoryFilter('Alle');
    setVisibleCount(PLACES_PER_PAGE);
  };

  // ---------------------------------------------------------------------------
  // SEARCH INTERCEPTOR — LLM-powered intent parser (Live-Search)
  // ---------------------------------------------------------------------------

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value.slice(0, 100));
  };

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const performSearch = async () => {
      const query = debouncedSearchQuery.trim();

      // Empty query → reset to discovery feed (broad defaults)
      if (!query) {
        setShouldFilterByName(false);
        setActiveCategory([]);
        return;
      }

      // Guard: Don't search for extremely short strings (API spam prevention)
      if (query.length < 2) return;

      setIsSearching(true);

      try {
        const response = await fetch('/api/parse-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal,
        });

        if (!response.ok) {
          const err = new Error(`HTTP ${response.status}`);
          (err as any).status = response.status;
          throw err;
        }
        const { categories, filterByName } = await response.json();

        // 1. Set the filter flag (determines if we do local .includes(name) filtering)
        setShouldFilterByName(!!filterByName);

        // 2. Set the categories (triggers SWR getKey)
        if (Array.isArray(categories) && categories.length > 0) {
          setActiveCategory(categories);
        } else {
          debugWarn('live-search', 'LLM returned no categories. Falling back to default category pool.');
          setActiveCategory([]);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        debugError('live-search', 'Intent Parsing Failed:', err);
        setShouldFilterByName(true); // Fallback to name filtering
        setActiveCategory([]);

        // User-friendly error message depending on error status
        let title = language === 'de' ? "Suche eingeschränkt" : "Search limited";
        let description = language === 'de' 
          ? "Wir konnten deine Suchanfrage nicht intelligent verarbeiten. Die Suche filtert nun nach dem Namen."
          : "We could not process your search query intelligently. Search is now filtering by name.";

        if (err.status === 429 || err.message?.includes('429')) {
          title = language === 'de' ? "Zu viele Anfragen" : "Too many requests";
          description = language === 'de'
            ? "Bitte warte einen Moment, bevor du erneut suchst."
            : "Please wait a moment before searching again.";
        }

        toast({
          variant: "destructive",
          title,
          description,
        });
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
    return () => controller.abort();
  }, [debouncedSearchQuery, language, toast]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Handled automatically by Live-Search useEffect
  };

  useEffect(() => {
    setVisibleCount(PLACES_PER_PAGE);
  }, [debouncedSearchQuery]);

  const handlePlaceSelect = useCallback((place: Place) => {
    setSelectedPlace(place);
    trackInteraction(place.id, place.categories, 'card_click', user?.uid);
    trackInteraction(place.id, place.categories, 'card_open', user?.uid);
  }, [user?.uid]);

  const handleDialogClose = () => setSelectedPlace(null);

  const handleOpenActivityModal = useCallback((place: Place) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setActionSheetPlace(place);
  }, [user, router]);
  const handleOpenCustomActivityModal = () => { if (!user) { router.push('/login'); return; } setActivityModalPlace('custom'); };

  const handleCreateActivity = async (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number, isBoosted?: boolean, isPaid?: boolean, price?: number, category?: ActivityCategory, description?: string, requirements?: any, joinMode?: 'direct' | 'request'): Promise<boolean> => {
    if (!user) return false;
    try {
      const isCustom = activityModalPlace === 'custom';
      const payload = isCustom
        ? { customLocationName: customLocationName!, startDate, endDate, user, isTimeFlexible, maxParticipants, isBoosted, isPaid, price, category: category!, description, requirements, joinMode }
        : { place: activityModalPlace as Place, startDate, endDate, user, isTimeFlexible, maxParticipants, isBoosted, isPaid, price, category: category!, description, requirements, joinMode };
      const newActivityRef = await createActivity(payload);
      setActivityModalPlace(null);
      router.push(`/chat/${newActivityRef.id}`);
      return true;
    } catch (error: any) {
      console.error("Error creating activity:", error);
      toast({
        variant: "destructive",
        title: language === 'de' ? "Fehler beim Erstellen" : "Error creating activity",
        description: error.message || String(error),
      });
      return false;
    }
  };

  const handleJoin = async (activityId: string) => {
    if (!user) { router.push('/login'); throw new Error('Login Required'); }
    try {
      const status = await joinActivity(activityId, user);
      if (status === 'joined') {
        router.push(`/chat/${activityId}`);
      } else {
        toast({ title: language === 'de' ? 'Anfrage gesendet!' : 'Request sent!', description: language === 'de' ? 'Der Host wird benachrichtigt.' : 'The host will be notified.' });
      }
    } catch (error: any) { 
        toast({ variant: 'destructive', title: 'Error', description: error });
        throw error; 
    }
  };

  const handleMapToggle = () => {
    if (!userProfile?.isPremium) {
      setIsPremiumUpsellOpen(true);
      return;
    }
    setViewMode('map');
  };

  const renderContent = () => {
    if (isLoadingInitialData || isSwitchingTab) {
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
          <Button onClick={() => {
            handleCategoryChange([], '');
            setShouldFilterByName(false);
            setSearchQuery("");
            setMaxDistance(10);
            setActivityCategoryFilter(language === 'de' ? 'Alle' : 'All');
          }} variant="outline" className="rounded-xl font-bold">
            {language === "de" ? "Filter zurücksetzen" : "Reset filters"}
          </Button>
        </div>
      </div>
    );

    if (viewMode === 'list') {
      const renderList = () => {
        if (isFavoritesCategory) {
          if (favorites.length === 0) {
            return <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center h-full"><div className="bg-primary/10 p-6 rounded-3xl"><Bookmark className="h-12 w-12 text-primary" /></div><h2 className="">{language === "de" ? "Noch keine Favoriten" : "No favorites yet"}</h2></div>;
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

        if (isCommunityCategory) {
          const rawList = data?.flat() || [];

          // Deduplicate the list to prevent React duplicate key errors from SWR caching edge cases
          const uniqueMap = new Map();
          for (const item of rawList) {
            if (item?.id) uniqueMap.set(item.id, item);
          }
          const list = Array.from(uniqueMap.values());

          // "es muss doch nur geguckt werden ob es user_event hat" -> This is already done by the database query in multiFetcher!
          // "und nach dem datum" -> We filter out activities that are already over (in the past).
          const now = Date.now();
          const filteredList = list.filter((item: any) => {
            if (!item) return false;

            // Filter out cancelled, completed, or blacklisted activities
            if (item.status === 'cancelled' || item.status === 'completed' || item.status === 'blacklisted') {
              return false;
            }

            // Filter out activities hosted by soft/hard blacklisted users, or in hiddenEntityIds
            const hostId = item.hostId;
            if (hostId && userProfile?.blacklist) {
              const hardBlocked = userProfile.blacklist.hard || [];
              const softBlocked = userProfile.blacklist.soft || [];
              if (hardBlocked.includes(hostId) || softBlocked.includes(hostId)) {
                return false;
              }
            }

            if (item.id && userProfile?.hiddenEntityIds?.includes(item.id)) {
              return false;
            }

            // Check end date or start date to ensure it's not in the past
            if (item.activityEndDate?.toMillis) {
              if (item.activityEndDate.toMillis() < now) return false;
            } else if (item.activityDate?.toMillis) {
              // If there's no end date, assume it's over 24 hours after the start date
              if (item.activityDate.toMillis() + 86400000 < now) return false;
            }

            return true;
          });

          // Sort by activityDate (ascending: upcoming events first)
          const sortedList = [...filteredList].sort((a, b) => {
            const timeA = a.activityDate?.toMillis ? a.activityDate.toMillis() : 0;
            const timeB = b.activityDate?.toMillis ? b.activityDate.toMillis() : 0;
            return timeA - timeB;
          });

          if (sortedList.length === 0 && !isFetchingNextPage) return <EmptySearchState />;
          return (
            <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {sortedList.map((item) => (
                <div key={item.id} className="min-h-[210px] w-full">
                  <ActivityListItem activity={item as any} user={user} onJoin={handleJoin} />
                </div>
              ))}
            </div>
          );
        }

        let filtered = places.filter(place => {
          if (userProfile?.hiddenEntityIds?.includes(place.id)) return false;
          if (!debouncedSearchQuery || !shouldFilterByName) return true;
          const rawName = place.name;
          const name = typeof rawName === 'string'
            ? rawName
            : (rawName && typeof rawName === 'object'
               ? ((rawName as any).de || (rawName as any).en || Object.values(rawName).find(v => typeof v === 'string') || '')
               : String(rawName || ''));
          return name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
        });

        // Add distance filter for Highlights and Active tabs
        if ((isHighlightsCategory || isAktivCategory) && maxDistance !== null) {
          filtered = filtered.filter(place => place.distance !== undefined && place.distance !== null && place.distance <= maxDistance);
        }

        // SCHRITT 1: Deduplizierung ZUERST (damit die Sortierung danach das letzte Wort hat)
        // Da 'filtered' bereits absteigend nach relevanceScore sortiert ist, behalten wir das erste (höchst-scorende) Vorkommen.
        const uniqueMap = new Map<string, Place>();
        filtered.forEach((place, index) => {
          const id = place.id ||
                     (place as any).place_id ||
                     (place as any).properties?.place_id ||
                     (place.name && place.lat !== undefined && place.lon !== undefined ? `${place.name}_${place.lat}_${place.lon}` : `fallback_index_${index}`);
          if (!uniqueMap.has(id)) {
            uniqueMap.set(id, place);
          }
        });
        const uniqueFiltered = Array.from(uniqueMap.values());

        // SCHRITT 2: Immutable Sort (spread erzeugt neue Array-Referenz, verhindert React-Mutations-Bugs)
        const sorted = [...uniqueFiltered].sort((a, b) => {
          if (sortBy === 'recommended') {
            return (b.relevanceScore || 0) - (a.relevanceScore || 0);
          }
          if (sortBy === 'rating') {
            return (b.rating || 0) - (a.rating || 0);
          }
          return 0;
        });
        if (sorted.length === 0) {
          if (isValidating) {
            return <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;
          }
          if (!isFetchingNextPage) return <EmptySearchState />;
        }
        const paginatedSorted = sorted.slice(0, visibleCount);
        return (
          <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {paginatedSorted.map((place) => (
              <div key={place.id} className="min-h-[210px] w-full">
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
            <div className="p-3 sm:p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6"><CardSkeleton /></div>
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
            <div className="bg-white dark:bg-neutral-800 p-8 rounded-full shadow-xl relative"><Lock className="h-12 w-12 text-neutral-400" /></div>
            <h2 className="">{language === 'de' ? 'Kartenansicht gesperrt' : 'Map View Locked'}</h2>
            <Button disabled className="rounded-2xl px-10 h-14 font-black bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 opacity-60 cursor-not-allowed">
              {language === 'de' ? 'Bald verfügbar' : 'Soon available'}
            </Button>
          </div>
        );
      }
      return <MapView places={places} userLocation={userLocation} onPlaceSelect={handlePlaceSelect} />;
    }
  };

  return (
    <>
      <div className="flex flex-col h-full bg-transparent relative">
        <div className="absolute top-[10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-[20%] right-[-10%] w-[35%] h-[35%] bg-violet-400/5 rounded-full blur-[100px] pointer-events-none" />
        <header className="global-viewport-header pb-4 md:pb-3">
          <div className="flex flex-col gap-6 md:gap-4 max-w-7xl mx-auto w-full">
            {/* Mobile Header Layout */}
            <div className="md:hidden flex flex-col gap-6">
              <div className="global-header-container">
                <div className="flex items-center gap-3">
                  <Link href="/profile">
                    <ProfileAvatar
                      className="h-10 w-10 border-2 border-white dark:border-neutral-800 shadow-xl shadow-primary/10 transition-transform active:scale-95 cursor-pointer"
                      photoURL={userProfile?.photoURL}
                      displayName={userProfile?.displayName}
                      isPremium={userProfile?.isPremium}
                      isCreator={userProfile?.isCreator}
                      isSupporter={userProfile?.isSupporter}
                    />
                  </Link>
                  <h1 className="">{language === "de" ? `Hallo, ${formatFirstName(userProfile?.displayName, 'Du')} 👋` : `Hi, ${formatFirstName(userProfile?.displayName, 'You')} 👋`}</h1>
                </div>
                <div className="flex items-center gap-3">
                  <NotificationBell />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="secondary-header-button" 
                    onClick={handleMapToggle}
                    aria-label={viewMode === 'list' ? (language === 'de' ? 'Zur Kartenansicht wechseln' : 'Switch to map view') : (language === 'de' ? 'Zur Listenansicht wechseln' : 'Switch to list view')}
                  >
                    {viewMode === 'list' ? <Globe className="h-5 w-5" /> : <List className="h-5 w-5" />}
                  </Button>
                </div>
              </div>

              {/* Mobile Location Row */}
              <div className="px-6 flex items-center justify-start">
                <button onClick={() => setIsLocationSearchOpen(true)} className="flex items-center gap-1.5 bg-slate-100 dark:bg-neutral-800/50 py-2 px-4 rounded-full transition-all hover:bg-slate-200 dark:hover:bg-neutral-800">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-neutral-600 dark:text-neutral-400 uppercase tracking-widest">{cityName}</span>
                  <ChevronDown className="h-3 w-3 text-neutral-400" />
                </button>
              </div>
            </div>

            {/* Desktop Unified Header Row */}
            <div className="hidden md:flex items-center justify-between gap-6 px-6 w-full">
              {/* Left: Avatar, Name & Location Dropdown Inline */}
              <div className="flex items-center gap-3 shrink-0">
                <Link href="/profile">
                  <ProfileAvatar
                    className="h-10 w-10 border-2 border-white dark:border-neutral-800 shadow-xl shadow-primary/10 transition-transform active:scale-95 cursor-pointer"
                    photoURL={userProfile?.photoURL}
                    displayName={userProfile?.displayName}
                    isPremium={userProfile?.isPremium}
                    isCreator={userProfile?.isCreator}
                    isSupporter={userProfile?.isSupporter}
                  />
                </Link>
                <div className="flex flex-col">
                  <h1 className="text-xl font-black leading-tight">{language === "de" ? `Hallo, ${formatFirstName(userProfile?.displayName, 'Du')} 👋` : `Hi, ${formatFirstName(userProfile?.displayName, 'You')} 👋`}</h1>
                  <button onClick={() => setIsLocationSearchOpen(true)} className="flex items-center gap-1.5 mt-0.5 self-start hover:opacity-80 transition-opacity">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">{cityName}</span>
                    <ChevronDown className="h-2.5 w-2.5 text-neutral-400" />
                  </button>
                </div>
              </div>

              {/* Center: Search input & Radius selector */}
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <form onSubmit={handleSearchSubmit} className="flex relative flex-1 group">
                  {isSearching ? <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500 animate-spin" /> : <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300 group-focus-within:text-emerald-500 transition-colors" />}
                  <Input 
                    type="search" 
                    id="search-input-desktop"
                    aria-label={language === "de" ? "Aktivitätssuche" : "Activity search"}
                    placeholder={language === "de" ? "Was möchtest du unternehmen?" : "What do you want to do?"} 
                    value={searchQuery} 
                    onChange={handleSearchInput} 
                    disabled={isSearching} 
                    className="w-full pl-9 h-11 rounded-full border-none bg-white font-bold text-xs shadow-md shadow-slate-200/40 transition-all focus-visible:ring-4 focus-visible:ring-emerald-500/10 dark:bg-neutral-800 dark:text-neutral-100 dark:shadow-none disabled:opacity-70 placeholder:text-neutral-400" 
                  />
                </form>
                <div className="relative group">
                  <DropdownMenu open={isRadiusOpen} onOpenChange={setIsRadiusOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" className="h-11 px-3 rounded-3xl bg-white dark:bg-neutral-800 border-none shadow-md shadow-slate-200/40 dark:shadow-none font-black text-emerald-500 text-xs flex items-center gap-1.5">{maxDistance === null ? (language === 'de' ? 'Überall' : 'Everywhere') : `${maxDistance} km`} <ChevronDown className={cn("h-3.5 w-3.5 opacity-30 transition-transform", isRadiusOpen && "rotate-180")} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 p-4 rounded-3xl border-none shadow-2xl">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-xs font-black uppercase text-slate-400">{language === 'de' ? 'Radius' : 'Radius'}</span><span className="text-sm font-black">{maxDistance === null ? '∞' : `${maxDistance} km`}</span></div>
                        <input type="range" min="1" max="100" value={maxDistance || 100} onChange={(e) => setMaxDistance(parseInt(e.target.value) === 100 ? null : parseInt(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                        <div className="grid grid-cols-4 gap-2">{[5, 10, 25, null].map((r) => <button key={r === null ? 'all' : r} onClick={() => setMaxDistance(r)} className={cn("py-2 rounded-xl text-[10px] font-black transition-all", maxDistance === r ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}>{r === null ? 'Alle' : `${r}k`}</button>)}</div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-3 shrink-0">
                <NotificationBell />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="secondary-header-button" 
                  onClick={handleMapToggle}
                  aria-label={viewMode === 'list' ? (language === 'de' ? 'Zur Kartenansicht wechseln' : 'Switch to map view') : (language === 'de' ? 'Zur Listenansicht wechseln' : 'Switch to list view')}
                >
                  {viewMode === 'list' ? <Globe className="h-5 w-5" /> : <List className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            <div className="px-6">
              <CategoryFilters activeCategory={activeCategory} activeTabId={activeTabId} onCategoryChange={handleCategoryChange} />
            </div>

            {/* Premium Advanced Filters Row */}
            <div className="px-6 -mt-2 pb-2">
              <div className="flex flex-nowrap overflow-x-auto md:flex-wrap md:overflow-x-visible gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar items-center w-full">
                {PREMIUM_FILTERS.map((f) => {
                  const isUserPremium = hasPremiumFeature(userProfile, 'advanced_filters');
                  const isActive = activePremiumFilters.includes(f.id) && isUserPremium;
                  return (
                    <Button
                      key={f.id}
                      onClick={() => handlePremiumFilterClick(f.id)}
                      variant={isActive ? "default" : "outline"}
                      aria-pressed={isActive}
                      className={cn(
                        "flex-shrink-0 flex items-center justify-center rounded-full h-8 px-4 text-[10px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 duration-200",
                        isActive
                          ? "bg-amber-500 hover:bg-amber-600 text-white border-none shadow-lg shadow-amber-500/20"
                          : "bg-white/80 dark:bg-neutral-800/80 border-slate-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300"
                      )}
                    >
                      {!isUserPremium && <Lock className="h-3 w-3 mr-1 text-amber-500 fill-amber-500/10 shrink-0" />}
                      {f.icon && <f.icon className={cn("h-3.5 w-3.5 mr-1 shrink-0", isActive ? "text-white" : "text-amber-500")} />}
                      <span className="whitespace-nowrap">{language === 'de' ? f.label : f.labelEn}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Search and Radius Row (Mobile only) */}
            <div className="px-6 md:hidden">
              <div className="flex items-center gap-3 w-full">
                <form onSubmit={handleSearchSubmit} className="flex relative flex-1 group">
                  {isSearching ? <Loader2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500 animate-spin" /> : <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-300 group-focus-within:text-emerald-500 transition-colors" />}
                  <Input 
                    type="search" 
                    id="search-input-mobile"
                    aria-label={language === "de" ? "Aktivitätssuche" : "Activity search"}
                    placeholder={language === "de" ? "Was möchtest du unternehmen?" : "What do you want to do?"} 
                    value={searchQuery} 
                    onChange={handleSearchInput} 
                    disabled={isSearching} 
                    className="w-full pl-9 h-14 rounded-full border-none bg-white font-bold text-xs shadow-xl shadow-slate-200/40 transition-all focus-visible:ring-4 focus-visible:ring-emerald-500/10 dark:bg-neutral-800 dark:text-neutral-100 dark:shadow-none disabled:opacity-70 placeholder:text-neutral-400" 
                  />
                </form>
                <div className="relative group">
                  <DropdownMenu open={isRadiusOpen} onOpenChange={setIsRadiusOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" className="h-14 px-3 rounded-3xl bg-white dark:bg-neutral-800 border-none shadow-xl shadow-slate-200/40 dark:shadow-none font-black text-emerald-500 text-xs flex items-center gap-1.5">{maxDistance === null ? (language === 'de' ? 'Überall' : 'Everywhere') : `${maxDistance} km`} <ChevronDown className={cn("h-3.5 w-3.5 opacity-30 transition-transform", isRadiusOpen && "rotate-180")} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 p-4 rounded-3xl border-none shadow-2xl">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center"><span className="text-xs font-black uppercase text-slate-400">{language === 'de' ? 'Radius' : 'Radius'}</span><span className="text-sm font-black">{maxDistance === null ? '∞' : `${maxDistance} km`}</span></div>
                        <input type="range" min="1" max="100" value={maxDistance || 100} onChange={(e) => setMaxDistance(parseInt(e.target.value) === 100 ? null : parseInt(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                        <div className="grid grid-cols-4 gap-2">{[5, 10, 25, null].map((r) => <button key={r === null ? 'all' : r} onClick={() => setMaxDistance(r)} className={cn("py-2 rounded-xl text-[10px] font-black transition-all", maxDistance === r ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}>{r === null ? 'Alle' : `${r}k`}</button>)}</div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className={`flex-1 w-full pb-24 ${viewMode === 'list' ? 'overflow-y-auto' : 'overflow-hidden scroll-smooth'}`}><div className="max-w-7xl mx-auto w-full">{renderContent()}</div></main>
      </div>
      <div className="fixed bottom-24 right-5 z-40 animate-in slide-in-from-bottom-4 fade-in duration-500"><Button variant="default" size="icon" className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-white shadow-xl shadow-primary/30 transition-transform hover:scale-105 active:scale-95" onClick={handleOpenCustomActivityModal}><Plus className="h-7 w-7" strokeWidth={3} /></Button></div>
      {isMobile ? (
        <Sheet open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}><SheetContent side="bottom" className="p-0 h-[92vh] w-full border-none rounded-t-[2.5rem] overflow-hidden outline-none"><SheetHeader className="sr-only"><SheetTitle>{selectedPlace?.name}</SheetTitle></SheetHeader><div className="h-full w-full">{selectedPlace && <PlaceDetails place={selectedPlace} onClose={handleDialogClose} onCreateActivity={() => setActivityModalPlace(selectedPlace)} />}</div></SheetContent></Sheet>
      ) : (
        <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && handleDialogClose()}><DialogContent className="p-0 w-full max-w-4xl max-h-[92vh] gap-0 overflow-hidden border-none outline-none"><DialogTitle className="sr-only">{selectedPlace?.name || (language === 'de' ? 'Ort Details' : 'Place Details')}</DialogTitle><DialogDescription className="sr-only">{language === 'de' ? 'Details zum ausgewählten Ort' : 'Details about the selected place'}</DialogDescription>{selectedPlace && <PlaceDetails place={selectedPlace} onClose={handleDialogClose} onCreateActivity={() => setActivityModalPlace(selectedPlace)} />}</DialogContent></Dialog>
      )}
      <CreateActivityDialog place={activityModalPlace === 'custom' ? null : activityModalPlace as Place} open={!!activityModalPlace} onOpenChange={(open) => !open && setActivityModalPlace(null)} onCreateActivity={handleCreateActivity} />
      <SpotActionSheet place={actionSheetPlace} open={!!actionSheetPlace} onOpenChange={(open) => !open && setActionSheetPlace(null)} onCreateNew={(place) => setActivityModalPlace(place)} />
      <LocationSearchDialog open={isLocationSearchOpen} onOpenChange={setIsLocationSearchOpen} />
      <LocationRequirementDialog
        open={showLocationRequirement}
        onOpenChange={setShowLocationRequirement}
        onRetry={requestLocation}
        onUseHomeLocation={handleUseHomeLocation}
        homeCity="Bremerhaven"
        isLoading={isLocationLoading}
        onSearchManually={() => {
          setShowLocationRequirement(false);
          setIsLocationSearchOpen(true);
        }}
      />
      <PremiumUpgradeModal
        isOpen={isPremiumUpsellOpen}
        onClose={() => setIsPremiumUpsellOpen(false)}
      />
    </>
  );
}
