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
  retryCurrentLocation: () => Promise<boolean>;
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
  const isRequestingLocationRef = useRef<boolean>(false);
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

  // Check Permissions API supplementary state
  const refreshPermissionState = useCallback(async (): Promise<'granted' | 'prompt' | 'denied' | null> => {
    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      return null;
    }
    try {
      const status = await navigator.permissions.query({ name: 'geolocation' as any });
      setPermissionState(status.state as 'granted' | 'prompt' | 'denied');
      return status.state as 'granted' | 'prompt' | 'denied';
    } catch (err) {
      console.warn('[LOCATION DEBUG] Permissions query failed:', err);
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
    }
  }, [accuracy, logLocationChange]);

  // Primary GPS Resolution Logic (Direct getCurrentPosition invocation)
  const requestGpsLocation = useCallback(async (forceExplicit = false): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationStatus('error');
      setLocationError(language === 'de' ? 'Geolokalisierung wird von deinem Browser nicht unterstützt.' : 'Geolocation is not supported by your browser.');
      return false;
    }

    // Prevent duplicate concurrent requests
    if (isRequestingLocationRef.current) {
      console.log('[LOCATION DEBUG] Location request already in progress. Skipping duplicate call.');
      return false;
    }

    const requestId = ++currentRequestIdRef.current;
    isRequestingLocationRef.current = true;
    setLocationStatus('loading');
    setLocationError(null);

    const startTime = Date.now();

    return new Promise<boolean>((resolvePromise) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // Enforce minimum visual loading time for crisp UI feedback
          const elapsed = Date.now() - startTime;
          if (elapsed < 400) {
            await new Promise((r) => setTimeout(r, 400 - elapsed));
          }

          isRequestingLocationRef.current = false;

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
            setLocationError(language === 'de' ? 'Ungültige GPS-Koordinaten empfangen.' : 'Invalid GPS coordinates received.');
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
          setLocationError(null);
          setUpdatedAt(now);
          setExpiresAt(now + LOCATION_MAX_TTL_MS);
          setPermissionState('granted');

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
          refreshPermissionState();
          resolvePromise(true);
        },
        async (error) => {
          const elapsed = Date.now() - startTime;
          if (elapsed < 400) {
            await new Promise((r) => setTimeout(r, 400 - elapsed));
          }

          isRequestingLocationRef.current = false;

          if (requestId !== currentRequestIdRef.current) {
            resolvePromise(false);
            return;
          }

          console.warn("[LOCATION DEBUG] Geolocation error:", error.code, error.message);

          let friendlyMessage = '';
          if (error.code === error.PERMISSION_DENIED) {
            setPermissionState('denied');
            setLocationStatus('denied');
            friendlyMessage = language === 'de'
              ? 'Der Standortzugriff ist weiterhin deaktiviert. Ändere die Berechtigung in deinen Geräte- oder Browser-Einstellungen.'
              : 'Location access remains disabled. Please update your device or browser settings.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            setLocationStatus('error');
            friendlyMessage = language === 'de'
              ? 'Dein Standort ist momentan nicht verfügbar. Prüfe, ob die Ortungsdienste auf deinem Gerät aktiviert sind.'
              : 'Your location is currently unavailable. Please check if Location Services are enabled on your device.';
          } else if (error.code === error.TIMEOUT) {
            setLocationStatus('error');
            friendlyMessage = language === 'de'
              ? 'Die Standortermittlung hat zu lange gedauert. Versuche es erneut.'
              : 'Location detection timed out. Please try again.';
          } else {
            setLocationStatus('error');
            friendlyMessage = error.message || (
              language === 'de' 
                ? 'Ein unerwarteter Fehler ist bei der Standortermittlung aufgetreten.' 
                : 'An unexpected error occurred during location detection.'
            );
          }

          setLocationError(friendlyMessage);
          refreshPermissionState();

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
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, [city, executeReverseGeocode, getSanitizedCache, language, logLocationChange, refreshPermissionState]);

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

    // Otherwise, attempt GPS fetch if permission is granted or prompt
    requestGpsLocation();
  }, [planningState, getSanitizedCache, requestGpsLocation, logLocationChange]);

  // Permissions API Monitoring
  useEffect(() => {
    refreshPermissionState();

    if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) return;

    let statusObj: PermissionStatus | null = null;
    navigator.permissions.query({ name: 'geolocation' as any })
      .then((status) => {
        statusObj = status;
        setPermissionState(status.state as 'granted' | 'prompt' | 'denied');

        status.onchange = () => {
          console.log('[LOCATION DEBUG] Permissions API status changed to:', status.state);
          setPermissionState(status.state as 'granted' | 'prompt' | 'denied');
          if (status.state === 'denied') {
            setLocationStatus('denied');
            setEffectiveLocation(null);
            setCity(null);
          } else if (status.state === 'granted') {
            requestGpsLocation(true);
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
  }, [refreshPermissionState, requestGpsLocation]);

  // App Switch / System Settings Return Listeners (visibilitychange, focus, pageshow)
  useEffect(() => {
    const handleAppReturn = () => {
      if (document.visibilityState === 'visible') {
        console.log('[LOCATION DEBUG] App returned/focused. Re-checking location permissions...');
        refreshPermissionState();

        const lastUpdated = updatedAt || 0;
        const isStale = Date.now() - lastUpdated > LOCATION_STALE_AFTER_MS;
        const isDeniedOrPrompt = locationStatus === 'denied' || locationStatus === 'prompt' || !effectiveLocation;

        if (isStale || isDeniedOrPrompt) {
          requestGpsLocation(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleAppReturn);
    window.addEventListener('focus', handleAppReturn);
    window.addEventListener('pageshow', handleAppReturn);

    return () => {
      document.removeEventListener('visibilitychange', handleAppReturn);
      window.removeEventListener('focus', handleAppReturn);
      window.removeEventListener('pageshow', handleAppReturn);
    };
  }, [updatedAt, locationStatus, effectiveLocation, refreshPermissionState, requestGpsLocation]);

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

  const retryCurrentLocation = useCallback(async (): Promise<boolean> => {
    console.log('[LOCATION DEBUG] Explicit retry triggered by user click.');
    return requestGpsLocation(true);
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
