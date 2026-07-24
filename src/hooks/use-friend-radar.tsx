'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './use-auth';
import { useActivePremium } from './use-active-premium';
import { db, functions } from '@/lib/firebase/client';
import { CURRENT_RADAR_CONSENT_VERSION } from '../../functions/src/radar-types';
import { useToast } from './use-toast';
import { ToastAction } from '@/components/ui/toast';

export function validateRadarResponse(data: any): {
  friends: NearbyFriend[];
  resultsTruncated: boolean;
  candidateScanTruncated: boolean;
  complete: boolean;
  generatedAtMs: number;
} {
  const result = {
    friends: [] as NearbyFriend[],
    resultsTruncated: false,
    candidateScanTruncated: false,
    complete: false,
    generatedAtMs: Date.now()
  };

  if (!data || typeof data !== 'object') {
    return result;
  }

  // Strict check: only boolean true is complete
  if (data.complete === true) {
    result.complete = true;
  }

  if (data.resultsTruncated === true) {
    result.resultsTruncated = true;
  }

  if (data.candidateScanTruncated === true) {
    result.candidateScanTruncated = true;
  }

  if (data.generatedAt) {
    if (typeof data.generatedAt.toMillis === 'function') {
      result.generatedAtMs = data.generatedAt.toMillis();
    } else if (data.generatedAt._seconds) {
      result.generatedAtMs = data.generatedAt._seconds * 1000;
    } else if (typeof data.generatedAt === 'number') {
      result.generatedAtMs = data.generatedAt;
    } else if (typeof data.generatedAt === 'string') {
      const parsed = Date.parse(data.generatedAt);
      if (!isNaN(parsed)) {
        result.generatedAtMs = parsed;
      }
    }
  }

  if (Array.isArray(data.friends)) {
    result.friends = data.friends.map((f: any) => {
      if (!f || typeof f !== 'object') return null;
      return {
        userId: String(f.userId || ''),
        username: String(f.username || ''),
        displayName: f.displayName ? String(f.displayName) : undefined,
        avatarUrl: f.avatarUrl ? String(f.avatarUrl) : undefined,
        distanceBucket: (f.distanceBucket || '10_to_25_km') as "under_1_km" | "1_to_2_km" | "2_to_5_km" | "5_to_10_km" | "10_to_25_km",
        approximateLatitude: Number(f.approximateLatitude || 0),
        approximateLongitude: Number(f.approximateLongitude || 0),
        precisionKm: Number(f.precisionKm || 2.0),
        updatedAt: f.updatedAt
      };
    }).filter(Boolean) as NearbyFriend[];
  }

  return result;
}

export interface NearbyFriend {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  distanceBucket: 'under_1_km' | '1_to_2_km' | '2_to_5_km' | '5_to_10_km' | '10_to_25_km';
  approximateLatitude: number;
  approximateLongitude: number;
  precisionKm: number;
  updatedAt: any;
  // Compile-time safety block: make sure raw location fields are never declared or assigned
  latitude?: never;
  longitude?: never;
  lat?: never;
  lng?: never;
  geohash?: never;
  exactDistance?: never;
  address?: never;
  locationHistory?: never;
}

export interface RadarClientError {
  message: string;
  type: 'auth' | 'permission' | 'rate-limit' | 'position' | 'consent' | 'offline' | 'unknown';
}

export interface FriendRadarContextType {
  enabled: boolean;
  radiusKm: number;
  consentVersion: string | null;
  permissionState: 'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable';
  lastLocationUpdatedAt: Date | null;
  nextAllowedLocationUpdateAt: Date | null;
  locationExpiresAt: Date | null;
  nearbyFriends: NearbyFriend[];
  isLoadingSettings: boolean;
  isUpdatingLocation: boolean;
  isLoadingFriends: boolean;
  error: RadarClientError | null;
  partialFailure: boolean;
  complete: boolean;
  activateRadar(radiusKm: number): Promise<void>;
  deactivateRadar(): Promise<void>;
  updateLocation(): Promise<void>;
  refreshNearbyFriends(): Promise<void>;
  setRadius(radiusKm: number): Promise<void>;
  clearError(): void;
  dismissPartialFailure(): void;
}

