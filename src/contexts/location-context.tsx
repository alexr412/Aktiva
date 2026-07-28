'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { usePlanningMode } from './planning-mode-context';
import { useLanguage } from '@/hooks/use-language';
import { reverseGeocode as geoapifyReverseGeocode } from '@/lib/geoapify';
import type { Destination } from '@/lib/types';

export type LocationMode = 'current' | 'manual';
export type LocationSource = 'geolocation' | 'cache' | 'manual' | 'fallback';
export type LocationStatus = 'uninitialized' | 'resolving' | 'resolved' | 'fallback' | 'error';

export interface LocationContextType {
  locationMode: LocationMode;
  effectiveLocation: { lat: number; lng: number } | null;
  city: string | null;
  locationSource: LocationSource | null;
  locationStatus: LocationStatus;
  locationError: string | null;
  manualLocation: Destination | null;
  setManualLocation: (destination: Destination) => void;
  resetToCurrentLocation: () => void;
  retryCurrentLocation: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { planningState, enterPlanningMode, exitPlanningMode } = usePlanningMode();
  const language = useLanguage();

  const [effectiveLocation, setEffectiveLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('uninitialized');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualLocation, setManualLocationState] = useState<Destination | null>(null);

  const previousLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const isResolvingRef = useRef<boolean>(false);
  const currentRequestIdRef = useRef<number>(0);

  const locationMode: LocationMode = planningState.isPlanning && planningState.destination ? 'manual' : 'current';

  // Centralized Debug Logger
  const logLocationChange = useCallback((
    source: LocationSource,
    status: LocationStatus,
    newLoc: { lat: number; lng: number } | null,
    cityName: string | null,
    mode: LocationMode
  ) => {
    console.log("[LOCATION DEBUG]", {
      source,
      latitude: newLoc?.lat ?? null,
      longitude: newLoc?.lng ?? null,
      city: cityName,
      locationMode: mode,
      locationStatus: status,
      previousLocation: previousLocationRef.current,
      newLocation: newLoc,
      timestamp: new Date().toISOString()
    });
    if (newLoc) {
      previousLocationRef.current = newLoc;
    }
  }, []);

  // Async Reverse-Geocoding with Request ID protection against race conditions
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
      // Reject stale requests
      if (requestId !== currentRequestIdRef.current) {
        console.log("[LOCATION DEBUG] Discarding stale reverse-geocode response", { requestId, current: currentRequestIdRef.current });
        return;
      }

