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
  isCheckingLocation: boolean;
  needsLocationGate: boolean;
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
  const [hasGrantedHintState, setHasGrantedHintState] = useState(false);

  const requestInFlightRef = useRef(false);
  const activeRequestIdRef = useRef<number | null>(null);
  const requestCounterRef = useRef(0);
  const cityRequestCounterRef = useRef(0);

  const setGateState = useCallback((newState: LocationGateState) => {
    console.log(`[LOCATION TRACE] provider=${instanceIdRef.current} gateState=${newState}`);
    setGateStateState(newState);
  }, []);

  const hasGrantedHint = useCallback(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('activa_location_permission_granted') === 'true';
    } catch (e) {
      return false;
    }
  }, []);

  const needsLocationGate = React.useMemo(() => {
    if (gateState === 'prompt' || gateState === 'denied') {
      return true;
    }
    if (gateState === 'requesting') {
      return true;
    }
    if (gateState === 'error') {
      const isGranted = hasGrantedHintState || hasGrantedHint();
      return !isGranted && !position;
    }
    return false;
  }, [gateState, position, hasGrantedHintState, hasGrantedHint]);

  const isCheckingLocation = gateState === 'checking' || isLocating;

  // Hydrate setup state & last known position on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const isGranted = localStorage.getItem('activa_location_permission_granted') === 'true';
      if (isGranted) {
        setHasGrantedHintState(true);
        setGateStateState('granted');

        const rawPos = localStorage.getItem('activa_last_known_position');
        if (rawPos) {
          const parsed = JSON.parse(rawPos);
          if (
            parsed &&
            typeof parsed.latitude === 'number' &&
            typeof parsed.longitude === 'number' &&
            Number.isFinite(parsed.latitude) &&
            Number.isFinite(parsed.longitude)
          ) {
            setPosition(parsed);
          }
        }
      }
    } catch (e) {}
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

    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLon = Math.round(lon * 100) / 100;
    const cacheKey = `activa_city_cache_${roundedLat}_${roundedLon}`;

    if (typeof window !== 'undefined') {
      try {
        const rawCached = localStorage.getItem(cacheKey);
        if (rawCached) {
          const parsed = JSON.parse(rawCached);
          if (parsed && typeof parsed.city === 'string' && typeof parsed.ts === 'number') {
            if (Date.now() - parsed.ts < 30 * 24 * 60 * 60 * 1000) {
              if (cityRequestId === cityRequestCounterRef.current) {
                setCityName(parsed.city);
                setIsResolvingCity(false);
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[CITY TRACE] resolved city from cache=${parsed.city}`);
                }
                return;
              }
            }
          }
        }
      } catch (e) {}
    }

    try {
      const { reverseGeocodeCity } = await import('@/lib/geoapify');
      const resolved = await reverseGeocodeCity(lat, lon);
      if (cityRequestId !== cityRequestCounterRef.current) return;
      setCityName(resolved);
      if (resolved && typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ city: resolved, ts: Date.now() }));
        } catch (e) {}
      }
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
    const isInteractive = options?.interactive === true;
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

        const newPos: LocationPosition = {
          latitude,
          longitude,
          accuracy,
          updatedAt: Date.now(),
        };

        setPosition(newPos);
        setGateState('granted');
        setHasGrantedHintState(true);

        try {
          localStorage.setItem('activa_location_permission_granted', 'true');
          localStorage.setItem('activa_last_known_position', JSON.stringify(newPos));
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

        const isPreviouslyGranted =
          hasGrantedHintState ||
          (typeof window !== 'undefined' && localStorage.getItem('activa_location_permission_granted') === 'true');

        switch (error.code) {
          case 1:
            setGateState('denied');
            setHasGrantedHintState(false);
            try {
              localStorage.removeItem('activa_location_permission_granted');
              localStorage.removeItem('activa_last_known_position');
            } catch (e) {}
            setErrorMessage(
              'Der Standortzugriff ist deaktiviert. Aktiviere ihn in den Browser- oder Geräteeinstellungen.'
            );
            break;

          case 2:
            if (!isPreviouslyGranted) {
              setGateState('error');
              setErrorMessage(
                'Dein Standort ist momentan nicht verfügbar. Prüfe, ob die Ortungsdienste deines Geräts aktiviert sind.'
              );
            } else {
              console.warn('[LOCATION TRACE] Background GPS position unavailable; maintaining granted state.');
            }
            break;

          case 3:
            if (!isPreviouslyGranted) {
              setGateState('error');
              setErrorMessage(
                'Die Standortermittlung hat zu lange gedauert. Versuche es erneut.'
              );
            } else {
              console.warn('[LOCATION TRACE] Background GPS timeout; maintaining granted state.');
            }
            break;

          default:
            if (!isPreviouslyGranted) {
              setGateState('error');
              setErrorMessage(
                'Dein Standort konnte nicht ermittelt werden.'
              );
            } else {
              console.warn('[LOCATION TRACE] Background GPS unknown error; maintaining granted state.');
            }
        }
      },
      gpsOptions
    );
  }, [setGateState, resolveCityName, hasGrantedHintState]);

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

      let isGrantedHint = false;
      if (typeof window !== 'undefined') {
        try {
          isGrantedHint = localStorage.getItem('activa_location_permission_granted') === 'true';
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
              try {
                localStorage.setItem('activa_location_permission_granted', 'true');
              } catch (e) {}
              setHasGrantedHintState(true);
              setGateState('granted');
              requestLocation({ interactive: false });
            } else if (newStatusState === 'denied') {
              setGateState('denied');
              setHasGrantedHintState(false);
              try {
                localStorage.removeItem('activa_location_permission_granted');
                localStorage.removeItem('activa_last_known_position');
              } catch (e) {}
            } else {
              if (isGrantedHint) {
                try {
                  localStorage.removeItem('activa_location_permission_granted');
                  localStorage.removeItem('activa_last_known_position');
                } catch (e) {}
                setHasGrantedHintState(false);
              }
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

      if (isGrantedHint) {
        setHasGrantedHintState(true);
        setGateState('granted');
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
        isCheckingLocation,
        needsLocationGate,
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

