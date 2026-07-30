'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';

export type LocationGateState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'error';

export type LocationPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  updatedAt: number;
};

export type LocationContextValue = {
  gateState: LocationGateState;
  position: LocationPosition | null;
  cityName: string | null;
  isResolvingCity: boolean;
  errorMessage: string | null;
  requestLocation: () => void;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const instanceIdRef = useRef<string | null>(null);
  if (!instanceIdRef.current) {
    instanceIdRef.current = 'LP-' + Math.random().toString(36).substring(2, 6);
  }

  const [gateState, setGateStateState] = useState<LocationGateState>('idle');
  const [position, setPosition] = useState<LocationPosition | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [isResolvingCity, setIsResolvingCity] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestInFlightRef = useRef(false);
  const activeRequestIdRef = useRef<number | null>(null);
  const requestCounterRef = useRef(0);
  const cityRequestCounterRef = useRef(0);

  const setGateState = useCallback((newState: LocationGateState) => {
    console.log(`[LOCATION TRACE] provider=${instanceIdRef.current} gateState=${newState}`);
    setGateStateState(newState);
  }, []);

  useEffect(() => {
    console.log(`[LOCATION TRACE] provider=${instanceIdRef.current} event=MOUNT`);
    return () => {
      console.log(`[LOCATION TRACE] provider=${instanceIdRef.current} event=UNMOUNT`);
    };
  }, []);

  // Purge old location cache key on startup as specified in architecture
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('aktiva_last_location');
      } catch (e) {}
    }
  }, []);

  const resolveCityName = useCallback(async (lat: number, lon: number) => {
    const cityRequestId = ++cityRequestCounterRef.current;
    setIsResolvingCity(true);
    if (process.env.NODE_ENV === 'development') {
      console.log('[CITY TRACE] reverse geocode started');
    }
    try {
      const { reverseGeocodeCity } = await import('@/lib/geoapify');
      const resolved = await reverseGeocodeCity(lat, lon);
      if (cityRequestId !== cityRequestCounterRef.current) return;
      setCityName(resolved);
      if (process.env.NODE_ENV === 'development') {
        if (resolved) {
          console.log(`[CITY TRACE] resolved city=${resolved}`);
        } else {
          console.log('[CITY TRACE] reverse geocode failed');
        }
      }
    } catch (e) {
      if (cityRequestId !== cityRequestCounterRef.current) return;
      setCityName(null);
      if (process.env.NODE_ENV === 'development') {
        console.log('[CITY TRACE] reverse geocode failed');
      }
    } finally {
      if (cityRequestId === cityRequestCounterRef.current) {
        setIsResolvingCity(false);
      }
    }
  }, []);

  const requestLocation = useCallback((): void => {
    if (requestInFlightRef.current) {
      console.log(`[LOCATION TRACE] provider=${instanceIdRef.current} requestLocation suppressed (in flight)`);
      return;
    }

    setErrorMessage(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGateState('error');
      setErrorMessage(
        'Dieser Browser unterstützt keine Standortermittlung.'
      );
      return;
    }

    const requestId = ++requestCounterRef.current;
    console.log(`[GPS TRACE] requestId=${requestId} started`);

    requestInFlightRef.current = true;
    activeRequestIdRef.current = requestId;
    setGateState('requesting');

    navigator.geolocation.getCurrentPosition(
      pos => {
        if (activeRequestIdRef.current !== requestId) {
          console.log(`[GPS TRACE] requestId=${requestId} ignored stale callback`);
          return;
        }

        activeRequestIdRef.current = null;
        requestInFlightRef.current = false;
        console.log(`[GPS TRACE] requestId=${requestId} success`);

        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          !Number.isFinite(accuracy) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          setGateState('error');
          setErrorMessage(
            'Der übermittelte Standort ist ungültig. Versuche es erneut.'
          );
          return;
        }

        setPosition({
          latitude,
          longitude,
          accuracy,
          updatedAt: Date.now(),
        });

        setGateState('granted');
        void resolveCityName(latitude, longitude);
      },
      error => {
        if (activeRequestIdRef.current !== requestId) {
          console.log(`[GPS TRACE] requestId=${requestId} ignored stale error callback`);
          return;
        }

        activeRequestIdRef.current = null;
        requestInFlightRef.current = false;
        console.log(`[GPS TRACE] requestId=${requestId} error code=${error.code}`);

        switch (error.code) {
          case 1:
            setGateState('denied');
            setErrorMessage(
              'Der Standortzugriff ist deaktiviert. Aktiviere ihn in den Browser- oder Geräteeinstellungen.'
            );
            break;

          case 2:
            setGateState('error');
            setErrorMessage(
              'Dein Standort ist momentan nicht verfügbar. Prüfe, ob die Ortungsdienste deines Geräts aktiviert sind.'
            );
            break;

          case 3:
            setGateState('error');
            setErrorMessage(
              'Die Standortermittlung hat zu lange gedauert. Versuche es erneut.'
            );
            break;

          default:
            setGateState('error');
            setErrorMessage(
              'Dein Standort konnte nicht ermittelt werden.'
            );
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );
  }, [setGateState, resolveCityName]);

  return (
    <LocationContext.Provider
      value={{
        gateState,
        position,
        cityName,
        isResolvingCity,
        errorMessage,
        requestLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
