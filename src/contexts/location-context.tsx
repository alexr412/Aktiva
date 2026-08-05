'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';

export type LocationGateState =
  | 'checking'
  | 'prompt'
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

export type RequestLocationOptions = {
  interactive?: boolean;
  positionOptions?: PositionOptions;
};

export type LocationContextValue = {
  gateState: LocationGateState;
  isLocating: boolean;
  position: LocationPosition | null;
  cityName: string | null;
  isResolvingCity: boolean;
  errorMessage: string | null;
  requestLocation: (options?: RequestLocationOptions) => void;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const instanceIdRef = useRef<string | null>(null);
  if (!instanceIdRef.current) {
    instanceIdRef.current = 'LP-' + Math.random().toString(36).substring(2, 6);
  }

  const [gateState, setGateStateState] = useState<LocationGateState>('checking');
  const [isLocating, setIsLocating] = useState(false);
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

  const requestLocation = useCallback((options?: RequestLocationOptions): void => {
    const isInteractive = options?.interactive !== false;
    const gpsOptions: PositionOptions = options?.positionOptions || {
      enableHighAccuracy: true,
      timeout: isInteractive ? 15000 : 10000,
      maximumAge: isInteractive ? 0 : 60000,
    };

    if (requestInFlightRef.current) {
      console.log(`[LOCATION TRACE] provider=${instanceIdRef.current} requestLocation suppressed (in flight)`);
      return;
    }

    setErrorMessage(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGateState('error');
      setIsLocating(false);
      setErrorMessage(
        'Dieser Browser unterstützt keine Standortermittlung.'
      );
      return;
    }

    const requestId = ++requestCounterRef.current;
    console.log(`[GPS TRACE] requestId=${requestId} started (interactive=${isInteractive})`);

    requestInFlightRef.current = true;
    activeRequestIdRef.current = requestId;
    setIsLocating(true);

    if (isInteractive) {
      setGateState('requesting');
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        if (activeRequestIdRef.current !== requestId) {
          console.log(`[GPS TRACE] requestId=${requestId} ignored stale callback`);
          return;
        }

        activeRequestIdRef.current = null;
        requestInFlightRef.current = false;
        setIsLocating(false);
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
        try {
          localStorage.setItem('activa_location_permission_granted', 'true');
        } catch (e) {}

        void resolveCityName(latitude, longitude);
      },
      error => {
        if (activeRequestIdRef.current !== requestId) {
          console.log(`[GPS TRACE] requestId=${requestId} ignored stale error callback`);
          return;
        }

        activeRequestIdRef.current = null;
        requestInFlightRef.current = false;
        setIsLocating(false);
        console.log(`[GPS TRACE] requestId=${requestId} error code=${error.code}`);

        switch (error.code) {
          case 1:
            setGateState('denied');
            try {
              localStorage.removeItem('activa_location_permission_granted');
            } catch (e) {}
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
      gpsOptions
    );
  }, [setGateState, resolveCityName]);

  // Startup permission check and automatic background GPS fetch if granted
  useEffect(() => {
    let isMounted = true;
    let listenerCleanups: Array<() => void> = [];

    const initPermissionState = async () => {
      // Purge legacy coordinates cache
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('activa_last_location');
          localStorage.removeItem('aktiva_last_location');
        } catch (e) {}
      }

      if (
        typeof navigator !== 'undefined' &&
        navigator.permissions &&
        typeof navigator.permissions.query === 'function'
      ) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (!isMounted) return;

          const handleStatusChange = (newStatusState: PermissionState) => {
            if (!isMounted) return;
            console.log(`[LOCATION TRACE] permissions API status changed: ${newStatusState}`);
            if (newStatusState === 'granted') {
              setGateState('granted');
              try {
                localStorage.setItem('activa_location_permission_granted', 'true');
              } catch (e) {}
              requestLocation({ interactive: false });
            } else if (newStatusState === 'denied') {
              setGateState('denied');
              try {
                localStorage.removeItem('activa_location_permission_granted');
              } catch (e) {}
            } else {
              setGateState('prompt');
            }
          };

          handleStatusChange(status.state);

          const listener = () => handleStatusChange(status.state);
          if (status.addEventListener) {
            status.addEventListener('change', listener);
            listenerCleanups.push(() => status.removeEventListener('change', listener));
          } else if ('onchange' in status) {
            (status as any).onchange = listener;
            listenerCleanups.push(() => {
              (status as any).onchange = null;
            });
          }
          return;
        } catch (e) {
          console.warn('[LOCATION TRACE] navigator.permissions.query failed:', e);
        }
      }

      // Fallback for Safari / unsupported Permissions API
      if (!isMounted) return;
      let hasGrantedHint = false;
      if (typeof window !== 'undefined') {
        try {
          hasGrantedHint = localStorage.getItem('activa_location_permission_granted') === 'true';
        } catch (e) {}
      }

      if (hasGrantedHint) {
        // Remain in 'checking' while verifying via getCurrentPosition
        requestLocation({ interactive: false });
      } else {
        setGateState('prompt');
      }
    };

    void initPermissionState();

    return () => {
      isMounted = false;
      listenerCleanups.forEach(cleanup => cleanup());
    };
  }, [setGateState, requestLocation]);

  return (
    <LocationContext.Provider
      value={{
        gateState,
        isLocating,
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