      if (place) {
        const props = (place as any)._rawProperties || {};
        const rawCity = props.city || props.town || props.village || props.suburb || props.municipality || place.name || null;
        const displayCity = rawCity || (language === 'de' ? 'Unbekannter Ort' : 'Unknown Place');

        setCity(displayCity);
        logLocationChange(source, status, { lat, lng }, displayCity, mode);

        if (source === 'geolocation') {
          try {
            localStorage.setItem('aktiva_last_location', JSON.stringify({
              lat, lng, city: displayCity, timestamp: Date.now()
            }));
          } catch (e) {}
        }
      } else {
        const fallbackCity = language === 'de' ? 'Unbekannter Ort' : 'Unknown Place';
        setCity(fallbackCity);
        logLocationChange(source, status, { lat, lng }, fallbackCity, mode);
      }
    } catch (err) {
      if (requestId !== currentRequestIdRef.current) return;
      console.warn("[LOCATION DEBUG] Reverse geocoding failed:", err);
      const fallbackCity = language === 'de' ? 'Unbekannter Ort' : 'Unknown Place';
      setCity(fallbackCity);
      logLocationChange(source, status, { lat, lng }, fallbackCity, mode);
    }
  }, [language, logLocationChange]);

  // Primary location determination logic
  const resolveCurrentLocation = useCallback(() => {
    const requestId = ++currentRequestIdRef.current;
    isResolvingRef.current = true;

    // Rule 1: Set status to resolving; do NOT use cache during resolving
    setLocationStatus('resolving');
    setLocationError(null);

    // Rule 2: Check manual mode first
    if (planningState.isPlanning && planningState.destination) {
      const dest = planningState.destination;
      const lat = dest.lat || dest.latitude || 0;
      const lng = dest.lng || dest.longitude || 0;
      const cityName = dest.city || dest.name || (language === 'de' ? 'Unbekannter Ort' : 'Unknown Place');
      const loc = { lat, lng };

      setManualLocationState(dest);
      setEffectiveLocation(loc);
      setCity(cityName);
      setLocationSource('manual');
      setLocationStatus('resolved');
      logLocationChange('manual', 'resolved', loc, cityName, 'manual');
      isResolvingRef.current = false;
      return;
    }

    // Mode is 'current': Use live navigator.geolocation (TOP PRIORITY)
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (requestId !== currentRequestIdRef.current) return;
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setEffectiveLocation(loc);
          setLocationSource('geolocation');
          setLocationStatus('resolved');
          isResolvingRef.current = false;
          executeReverseGeocode(loc.lat, loc.lng, requestId, 'geolocation', 'resolved', 'current');
        },
        (error) => {
          if (requestId !== currentRequestIdRef.current) return;
          console.warn("[LOCATION DEBUG] Geolocation error/denied:", error.message);
          setLocationError(error.message);

          // Geolocation failed/denied: NOW check localStorage cache as fallback
          let cacheRestored = false;
          if (typeof window !== 'undefined') {
            try {
              const cached = localStorage.getItem('aktiva_last_location');
              if (cached) {
                const { lat, lng, city: cachedCity, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;
                if (age < 4 * 60 * 60 * 1000 && typeof lat === 'number' && typeof lng === 'number') {
                  const cachedLoc = { lat, lng };
                  const displayCity = cachedCity || (language === 'de' ? 'Unbekannter Ort' : 'Unknown Place');
                  setEffectiveLocation(cachedLoc);
                  setCity(displayCity);
                  setLocationSource('cache');
                  setLocationStatus('fallback');
                  logLocationChange('cache', 'fallback', cachedLoc, displayCity, 'current');
                  cacheRestored = true;
                }
              }
            } catch (e) {}
          }

          // Default Fallback (Bremerhaven) if cache is also missing/invalid
          if (!cacheRestored) {
            const fallbackLoc = { lat: 53.5395, lng: 8.5809 };
            const fallbackCity = 'Bremerhaven';
            setEffectiveLocation(fallbackLoc);
            setCity(fallbackCity);
            setLocationSource('fallback');
            setLocationStatus('fallback');
            logLocationChange('fallback', 'fallback', fallbackLoc, fallbackCity, 'current');
          }
          isResolvingRef.current = false;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    } else {
      // Browser does not support geolocation: fallback to cache or Bremerhaven
      if (requestId !== currentRequestIdRef.current) return;
      let cacheRestored = false;
      if (typeof window !== 'undefined') {
        try {
          const cached = localStorage.getItem('aktiva_last_location');
          if (cached) {
            const { lat, lng, city: cachedCity } = JSON.parse(cached);
            if (typeof lat === 'number' && typeof lng === 'number') {
              const cachedLoc = { lat, lng };
              const displayCity = cachedCity || (language === 'de' ? 'Unbekannter Ort' : 'Unknown Place');
              setEffectiveLocation(cachedLoc);
              setCity(displayCity);
              setLocationSource('cache');
              setLocationStatus('fallback');
              logLocationChange('cache', 'fallback', cachedLoc, displayCity, 'current');
              cacheRestored = true;
            }
          }
        } catch (e) {}
      }

      if (!cacheRestored) {
        const fallbackLoc = { lat: 53.5395, lng: 8.5809 };
        const fallbackCity = 'Bremerhaven';
        setEffectiveLocation(fallbackLoc);
        setCity(fallbackCity);
        setLocationSource('fallback');
        setLocationStatus('fallback');
        logLocationChange('fallback', 'fallback', fallbackLoc, fallbackCity, 'current');
      }
      isResolvingRef.current = false;
    }
  }, [planningState, language, executeReverseGeocode, logLocationChange]);

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
    resolveCurrentLocation();
  }, [resolveCurrentLocation]);

  return (
    <LocationContext.Provider
      value={{
        locationMode,
        effectiveLocation,
        city,
        locationSource,
        locationStatus,
        locationError,
        manualLocation,
        setManualLocation,
        resetToCurrentLocation,
        retryCurrentLocation,
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
  const { effectiveLocation, city, locationMode, locationSource, locationStatus, locationError } = useLocation();
  return {
    effectiveLocation,
    city,
    locationMode,
    locationSource,
    locationStatus,
    locationError,
  };
}
