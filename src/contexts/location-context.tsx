'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { usePlanningMode } from './planning-mode-context';
import { useLanguage } from '@/hooks/use-language';
import { reverseGeocode as geoapifyReverseGeocode } from '@/lib/geoapify';
import type { Destination } from '@/lib/types';

export type LocationMode = 'current' | 'manual';
export type LocationSource = 'gps' | 'cache' | 'manual' | 'geolocation' | 'fallback';
export type LocationStatus = 
  | 'idle'
  | 'loading'
  | 'ready'
  | 'prompt'
  | 'denied'
  | 'error'
  | 'uninitialized'
  | 'resolving'
  | 'resolved'
  | 'fallback';

export const LOCATION_STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes
export const LOCATION_MAX_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export interface LocationContextType {
  locationMode: LocationMode;
  effectiveLocation: { lat: number; lng: number } | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  city: string | null;
  cityName: string | null;
  locationSource: LocationSource | null;
  locationStatus: LocationStatus;
  locationError: string | null;
  permissionState: 'granted' | 'prompt' | 'denied' | null;
  manualLocation: Destination | null;
  updatedAt: number | null;
  expiresAt: number | null;
  setManualLocation: (destination: Destination) => void;
  resetToCurrentLocation: () => void;
  retryCurrentLocation: () => void;
  requestGpsLocation: (forceExplicit?: boolean) => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { planningState, enterPlanningMode, exitPlanningMode } = usePlanningMode();
  const language = useLanguage();

  const [effectiveLocation, setEffectiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('uninitialized');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'granted' | 'prompt' | 'denied' | null>(null);
  const [manualLocation, setManualLocationState] = useState<Destination | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const previousLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const isResolvingRef = useRef<boolean>(false);
  const currentRequestIdRef = useRef<number>(0);
  const lastLocationRef = useRef<{ lat: number; lng: number; updatedAt: number } | null>(null);

  const locationMode: LocationMode = planningState.isPlanning && planningState.destination ? 'manual' : 'current';

  // Centralized Debug Logger
  const logLocationChange = useCallback((
    source: LocationSource,
    status: LocationStatus,
    newLoc: { lat: number; lng: number } | null,
    cityNameStr: string | null,
    mode: LocationMode
  ) => {
    console.log("[LOCATION DEBUG]", {
      source,
      latitude: newLoc?.lat ?? null,
      longitude: newLoc?.lng ?? null,
      city: cityNameStr,
      locationMode: mode,
      locationStatus: status,
      previousLocation: previousLocationRef.current,
      newLocation: newLoc,
      timestamp: new Date().toISOString()
    });
    if (newLoc) {
      previousLocationRef.current = newLoc;
      lastLocationRef.current = { lat: newLoc.lat, lng: newLoc.lng, updatedAt: Date.now() };
    }
  }, []);

  // Inspect & Clean localStorage cache on mount
  const getSanitizedCache = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem('aktiva_last_location');
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      // 1. Purge explicit fallback entries immediately
      if (parsed.source === 'fallback') {
        console.log('[LOCATION DEBUG] Purging explicit fallback cache entry');
        localStorage.removeItem('aktiva_last_location');
        return null;
      }

      const timestamp = parsed.timestamp || parsed.updatedAt || 0;
      const age = Date.now() - timestamp;

      // 2. Purge expired cache (> 4 hours max TTL)
      if (age > LOCATION_MAX_TTL_MS) {
        console.log('[LOCATION DEBUG] Purging expired location cache entry (> 4h TTL)');
        localStorage.removeItem('aktiva_last_location');
        return null;
      }

      const lat = parsed.lat ?? parsed.latitude;
      const lng = parsed.lng ?? parsed.longitude;

      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        localStorage.removeItem('aktiva_last_location');
        return null;
      }

      return {
        lat,
        lng,
        accuracy: typeof parsed.accuracy === 'number' ? parsed.accuracy : 50,
        source: (parsed.source as LocationSource) || 'gps',
        city: parsed.city || parsed.cityName || null,
        timestamp,
        updatedAt: timestamp,
        expiresAt: timestamp + LOCATION_MAX_TTL_MS,
        isStale: age > LOCATION_STALE_AFTER_MS
      };
    } catch (e) {
      return null;
    }
  }, []);

  // Async Reverse-Geocoding (Best Effort - never blocks or sets Bremerhaven fallback)
  const executeReverseGeocode = useCallback(async (
    lat: number,
    lng: number,
    requestId: number,
    source: LocationSource,
    status: LocationStatus,
    mode: LocationMode
  ) => {
    try {
      const place = await geoapifyReverseGeocode(lat, lng);
      // Discard stale responses
      if (requestId !== currentRequestIdRef.current) {
        console.log("[LOCATION DEBUG] Discarding stale reverse-geocode response", { requestId, current: currentRequestIdRef.current });
        return;
      }

      if (place) {
        const props = (place as any)._rawProperties || {};
        const rawCity = props.city || props.town || props.village || props.suburb || props.municipality || place.name || null;
        const displayCity = rawCity || null;

        setCity(displayCity);
        logLocationChange(source, status, { lat, lng }, displayCity, mode);

        if (source === 'gps' || source === 'geolocation') {
          try {
            const cacheData = {
              lat,
              lng,
              latitude: lat,
              longitude: lng,
              accuracy: accuracy || 50,
              source: 'gps',
              cityName: displayCity,
              city: displayCity,
              timestamp: Date.now(),
              updatedAt: Date.now(),
              expiresAt: Date.now() + LOCATION_MAX_TTL_MS
            };
            localStorage.setItem('aktiva_last_location', JSON.stringify(cacheData));
          } catch (e) {}
        }
      }
    } catch (err) {
      if (requestId !== currentRequestIdRef.current) return;
      console.warn("[LOCATION DEBUG] Best-effort reverse geocoding failed (coordinates remain valid):", err);
      // Do NOT set a fallback city on error! Keep existing city or null.
    }
  }, [accuracy, logLocationChange]);

  // Primary GPS Resolution Logic
  const requestGpsLocation = useCallback(async (forceExplicit = false): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation is not supported by this browser.');
      return false;
    }

    const requestId = ++currentRequestIdRef.current;
    isResolvingRef.current = true;
    setLocationStatus('loading');
    setLocationError(null);

    return new Promise<boolean>((resolvePromise) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (requestId !== currentRequestIdRef.current) {
            resolvePromise(false);
            return;
          }

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const acc = position.coords.accuracy || 50;

          // Reject invalid coordinates
          if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            console.error('[LOCATION DEBUG] Invalid GPS coordinates received:', { lat, lng });
            setLocationStatus('error');
            setLocationError('Ungültige GPS-Koordinaten empfangen.');
            isResolvingRef.current = false;
            resolvePromise(false);
            return;
          }

          const now = Date.now();
          const loc = { lat, lng };

          setEffectiveLocation(loc);
          setLatitude(lat);
          setLongitude(lng);
          setAccuracy(acc);
          setLocationSource('gps');
          setLocationStatus('ready');
          setUpdatedAt(now);
          setExpiresAt(now + LOCATION_MAX_TTL_MS);
          setPermissionState('granted');
          isResolvingRef.current = false;

          // Save fresh GPS location to localStorage
          try {
            const cacheData = {
              lat,
              lng,
              latitude: lat,
              longitude: lng,
              accuracy: acc,
              source: 'gps',
              city: city || null,
              cityName: city || null,
              timestamp: now,
              updatedAt: now,
              expiresAt: now + LOCATION_MAX_TTL_MS
            };
            localStorage.setItem('aktiva_last_location', JSON.stringify(cacheData));
          } catch (e) {}

          logLocationChange('gps', 'ready', loc, city, 'current');

          // Best-effort reverse geocoding
          executeReverseGeocode(lat, lng, requestId, 'gps', 'ready', 'current');
          resolvePromise(true);
        },
        (error) => {
          if (requestId !== currentRequestIdRef.current) {
            resolvePromise(false);
            return;
          }

          console.warn("[LOCATION DEBUG] Geolocation error:", error.code, error.message);
          setLocationError(error.message);
          isResolvingRef.current = false;

          if (error.code === error.PERMISSION_DENIED) {
            setPermissionState('denied');
            setLocationStatus('denied');
          } else {
            setLocationStatus('error');
          }

          // Check if we have a valid, non-expired cached GPS location to use during refresh
          const cached = getSanitizedCache();
          if (cached && cached.source === 'gps') {
            console.log('[LOCATION DEBUG] Using valid cached GPS position as secondary fallback during refresh');
            const loc = { lat: cached.lat, lng: cached.lng };
            setEffectiveLocation(loc);
            setLatitude(cached.lat);
            setLongitude(cached.lng);
            setAccuracy(cached.accuracy);
            setCity(cached.city);
            setLocationSource('cache');
            setUpdatedAt(cached.updatedAt);
            setExpiresAt(cached.expiresAt);
            logLocationChange('cache', 'ready', loc, cached.city, 'current');
            resolvePromise(true);
            return;
          }

          // ZERO DEFAULT FALLBACK TO BREMERHAVEN
          setEffectiveLocation(null);
          setLatitude(null);
          setLongitude(null);
          setAccuracy(null);
          setCity(null);
          setLocationSource(null);
          resolvePromise(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, [city, executeReverseGeocode, getSanitizedCache, logLocationChange]);

  // Main resolution trigger
  const resolveCurrentLocation = useCallback(() => {
    // Check manual mode first
    if (planningState.isPlanning && planningState.destination) {
      const dest = planningState.destination;
      const lat = dest.lat || dest.latitude || 0;
      const lng = dest.lng || dest.longitude || 0;
      const cityNameStr = dest.city || dest.name || null;
      const loc = { lat, lng };

      setManualLocationState(dest);
      setEffectiveLocation(loc);
      setLatitude(lat);
      setLongitude(lng);
      setCity(cityNameStr);
      setLocationSource('manual');
      setLocationStatus('ready');
      logLocationChange('manual', 'ready', loc, cityNameStr, 'manual');
      return;
    }

    // Auto-fetch if cache exists or request GPS
    const cached = getSanitizedCache();
    if (cached && !cached.isStale && cached.source === 'gps') {
      const loc = { lat: cached.lat, lng: cached.lng };
      setEffectiveLocation(loc);
      setLatitude(cached.lat);
      setLongitude(cached.lng);
      setAccuracy(cached.accuracy);
      setCity(cached.city);
      setLocationSource('cache');
      setLocationStatus('ready');
      setUpdatedAt(cached.updatedAt);
      setExpiresAt(cached.expiresAt);
      logLocationChange('cache', 'ready', loc, cached.city, 'current');
      return;
    }

    // Otherwise, attempt GPS fetch if permission is granted
    requestGpsLocation();
  }, [planningState, getSanitizedCache, requestGpsLocation, logLocationChange]);

  // Permissions API Monitoring
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) return;

    let statusObj: PermissionStatus | null = null;
    navigator.permissions.query({ name: 'geolocation' as any })
      .then((status) => {
        statusObj = status;
        setPermissionState(status.state as 'granted' | 'prompt' | 'denied');

        if (status.state === 'denied') {
          setLocationStatus('denied');
        } else if (status.state === 'prompt') {
          setLocationStatus('prompt');
        } else if (status.state === 'granted') {
          resolveCurrentLocation();
        }

        status.onchange = () => {
          console.log('[LOCATION DEBUG] Permissions API status changed to:', status.state);
          setPermissionState(status.state as 'granted' | 'prompt' | 'denied');
          if (status.state === 'denied') {
            setLocationStatus('denied');
            setEffectiveLocation(null);
            setCity(null);
          } else if (status.state === 'granted') {
            requestGpsLocation();
          } else if (status.state === 'prompt') {
            setLocationStatus('prompt');
          }
        };
      })
      .catch((err) => {
        console.warn('[LOCATION DEBUG] Permissions API query error:', err);
      });

    return () => {
      if (statusObj) {
        statusObj.onchange = null;
      }
    };
  }, [resolveCurrentLocation, requestGpsLocation]);

  // VisibilityChange Auto-Refresh (Staleness > 15 minutes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastUpdated = updatedAt || 0;
        const isStale = Date.now() - lastUpdated > LOCATION_STALE_AFTER_MS;
        if (isStale) {
          console.log('[LOCATION DEBUG] Tab became visible and location is stale. Refreshing GPS...');
          requestGpsLocation();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updatedAt, requestGpsLocation]);

  // Initial resolve effect
  useEffect(() => {
    resolveCurrentLocation();
  }, [planningState.isPlanning, planningState.destination?.name, resolveCurrentLocation]);

  const setManualLocation = useCallback((destination: Destination) => {
    enterPlanningMode(destination);
  }, [enterPlanningMode]);

  const resetToCurrentLocation = useCallback(() => {
    exitPlanningMode();
    try {
      localStorage.removeItem('app-planning-mode');
    } catch (e) {}
    resolveCurrentLocation();
  }, [exitPlanningMode, resolveCurrentLocation]);

  const retryCurrentLocation = useCallback(() => {
    requestGpsLocation(true);
  }, [requestGpsLocation]);

  return (
    <LocationContext.Provider
      value={{
        locationMode,
        effectiveLocation,
        latitude,
        longitude,
        accuracy,
        city,
        cityName: city,
        locationSource,
        locationStatus,
        locationError,
        permissionState,
        manualLocation,
        updatedAt,
        expiresAt,
        setManualLocation,
        resetToCurrentLocation,
        retryCurrentLocation,
        requestGpsLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}

export function useCurrentLocation() {
  const { 
    effectiveLocation, 
    latitude, 
    longitude, 
    accuracy, 
    city, 
    cityName, 
    locationMode, 
    locationSource, 
    locationStatus, 
    locationError,
    permissionState,
    updatedAt,
    expiresAt
  } = useLocation();
  return {
    effectiveLocation,
    latitude,
    longitude,
    accuracy,
    city,
    cityName,
    locationMode,
    locationSource,
    locationStatus,
    locationError,
    permissionState,
    updatedAt,
    expiresAt,
  };
}