const FriendRadarContext = createContext<FriendRadarContextType | undefined>(undefined);

export const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 300000
};

export type BaselineState = 'uninitialized' | 'baseline_pending' | 'active';

export interface FriendNotificationState {
  userId: string;
  wasInside: boolean;
  lastSeenInsideAt?: number;
  lastSeenOutsideAt?: number;
  lastNotifiedAt?: number;
  expiresAt: number;
}

export interface GlobalNotificationState {
  notificationTimestamps: number[];
  initialized: boolean;
  accountId: string;
  expiresAt: number;
}

export interface VersionedNotificationStorage {
  version: string;
  accountId: string;
  expiresAt: number;
  friends: FriendNotificationState[];
  global: GlobalNotificationState;
}

const RADAR_NOTIFICATION_STORAGE_VERSION = 'v1.0';

function getStorageKey(userId: string): string {
  return `aktiva_radar_notifications_${userId}`;
}

export function readNotificationStorage(userId: string): VersionedNotificationStorage {
  const defaultState: VersionedNotificationStorage = {
    version: RADAR_NOTIFICATION_STORAGE_VERSION,
    accountId: userId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    friends: [],
    global: {
      notificationTimestamps: [],
      initialized: false,
      accountId: userId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    }
  };

  if (typeof window === 'undefined') return defaultState;

  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return defaultState;

    const parsed = JSON.parse(raw);
    
    // Strict structure checks (Dry parsing & validation)
    if (!parsed || typeof parsed !== 'object') return defaultState;
    if (parsed.version !== RADAR_NOTIFICATION_STORAGE_VERSION) return defaultState;
    if (parsed.accountId !== userId) return defaultState;
    if (!Array.isArray(parsed.friends)) return defaultState;
    if (!parsed.global || typeof parsed.global !== 'object') return defaultState;

    const now = Date.now();
    const validatedFriends: FriendNotificationState[] = [];

    for (const f of parsed.friends) {
      if (!f || typeof f !== 'object' || typeof f.userId !== 'string') continue;
      if (typeof f.wasInside !== 'boolean') continue;
      if (f.expiresAt && typeof f.expiresAt === 'number' && f.expiresAt < now) continue; // Expired 24h

      // Strictly copy only allowed fields (No coordinates!)
      validatedFriends.push({
        userId: f.userId,
        wasInside: f.wasInside,
        lastSeenInsideAt: typeof f.lastSeenInsideAt === 'number' ? f.lastSeenInsideAt : undefined,
        lastSeenOutsideAt: typeof f.lastSeenOutsideAt === 'number' ? f.lastSeenOutsideAt : undefined,
        lastNotifiedAt: typeof f.lastNotifiedAt === 'number' ? f.lastNotifiedAt : undefined,
        expiresAt: typeof f.expiresAt === 'number' ? f.expiresAt : (now + 24 * 60 * 60 * 1000),
      });
    }

    const limitedFriends = validatedFriends.slice(0, 30);
    const globalState = parsed.global;
    const hourAgo = now - 60 * 60 * 1000;
    const timestamps = Array.isArray(globalState.notificationTimestamps)
      ? globalState.notificationTimestamps.filter((ts: any) => typeof ts === 'number' && ts > hourAgo)
      : [];
    const limitedTimestamps = timestamps.slice(0, 10);

    return {
      version: RADAR_NOTIFICATION_STORAGE_VERSION,
      accountId: userId,
      expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : (now + 24 * 60 * 60 * 1000),
      friends: limitedFriends,
      global: {
        notificationTimestamps: limitedTimestamps,
        initialized: typeof globalState.initialized === 'boolean' ? globalState.initialized : false,
        accountId: userId,
        expiresAt: typeof globalState.expiresAt === 'number' ? globalState.expiresAt : (now + 24 * 60 * 60 * 1000),
      }
    };
  } catch (err) {
    console.warn('Failed to parse radar notification storage:', err);
    return defaultState;
  }
}

