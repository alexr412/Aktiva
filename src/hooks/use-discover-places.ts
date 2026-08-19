'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWRInfinite from 'swr/infinite';
import type { Place, Activity } from '@/lib/types';
import { useLocation } from '@/contexts/location-context';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/contexts/favorites-context';
import { subscribeCommunityActivities } from '@/lib/firebase/firestore';
import { buildGeoapifyCategoriesParam, sanitizeUrlForLogging } from '@/lib/geoapify';
import {
  getCachedTilePlaces,
  saveTilePlaces,
  searchCachedPlaces,
  pruneExpiredCache,
} from '@/lib/cache/places-cache';

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || 'a34b22c7104d49a0a16efb4eeab1d48c';

const multiFetcher = async (keyObj: any) => {
  if (!keyObj) return [];

  if (keyObj.type === 'multi_fetch_discovery') {
    const { lat, lng, radiusMeters } = keyObj;

    // 1. Versuche zuerst, frische Daten aus dem lokalen IndexedDB-Cache zu laden
    const cachedPlaces = await getCachedTilePlaces(lat, lng, radiusMeters);
    if (cachedPlaces && cachedPlaces.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[GEOAPIFY CACHE HIT] Loaded ${cachedPlaces.length} places from IndexedDB for tile`);
      }
      return [{ features: cachedPlaces, _fromCache: true }];
    }

    const catGroup1 = "entertainment,adult.nightclub,sport.stadium,sport.ice_rink";
    const catGroup2 = "entertainment.escape_game,leisure,sport,tourism.attraction";

    const catParam1 = buildGeoapifyCategoriesParam(catGroup1);
    const catParam2 = buildGeoapifyCategoriesParam(catGroup2);

    const url1 = `https://api.geoapify.com/v2/places?${catParam1}&filter=circle:${lng},${lat},${radiusMeters}&bias=proximity:${lng},${lat}&limit=45&offset=0&apiKey=${GEOAPIFY_API_KEY}`;
    const url2 = `https://api.geoapify.com/v2/places?${catParam2}&filter=circle:${lng},${lat},${radiusMeters}&bias=proximity:${lng},${lat}&limit=45&offset=0&apiKey=${GEOAPIFY_API_KEY}`;

    try {
      const [res1, res2] = await Promise.all([fetch(url1), fetch(url2)]);
      const data1 = res1.ok ? await res1.json() : { features: [] };
      const data2 = res2.ok ? await res2.json() : { features: [] };

      const combinedFeatures = [...(data1.features || []), ...(data2.features || [])];

      // Nach erfolgreichem Laden: Orte asynchron im lokalen Cache speichern
      if (combinedFeatures.length > 0) {
        const placesToCache: Place[] = combinedFeatures.map((f: any, idx: number) => {
          const props = f.properties || f;
          const fLat = f.geometry?.coordinates?.[1] ?? props.lat;
          const fLon = f.geometry?.coordinates?.[0] ?? props.lon ?? props.lng;
          const id = props.place_id || props.id || `place_${idx}_${fLat}_${fLon}`;
          const name = props.name || props.formatted || 'Unbenannter Ort';
          return {
            id,
            name,
            address: props.address_line2 || props.formatted || props.street || '',
            categories: props.categories || [],
            lat: fLat,
            lon: fLon,
            distance: props.distance ? props.distance / 1000 : undefined,
            rating: props.rating || 4.5,
            relevanceScore: props.relevanceScore || 80,
          } as Place;
        });

        void saveTilePlaces(lat, lng, radiusMeters, placesToCache);
      }

      return [{ features: combinedFeatures }];
    } catch (e) {
      return [{ features: [] }];
    }
  }

  // Für Paginierungs-Anfragen: Auch prüfen, ob Kachel im Cache liegt
  if (keyObj.lat && keyObj.lng && keyObj.radiusMeters) {
    const cachedPlaces = await getCachedTilePlaces(keyObj.lat, keyObj.lng, keyObj.radiusMeters);
    if (cachedPlaces && cachedPlaces.length > 0) {
      return { features: [], _fromCache: true };
    }
  }

  const res = await fetch(keyObj.url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const safeUrl = sanitizeUrlForLogging(keyObj.url);
    if (process.env.NODE_ENV === 'development') {
      console.error('[GEOAPIFY ERROR]', {
        status: res.status,
        statusText: res.statusText,
        url: safeUrl,
        body,
      });
    }
    throw new Error(`Geoapify API error (${res.status}): ${body}`);
  }
  const data = await res.json();

  if (data?.features && Array.isArray(data.features) && keyObj.lat && keyObj.lng) {
    const placesToCache: Place[] = data.features.map((f: any, idx: number) => {
      const props = f.properties || f;
      const fLat = f.geometry?.coordinates?.[1] ?? props.lat;
      const fLon = f.geometry?.coordinates?.[0] ?? props.lon ?? props.lng;
      const id = props.place_id || props.id || `place_${idx}_${fLat}_${fLon}`;
      const name = props.name || props.formatted || 'Unbenannter Ort';
      return {
        id,
        name,
        address: props.address_line2 || props.formatted || props.street || '',
        categories: props.categories || [],
        lat: fLat,
        lon: fLon,
        distance: props.distance ? props.distance / 1000 : undefined,
        rating: props.rating || 4.5,
        relevanceScore: props.relevanceScore || 80,
      } as Place;
    });
    void saveTilePlaces(keyObj.lat, keyObj.lng, keyObj.radiusMeters || 10000, placesToCache);
  }

  return data;
};

export function useDiscoverPlaces() {
  const { position, cityName: resolvedCityName } = useLocation();
  const { userProfile } = useAuth();
  const { favorites } = useFavorites();

  const userLocation = useMemo(() => {
    if (!position) return null;
    const roundedLat = Math.round(position.latitude * 100) / 100;
    const roundedLng = Math.round(position.longitude * 100) / 100;
    return {
      lat: roundedLat,
      lng: roundedLng,
      rawLat: position.latitude,
      rawLng: position.longitude,
    };
  }, [position?.latitude, position?.longitude]);

  const cityName = resolvedCityName || 'Aktueller Standort';

  const [activeCategory, setActiveCategory] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState<number | null>(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [communityActivities, setCommunityActivities] = useState<Activity[]>([]);
  const [isCommunityLoading, setIsCommunityLoading] = useState(false);

  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearchingNetwork, setIsSearchingNetwork] = useState(false);

  // Veralteten Cache im Hintergrund aufräumen
  useEffect(() => {
    void pruneExpiredCache();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Hybride Suche (Erst Cache durchsuchen, bei Bedarf API-Abfrage nachladen)
  useEffect(() => {
    if (!debouncedSearchQuery.trim() || !userLocation) {
      setSearchResults([]);
      return;
    }

    let isMounted = true;
    const performSearch = async () => {
      // 1. Erst lokalen Cache durchsuchen
      const localMatches = await searchCachedPlaces(
        debouncedSearchQuery,
        userLocation.lat,
        userLocation.lng,
        maxDistance
      );

      if (!isMounted) return;
      setSearchResults(localMatches);

      // 2. Falls weniger als 5 lokale Treffer existieren, gezielt Geoapify-Suche aufrufen
      if (localMatches.length < 5) {
        setIsSearchingNetwork(true);
        try {
          const { searchTextPlaces } = await import('@/lib/geoapify');
          const onlinePlaces = await searchTextPlaces(
            debouncedSearchQuery,
            userLocation.lat,
            userLocation.lng
          );

          if (!isMounted) return;
          if (onlinePlaces && onlinePlaces.length > 0) {
            void saveTilePlaces(userLocation.lat, userLocation.lng, (maxDistance || 10) * 1000, onlinePlaces);
            const combinedMap = new Map<string, Place>();
            [...localMatches, ...onlinePlaces].forEach(p => combinedMap.set(p.id, p));
            setSearchResults(Array.from(combinedMap.values()));
          }
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[SEARCH NETWORK FALLBACK FAILED]', e);
          }
        } finally {
          if (isMounted) setIsSearchingNetwork(false);
        }
      }
    };

    void performSearch();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearchQuery, userLocation, maxDistance]);

  // Subscribe to Firestore Community Activities
  useEffect(() => {
    setIsCommunityLoading(true);
    const unsubscribe = subscribeCommunityActivities(
      (activities) => {
        setCommunityActivities(activities);
        setIsCommunityLoading(false);
      },
      (_err) => {
        setIsCommunityLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const radiusMeters = (maxDistance || 10) * 1000;

  const getKey = (pageIndex: number, previousPageData: any) => {
    if (!userLocation) return null;

    if (previousPageData) {
      const firstPage = Array.isArray(previousPageData) ? previousPageData[0] : previousPageData;
      if (firstPage?._fromCache) return null; // Keine Paginierung, wenn Seite 0 bereits aus dem Cache kam!
      if (!firstPage?.features || firstPage.features.length === 0) return null;
    }

    if (pageIndex === 0) {
      return {
        type: 'multi_fetch_discovery',
        lat: userLocation.lat,
        lng: userLocation.lng,
        radiusMeters,
        pageIndex,
      };
    }

    const allCategories = "entertainment,leisure,sport,tourism,catering,adult.nightclub";
    const offset = 90 + (pageIndex - 1) * 50;
    const catParam = buildGeoapifyCategoriesParam(allCategories);
    const url = `https://api.geoapify.com/v2/places?${catParam}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=50&offset=${offset}&apiKey=${GEOAPIFY_API_KEY}`;
    return { type: 'geoapify', url, pageIndex, lat: userLocation.lat, lng: userLocation.lng, radiusMeters };
  };

  const { data, isValidating, error } = useSWRInfinite(getKey, multiFetcher, {
    revalidateFirstPage: false,
    dedupingInterval: 300000,
  });

  // Extract raw parsed Places from SWR
  const rawPlaces = useMemo<Place[]>(() => {
    if (!data) return [];
    const allFeatures: any[] = [];
    data.forEach((page: any) => {
      if (Array.isArray(page?.features)) {
        allFeatures.push(...page.features);
      } else if (Array.isArray(page)) {
        allFeatures.push(...page);
      }
    });

    return allFeatures.map((f: any, idx: number) => {
      const props = f.properties || f;
      const lat = f.geometry?.coordinates?.[1] ?? props.lat;
      const lon = f.geometry?.coordinates?.[0] ?? props.lon ?? props.lng;
      const id = props.place_id || props.id || `place_${idx}_${lat}_${lon}`;
      const name = props.name || props.formatted || 'Unbenannter Ort';

      return {
        id,
        name,
        address: props.address_line2 || props.formatted || props.street || '',
        categories: props.categories || [],
        lat,
        lon,
        distance: props.distance ? props.distance / 1000 : undefined,
        rating: props.rating || 4.5,
        relevanceScore: props.relevanceScore || 80,
      } as Place;
    });
  }, [data]);

  // Apply hidden entity filtering, name search, and distance constraints
  const visiblePlaces = useMemo<Place[]>(() => {
    const baseList = debouncedSearchQuery.trim() ? [...rawPlaces, ...searchResults] : rawPlaces;

    let filtered = baseList.filter((place) => {
      if (userProfile?.hiddenEntityIds?.includes(place.id)) return false;
      if (!debouncedSearchQuery) return true;
      const rawName = place.name;
      const nameStr = typeof rawName === 'string'
        ? rawName
        : (rawName && typeof rawName === 'object'
          ? ((rawName as any).de || (rawName as any).en || '')
          : String(rawName || ''));
      const addrStr = place.address || '';
      const q = debouncedSearchQuery.toLowerCase();
      return nameStr.toLowerCase().includes(q) || addrStr.toLowerCase().includes(q);
    });

    if (maxDistance !== null) {
      filtered = filtered.filter((place) => place.distance === undefined || place.distance === null || place.distance <= maxDistance);
    }

    const uniqueMap = new Map<string, Place>();
    filtered.forEach((p, idx) => {
      const key = p.id || `${p.name}_${p.lat}_${p.lon}_${idx}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, p);
      }
    });

    return Array.from(uniqueMap.values());
  }, [rawPlaces, searchResults, userProfile, debouncedSearchQuery, maxDistance]);

  const finalFeedPlaces = useMemo<Place[]>(() => {
    return visiblePlaces;
  }, [visiblePlaces]);

  return {
    places: finalFeedPlaces,
    rawPlaces,
    visiblePlaces,
    communityActivities,
    userLocation,
    cityName,
    maxDistance,
    setMaxDistance,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    isLoading: (!data && !error && searchResults.length === 0) || isCommunityLoading || isSearchingNetwork,
    error,
  };
}
