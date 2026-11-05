'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWRImmutable from 'swr/immutable';
import { useLocation } from '@/contexts/location-context';
import { reverseGeocodeCity } from '@/lib/geoapify';

const FRESH_POSITION_MS = 60_000;
const CITY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function recoverLocationName(
  latitude: number,
  longitude: number,
  lookup = reverseGeocodeCity,
): Promise<string | null> {
  // Use the location provider's local cache for these coordinates.
  const key = `activa_city_cache_${Math.round(latitude * 100) / 100}_${Math.round(longitude * 100) / 100}`;
  try {
    const cached = JSON.parse(localStorage.getItem(key) ?? 'null');
    const city = typeof cached?.city === 'string' ? cached.city.trim() : '';
    if (city && typeof cached.ts === 'number' && Date.now() - cached.ts < CITY_CACHE_TTL_MS) return city;
  } catch {
    // A missing or blocked cache should not prevent a lookup.
  }

  const city = await lookup(latitude, longitude);
  if (city) {
    try {
      localStorage.setItem(key, JSON.stringify({ city, ts: Date.now() }));
    } catch {
      // The name can still be displayed if storage is unavailable.
    }
  }
  return city;
}

export function useDiscoverLocationName(enabled: boolean) {
  const { position, cityName, gateState, isLocating, isResolvingCity, requestLocation } = useLocation();
  const [lastCheckAt, setLastCheckAt] = useState(Date.now);
  const shouldRecover = enabled && gateState === 'granted' && position && !cityName && !isLocating && !isResolvingCity;
  const { data: recoveredName, isLoading: isRecoveringName } = useSWRImmutable(
    shouldRecover ? ['discover-location-name', position.latitude, position.longitude] as const : null,
    ([, latitude, longitude]) => recoverLocationName(latitude, longitude),
    { shouldRetryOnError: false },
  );

  useEffect(() => {
    if (!enabled || gateState !== 'granted') return;

    const refreshOnReturn = () => {
      if (document.visibilityState !== 'visible' || isLocating) return;
      const now = Date.now();
      if (now - Math.max(lastCheckAt, position?.updatedAt || 0) < FRESH_POSITION_MS) return;
      setLastCheckAt(now);
      requestLocation();
    };

    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => document.removeEventListener('visibilitychange', refreshOnReturn);
  }, [enabled, gateState, isLocating, lastCheckAt, position?.updatedAt, requestLocation]);

  const refresh = useCallback(() => {
    setLastCheckAt(Date.now());
    requestLocation({
      interactive: gateState !== 'granted',
      positionOptions: { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    });
  }, [gateState, requestLocation]);

  return {
    name: position && gateState === 'granted' && !isResolvingCity ? cityName || recoveredName || null : null,
    isLastKnown: !!position && lastCheckAt - (position.updatedAt || 0) >= FRESH_POSITION_MS,
    isResolving: isResolvingCity || isRecoveringName,
    refresh,
  };
}