export function writeNotificationStorage(userId: string, data: VersionedNotificationStorage): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('Failed to write radar notification storage:', err);
    return false;
  }
}

function formatDistanceBucket(bucket: string, lang: 'de' | 'en'): string {
  switch (bucket) {
    case 'under_1_km':
      return lang === 'de' ? 'unter 1 km' : 'under 1 km';
    case '1_to_2_km':
      return lang === 'de' ? '1–2 km' : '1–2 km';
    case '2_to_5_km':
      return lang === 'de' ? '2–5 km' : '2–5 km';
    case '5_to_10_km':
      return lang === 'de' ? '5–10 km' : '5–10 km';
    case '10_to_25_km':
      return lang === 'de' ? '10–25 km' : '10–25 km';
    default:
      return lang === 'de' ? '2–5 km' : '2–5 km';
  }
}

export function FriendRadarProvider({ children }: { children: React.ReactNode }) {
  const { user, userProfile } = useAuth();
  const { isPremium, isOrganizer } = useActivePremium(userProfile);
  const hasAccess = isPremium || isOrganizer;
  const { toast } = useToast();

  // Local settings synced from Firestore
  const [enabled, setEnabled] = useState(false);
  const [radiusKm, setRadiusKmState] = useState(5);
  const [consentVersion, setConsentVersion] = useState<string | null>(null);

  // Synced non-sensitive location metadata
  const [lastLocationUpdatedAt, setLastLocationUpdatedAt] = useState<Date | null>(null);
  const [nextAllowedLocationUpdateAt, setNextAllowedLocationUpdateAt] = useState<Date | null>(null);
  const [locationExpiresAt, setLocationExpiresAt] = useState<Date | null>(null);

  // Client states
  const [permissionState, setPermissionState] = useState<'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable'>('unknown');
  const [nearbyFriends, setNearbyFriends] = useState<NearbyFriend[]>([]);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [error, setError] = useState<RadarClientError | null>(null);
  const [partialFailure, setPartialFailure] = useState(false);

  // Phase 4 Baseline State Machine
  const [baselineState, setBaselineState] = useState<BaselineState>('uninitialized');
  const [complete, setComplete] = useState<boolean>(true);

  // Serialized execution refs
  const lastProcessedTimestampRef = useRef<number>(0);
  const isEvaluatingRef = useRef<boolean>(false);

  // Keep track of active timers/intervals
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const disableCalledOnExpiryRef = useRef(false);

  // language helper (fallback to 'de')
  const language = (userProfile as any)?.language || 'de';

  // 1. Monitor Geolocation API Permission
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setPermissionState('unavailable');
      return;
    }

    if (!navigator.permissions || !navigator.permissions.query) {
      setPermissionState('prompt'); // Defensive default fallback if Permissions API is missing
      return;
    }

    let permissionObj: PermissionStatus | null = null;

    const updatePermission = () => {
      if (permissionObj) {
        setPermissionState(permissionObj.state as any);
      }
    };

    navigator.permissions.query({ name: 'geolocation' as any }).then((perm) => {
      permissionObj = perm;
      setPermissionState(perm.state as any);
      perm.onchange = updatePermission;
    }).catch(() => {
      setPermissionState('prompt');
    });

    return () => {
      if (permissionObj) {
        permissionObj.onchange = null;
      }
    };
  }, []);

  // 2. Real-time sync of radar settings document from Firestore
  useEffect(() => {
    if (!db || !user?.uid) {
      setEnabled(false);
      setRadiusKmState(5);
      setConsentVersion(null);
      setLastLocationUpdatedAt(null);
      setNextAllowedLocationUpdateAt(null);
      setLocationExpiresAt(null);
      setIsLoadingSettings(false);
      setNearbyFriends([]);
      setBaselineState('uninitialized');
      setComplete(false);
      return;
    }

    setIsLoadingSettings(true);

    const docRef = doc(db, 'users', user.uid, 'private', 'radarSettings');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEnabled(!!data.enabled);
        setRadiusKmState(data.radiusKm || 5);
        setConsentVersion(data.consentVersion || null);

        const lastLoc = data.lastLocationUpdatedAt;
        const nextLoc = data.nextAllowedLocationUpdateAt;
        const expiresLoc = data.locationExpiresAt;

        setLastLocationUpdatedAt(lastLoc ? (typeof lastLoc.toDate === 'function' ? lastLoc.toDate() : new Date(lastLoc)) : null);
        setNextAllowedLocationUpdateAt(nextLoc ? (typeof nextLoc.toDate === 'function' ? nextLoc.toDate() : new Date(nextLoc)) : null);
        setLocationExpiresAt(expiresLoc ? (typeof expiresLoc.toDate === 'function' ? expiresLoc.toDate() : new Date(expiresLoc)) : null);
      } else {
        setEnabled(false);
        setRadiusKmState(5);
        setConsentVersion(null);
        setLastLocationUpdatedAt(null);
        setNextAllowedLocationUpdateAt(null);
        setLocationExpiresAt(null);
      }
      setIsLoadingSettings(false);
    }, (err) => {
      console.error('Failed to subscribe to radar settings:', err);
      setIsLoadingSettings(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.uid]);

  // 3. React on Premium Expiry / Logout / Account Changes
  useEffect(() => {
    if (!user?.uid) {
      // Clear data on logout
      setNearbyFriends([]);
      setError(null);
      setPartialFailure(false);
      setBaselineState('uninitialized');
      setComplete(false);
      disableCalledOnExpiryRef.current = false;
      return;
    }

    // New baseline pending on user account switch/login
    setBaselineState('baseline_pending');

    if (!hasAccess && enabled) {
      // Premium expired while radar was enabled
      setNearbyFriends([]);
      setPartialFailure(false);
      setBaselineState('uninitialized');
      setComplete(false);

      // Clear notification state on premium expiration
      try {
        localStorage.removeItem(getStorageKey(user.uid));
      } catch (e) {
        console.warn('Failed to clear notification storage on premium expiry:', e);
      }

      if (!disableCalledOnExpiryRef.current) {
        disableCalledOnExpiryRef.current = true;
        // Best effort: Disable radar on server, do not await to block
        if (functions) {
          import('firebase/functions').then(({ httpsCallable }) => {
            const disableRadarCall = httpsCallable(functions!, 'disableRadar');
            disableRadarCall().catch((e) => console.warn('disableRadar best-effort on expiry failed:', e));
          });
        }
      }
    } else if (hasAccess) {
      disableCalledOnExpiryRef.current = false;
    }
  }, [hasAccess, enabled, user?.uid]);

  // 3b. Immediate cleanup on block/unfriend events (triggered when userProfile changes)
  useEffect(() => {
    if (!user?.uid || !userProfile) return;
    const friendsList = new Set(userProfile.friends || []);
    const hardBlocked = userProfile.blacklist?.hard || [];
    const softBlocked = userProfile.blacklist?.soft || [];
    const blockedList = new Set([...hardBlocked, ...softBlocked]);

    // Clean up nearbyFriends list
    setNearbyFriends((prev) => {
      const filtered = prev.filter((f) => friendsList.has(f.userId) && !blockedList.has(f.userId));
      if (filtered.length !== prev.length) {
        return filtered;
      }
      return prev;
    });

    // Clean up stored notification state
    const storage = readNotificationStorage(user.uid);
    const prevLen = storage.friends.length;
    // If a friend is blocked or unfriended, delete their entry entirely
    storage.friends = storage.friends.filter((sf) => friendsList.has(sf.userId) && !blockedList.has(sf.userId));
    if (storage.friends.length !== prevLen) {
      writeNotificationStorage(user.uid, storage);
    }
  }, [userProfile?.friends, userProfile?.blacklist, user?.uid]);

  // Actions helper
  const getFunctionsInstance = async () => {
    if (!functions) throw new Error('Firebase Functions is not initialized.');
    const { httpsCallable } = await import('firebase/functions');
    return httpsCallable;
  };

  const activateRadar = async (radius: number) => {
    if (!user?.uid) throw new Error('User not logged in.');
    if (!hasAccess) {
      const errObj: RadarClientError = {
        message: 'Radar-Zugriff erfordert ein aktives Premium-Abonnement oder einen Organizer-Account.',
        type: 'permission'
      };
      setError(errObj);
      throw new Error(errObj.message);
    }

    setError(null);
    setPartialFailure(false);
    setBaselineState('baseline_pending');

    // Step A: Request geolocation position
    return new Promise<void>((resolve, reject) => {
      if (typeof window === 'undefined' || !navigator.geolocation) {
        const errObj: RadarClientError = { message: 'Browser unterstützt Geolocation nicht.', type: 'position' };
        setError(errObj);
        reject(new Error(errObj.message));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          try {
            const httpsCallable = await getFunctionsInstance();

            // Step B: Set settings
            const setSettingsCall = httpsCallable<{ enabled: boolean; radiusKm: number; consentVersion: string }, any>(
              functions!,
              'setRadarSettings'
            );
            await setSettingsCall({
              enabled: true,
              radiusKm: radius,
              consentVersion: CURRENT_RADAR_CONSENT_VERSION
            });

            // Step C: Update location
            try {
              setIsUpdatingLocation(true);
              const updateLocCall = httpsCallable<{ latitude: number; longitude: number }, any>(
                functions!,
                'updateRadarLocation'
              );
              await updateLocCall({ latitude: lat, longitude: lon });
            } catch (updateErr: any) {
              console.error('updateRadarLocation failed during activation:', updateErr);
              setPartialFailure(true);
              setNearbyFriends([]);
              setError({
                message: 'Einstellungen aktiviert, aber Standortaktualisierung fehlgeschlagen.',
                type: 'position'
              });
              setIsUpdatingLocation(false);
              resolve(); // Partially active (settings set, location missing)
              return;
            }

            setIsUpdatingLocation(false);

            try {
              setIsLoadingFriends(true);
              const getFriendsCall = httpsCallable<void, any>(functions!, 'getNearbyFriends');
              const res = await getFriendsCall();
              
              // Validate and filter using defensive helper
              const parsed = validateRadarResponse(res.data);
              
              setNearbyFriends(parsed.friends.slice(0, 30));
              setComplete(parsed.complete);

              // Process entry baseline
              await processNearbyFriends(parsed.friends, parsed.generatedAtMs, parsed.complete);
            } catch (friendsErr) {
              console.warn('Failed to load friends on activation:', friendsErr);
              setComplete(false);
            } finally {
              setIsLoadingFriends(false);
            }

            resolve();
          } catch (err: any) {
            console.error('activateRadar error:', err);
            setComplete(false);
            const errType = err.code === 'permission-denied' ? 'permission' : 'unknown';
            setError({ message: err.message || 'Aktivierung fehlgeschlagen.', type: errType as any });
            reject(err);
          }
        },
        (geoErr) => {
          console.error('Geolocation error during activation:', geoErr);
          let msg = 'Standortzugriff fehlgeschlagen.';
          let type: any = 'position';
          if (geoErr.code === geoErr.PERMISSION_DENIED) {
            msg = 'Standortzugriff im Browser blockiert.';
            type = 'denied';
          }
          setError({ message: msg, type });
          reject(new Error(msg));
        },
        GEOLOCATION_OPTIONS
      );
    });
  };

  const deactivateRadar = async () => {
    setError(null);
    setPartialFailure(false);
    setNearbyFriends([]);
    setBaselineState('uninitialized');
    setComplete(false);

    // Wipe notification state for this user from localStorage
    if (user?.uid) {
      try {
        localStorage.removeItem(getStorageKey(user.uid));
      } catch (e) {
        console.warn('Failed to delete notification cache on deactivate:', e);
      }
    }

    try {
      const httpsCallable = await getFunctionsInstance();
      const disableCall = httpsCallable<void, any>(functions!, 'disableRadar');
      await disableCall();
    } catch (err: any) {
      console.error('deactivateRadar error:', err);
      // Still clear client state regardless of server response
      setNearbyFriends([]);
    }
  };

  const updateLocation = async () => {
    if (!user?.uid) return;
    if (!hasAccess || !enabled) return;

    if (nextAllowedLocationUpdateAt && Date.now() < nextAllowedLocationUpdateAt.getTime()) {
      // Cooldown in action
      return;
    }

    if (typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    // Only auto-update if permission is explicitly granted
    if (permissionState !== 'granted' && permissionState !== 'unknown') {
      return;
    }

    setIsUpdatingLocation(true);
    setError(null);

    return new Promise<void>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const httpsCallable = await getFunctionsInstance();
            const updateLocCall = httpsCallable<{ latitude: number; longitude: number }, any>(
              functions!,
              'updateRadarLocation'
            );
            await updateLocCall({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            setIsUpdatingLocation(false);
            setPartialFailure(false);
            resolve();
          } catch (err: any) {
            console.error('updateLocation error:', err);
            setIsUpdatingLocation(false);
            if (err.code === 'resource-exhausted') {
              setError({ message: 'Updates nur alle 5 Minuten erlaubt.', type: 'rate-limit' });
            } else {
              setError({ message: err.message || 'Standort-Aktualisierung fehlgeschlagen.', type: 'unknown' });
            }
            reject(err);
          }
        },
        (geoErr) => {
          setIsUpdatingLocation(false);
          let msg = 'Standort-Aktualisierung fehlgeschlagen.';
          if (geoErr.code === geoErr.PERMISSION_DENIED) {
            msg = 'Standortzugriff im Browser blockiert.';
          }
          setError({ message: msg, type: 'position' });
          reject(new Error(msg));
        },
        GEOLOCATION_OPTIONS
      );
    });
  };

  const refreshNearbyFriends = async () => {
    if (!user?.uid || !hasAccess || !enabled || partialFailure) {
      return;
    }

    setIsLoadingFriends(true);

    try {
      const httpsCallable = await getFunctionsInstance();
      const getFriendsCall = httpsCallable<void, any>(functions!, 'getNearbyFriends');
      const res = await getFriendsCall();

      // Validate and filter using defensive helper
      const parsed = validateRadarResponse(res.data);

      setNearbyFriends(parsed.friends.slice(0, 30));
      setComplete(parsed.complete);

      await processNearbyFriends(parsed.friends, parsed.generatedAtMs, parsed.complete);
    } catch (err: any) {
      console.error('refreshNearbyFriends error:', err);
      setComplete(false);
      if (err.code === 'resource-exhausted') {
        // Ignored in background polling to not spam UI
      } else {
        setError({ message: err.message || 'Freunde laden fehlgeschlagen.', type: 'unknown' });
      }
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const processNearbyFriends = async (newFriends: NearbyFriend[], serverTimestampMs: number, complete: boolean) => {
    if (!user?.uid) return;

    if (isEvaluatingRef.current) {
      return;
    }
    isEvaluatingRef.current = true;

    try {
      if (serverTimestampMs <= lastProcessedTimestampRef.current) {
        return;
      }
      lastProcessedTimestampRef.current = serverTimestampMs;

      let storage = readNotificationStorage(user.uid);
      const now = Date.now();

      if (baselineState === 'uninitialized' || baselineState === 'baseline_pending') {
        // First fetch is baseline
        const activeIds = new Set(newFriends.map(f => f.userId));
        
        storage.friends = storage.friends.map(f => {
          if (activeIds.has(f.userId)) {
            return {
              ...f,
              wasInside: true,
              lastSeenInsideAt: now,
              expiresAt: now + 24 * 60 * 60 * 1000
            };
          } else {
            return {
              ...f,
              wasInside: false,
              lastSeenOutsideAt: now
            };
          }
        });

        for (const f of newFriends) {
          const exists = storage.friends.some(sf => sf.userId === f.userId);
          if (!exists) {
            storage.friends.push({
              userId: f.userId,
              wasInside: true,
              lastSeenInsideAt: now,
              expiresAt: now + 24 * 60 * 60 * 1000
            });
          }
        }

        storage.friends = storage.friends.slice(0, 30);
        storage.global.initialized = true;

        writeNotificationStorage(user.uid, storage);
        setBaselineState('active');
        return;
      }

      // active state
      const activeIds = new Set(newFriends.map(f => f.userId));
      const friendsToNotify: NearbyFriend[] = [];

      for (const f of newFriends) {
        let record = storage.friends.find(sf => sf.userId === f.userId);
        if (!record) {
          record = {
            userId: f.userId,
            wasInside: true,
            lastSeenInsideAt: now,
            expiresAt: now + 24 * 60 * 60 * 1000
          };
          storage.friends.push(record);
          friendsToNotify.push(f);
        } else if (!record.wasInside) {
          record.wasInside = true;
          record.lastSeenInsideAt = now;
          record.expiresAt = now + 24 * 60 * 60 * 1000;
          friendsToNotify.push(f);
        } else {
          record.lastSeenInsideAt = now;
          record.expiresAt = now + 24 * 60 * 60 * 1000;
        }
      }

      // Friends who left
      storage.friends = storage.friends.map(f => {
        if (!activeIds.has(f.userId) && f.wasInside) {
          if (!complete) {
            return f;
          } else {
            return {
              ...f,
              wasInside: false,
              lastSeenOutsideAt: now
            };
          }
        }
        return f;
      });

      storage.friends = storage.friends.slice(0, 30);

      // Save memory changes to localStorage before reloading for visibility/sync check
      writeNotificationStorage(user.uid, storage);

      if (friendsToNotify.length > 0 && document.visibilityState === 'visible' && navigator.onLine !== false) {
        // Read fresh tab sync state immediately before triggering toast
        storage = readNotificationStorage(user.uid);

        const showCount = Math.min(friendsToNotify.length, 3);
        for (let i = 0; i < showCount; i++) {
          const friend = friendsToNotify[i];
          const record = storage.friends.find(sf => sf.userId === friend.userId);
          const sixHours = 6 * 60 * 60 * 1000;

          if (record && record.lastNotifiedAt && (now - record.lastNotifiedAt < sixHours)) {
            continue;
          }

          const hourAgo = now - 60 * 60 * 1000;
          const currentTimestamps = storage.global.notificationTimestamps.filter(ts => ts > hourAgo);
          if (currentTimestamps.length >= 3) {
            break;
          }

          // Write updated state to cache BEFORE triggering toast to prevent multiple tab race conditions
          if (record) {
            record.lastNotifiedAt = now;
          }
          storage.global.notificationTimestamps.push(now);

          writeNotificationStorage(user.uid, storage);

          const isDe = language === 'de';
          const distanceText = formatDistanceBucket(friend.distanceBucket, isDe ? 'de' : 'en');

          toast({
            title: isDe ? 'Freund in deiner Nähe' : 'Friend nearby',
            description: isDe
              ? `@${friend.username} war vor wenigen Minuten im Umkreis von ${distanceText} aktiv.`
              : `@${friend.username} was active nearby in a radius of ${distanceText} a few minutes ago.`,
            action: (
              <ToastAction
                altText={isDe ? 'Profil öffnen' : 'Open profile'}
                onClick={() => {
                  window.location.href = `/users/${friend.userId}`;
                }}
              >
                {isDe ? 'Profil öffnen' : 'Open profile'}
              </ToastAction>
            )
          });
        }

        // Set all entrants as wasInside = true (even if notification was suppressed by caps)
        for (const friend of friendsToNotify) {
          const record = storage.friends.find(sf => sf.userId === friend.userId);
          if (record) {
            record.wasInside = true;
          }
        }
      }

      writeNotificationStorage(user.uid, storage);
    } finally {
      isEvaluatingRef.current = false;
    }
  };

  const setRadius = async (newRadius: number) => {
    if (!user?.uid || !hasAccess || !enabled) return;

    try {
      const httpsCallable = await getFunctionsInstance();
      const setSettingsCall = httpsCallable<{ enabled: boolean; radiusKm: number; consentVersion: string }, any>(
        functions!,
        'setRadarSettings'
      );
      await setSettingsCall({
        enabled: true,
        radiusKm: newRadius,
        consentVersion: consentVersion || CURRENT_RADAR_CONSENT_VERSION
      });
      // Set locally immediately to prevent flickers
      setRadiusKmState(newRadius);
      // Wait shortly then update friends for the new radius
      setTimeout(() => {
        refreshNearbyFriends();
      }, 500);
    } catch (err: any) {
      console.error('setRadius error:', err);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Radius konnte nicht aktualisiert werden.'
      });
    }
  };

  const clearError = () => setError(null);
  const dismissPartialFailure = () => {
    setPartialFailure(false);
    setError(null);
  };

  // 4. Timer background updates & Visibility polling
  useEffect(() => {
    if (!enabled || !hasAccess || partialFailure) {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      return;
    }

    // Interval to refresh friends and location every 5 mins when visible
    updateIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) {
        const shouldUpdateLoc = !lastLocationUpdatedAt || (nextAllowedLocationUpdateAt && Date.now() >= nextAllowedLocationUpdateAt.getTime());
        
        if (shouldUpdateLoc) {
          updateLocation().then(() => refreshNearbyFriends()).catch(() => {});
        } else {
          refreshNearbyFriends();
        }
      }
    }, 5 * 60 * 1000);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [enabled, hasAccess, lastLocationUpdatedAt, nextAllowedLocationUpdateAt, partialFailure]);

  // Page Visibility API change triggers
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setBaselineState('baseline_pending');
        if (enabled && hasAccess && !partialFailure && navigator.onLine !== false) {
          const shouldUpdateLoc = !lastLocationUpdatedAt || (nextAllowedLocationUpdateAt && Date.now() >= nextAllowedLocationUpdateAt.getTime());
          if (shouldUpdateLoc) {
            updateLocation().then(() => refreshNearbyFriends()).catch(() => {});
          } else {
            refreshNearbyFriends();
          }
        }
      } else {
        setBaselineState('uninitialized');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, hasAccess, lastLocationUpdatedAt, nextAllowedLocationUpdateAt, partialFailure]);

  // Online / Offline resume triggers
  useEffect(() => {
    const handleOnline = () => {
      setBaselineState('baseline_pending');
      if (enabled && hasAccess && !partialFailure) {
        refreshNearbyFriends();
      }
    };
    const handleOffline = () => {
      setBaselineState('uninitialized');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled, hasAccess, partialFailure]);

  // Sync baseline pending state when settings activation gets active
  useEffect(() => {
    if (enabled && hasAccess && !partialFailure) {
      setBaselineState((prev) => (prev === 'uninitialized' ? 'baseline_pending' : prev));
    } else {
      setBaselineState('uninitialized');
    }
  }, [enabled, hasAccess, partialFailure]);

  return (
    <FriendRadarContext.Provider
      value={{
        enabled,
        radiusKm,
        consentVersion,
        permissionState,
        lastLocationUpdatedAt,
        nextAllowedLocationUpdateAt,
        locationExpiresAt,
        nearbyFriends,
        isLoadingSettings,
        isUpdatingLocation,
        isLoadingFriends,
        error,
        partialFailure,
        complete,
        activateRadar,
        deactivateRadar,
        updateLocation,
        refreshNearbyFriends,
        setRadius,
        clearError,
        dismissPartialFailure,
      }}
    >
      {children}
    </FriendRadarContext.Provider>
  );
}

export function useFriendRadar() {
  const context = useContext(FriendRadarContext);
  if (context === undefined) {
    throw new Error('useFriendRadar must be used within a FriendRadarProvider');
  }
  return context;
}
