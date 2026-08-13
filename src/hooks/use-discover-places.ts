'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWRInfinite from 'swr/infinite';
import type { Place, Activity } from '@/lib/types';
import { useLocation } from '@/contexts/location-context';
import { useAuth } from '@/hooks/use-auth';
import { useFavorites } from '@/contexts/favorites-context';
import { subscribeCommunityActivities } from '@/lib/firebase/firestore';

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || 'a34b22c7104d49a0a16efb4eeab1d48c';

const multiFetcher = async (keyObj: any) => {
  if (!keyObj) return [];
  if (keyObj.type === 'multi_fetch_discovery') {
    const { lat, lng, radiusMeters } = keyObj;
    const catGroup1 = "entertainment,adult.nightclub,sport.stadium,sport.ice_rink";
    const catGroup2 = "entertainment.escape_game,leisure,sport,tourism.attraction";

    const url1 = `https://api.geoapify.com/v2/places?categories=${catGroup1}&filter=circle:${lng},${lat},${radiusMeters}&bias=proximity:${lng},${lat}&limit=45&offset=0&apiKey=${GEOAPIFY_API_KEY}`;
    const url2 = `https://api.geoapify.com/v2/places?categories=${catGroup2}&filter=circle:${lng},${lat},${radiusMeters}&bias=proximity:${lng},${lat}&limit=45&offset=0&apiKey=${GEOAPIFY_API_KEY}`;

    try {
      const [res1, res2] = await Promise.all([fetch(url1), fetch(url2)]);
      const data1 = res1.ok ? await res1.json() : { features: [] };
      const data2 = res2.ok ? await res2.json() : { features: [] };

      const combinedFeatures = [...(data1.features || []), ...(data2.features || [])];
      return [{ features: combinedFeatures }];
    } catch (e) {
      return [{ features: [] }];
    }
  }

  const res = await fetch(keyObj.url);
  if (!res.ok) {
    throw new Error(`Geoapify API error: ${res.status}`);
  }
  return res.json();
};

export function useDiscoverPlaces() {
  const { position, cityName: resolvedCityName } = useLocation();
  const { userProfile } = useAuth();
  const { favorites } = useFavorites();

  const userLocation = useMemo(() => {
    return position ? { lat: position.latitude, lng: position.longitude } : null;
  }, [position]);

  const cityName = resolvedCityName || 'Aktueller Standort';

  const [activeCategory, setActiveCategory] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState<number | null>(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [communityActivities, setCommunityActivities] = useState<Activity[]>([]);
  const [isCommunityLoading, setIsCommunityLoading] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    if (previousPageData && (!previousPageData.features || previousPageData.features.length === 0)) return null;

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
    const url = `https://api.geoapify.com/v2/places?categories=${allCategories}&filter=circle:${userLocation.lng},${userLocation.lat},${radiusMeters}&bias=proximity:${userLocation.lng},${userLocation.lat}&limit=50&offset=${offset}&apiKey=${GEOAPIFY_API_KEY}`;
    return { type: 'geoapify', url, pageIndex };
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
    let filtered = rawPlaces.filter((place) => {
      if (userProfile?.hiddenEntityIds?.includes(place.id)) return false;
      if (!debouncedSearchQuery) return true;
      const rawName = place.name;
      const nameStr = typeof rawName === 'string'
        ? rawName
        : (rawName && typeof rawName === 'object'
          ? ((rawName as any).de || (rawName as any).en || '')
          : String(rawName || ''));
      return nameStr.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
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
  }, [rawPlaces, userProfile, debouncedSearchQuery, maxDistance]);

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
    isLoading: (!data && !error) || isCommunityLoading,
    error,
  };
}
