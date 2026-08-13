'use client';

import { getMessaging, getToken, deleteToken, isSupported, onMessage } from 'firebase/messaging';
import { app } from './client';
import { saveUserPushToken, removeUserPushToken } from './firestore';

export type PushCapabilityState =
  | 'unsupported'
  | 'installed-pwa-required'
  | 'default'
  | 'granted'
  | 'denied'
  | 'registration-error';

/**
 * Determines current device & browser push capability state.
 */
export async function getPushCapabilityState(): Promise<PushCapabilityState> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'unsupported';
  }

  // 1. Basic Web API check
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }

  // 2. Firebase Messaging support check
  try {
    const supported = await isSupported();
    if (!supported) return 'unsupported';
  } catch (e) {
    return 'unsupported';
  }

  // 3. iOS / iPadOS PWA Standalone check
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;

  if (isIOS && !isStandalone) {
    return 'installed-pwa-required';
  }

  // 4. Notification permission check
  const permission = Notification.permission;
  if (permission === 'denied') return 'denied';
  if (permission === 'granted') return 'granted';
  return 'default';
}

/**
 * Requests Notification permission via explicit user interaction.
 */
export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  try {
    return await Notification.requestPermission();
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return 'unsupported';
  }
}

/**
 * Registers device push token with FCM using the primary Service Worker (/sw.js)
 * and saves it into users/{userId}/push_tokens subcollection.
 */
export async function registerDevicePush(userId: string): Promise<{ success: boolean; token?: string; error?: string }> {
  if (typeof window === 'undefined' || !app || !userId) {
    return { success: false, error: 'Client environment invalid.' };
  }

  const capability = await getPushCapabilityState();
  if (capability === 'unsupported' || capability === 'installed-pwa-required') {
    return { success: false, error: capability };
  }

  if (Notification.permission !== 'granted') {
    return { success: false, error: 'permission-not-granted' };
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn('[Messaging] NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing.');
    return { success: false, error: 'vapid-key-missing' };
  }

  try {
    const messaging = getMessaging(app);

    // Get active primary Service Worker registration (/sw.js)
    let swReg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!swReg) {
      swReg = await navigator.serviceWorker.ready;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swReg,
    });

    if (!token) {
      return { success: false, error: 'token-empty' };
    }

    // Determine device platform
    const ua = navigator.userAgent || '';
    let platform: 'ios' | 'android' | 'desktop' | 'unknown' = 'unknown';
    if (/Android/i.test(ua)) platform = 'android';
    else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'ios';
    else if (/Windows|Macintosh|Linux/i.test(ua)) platform = 'desktop';

    // Save to multi-device subcollection users/{userId}/push_tokens/{tokenId}
    await saveUserPushToken(userId, token, platform);

    return { success: true, token };
  } catch (err: any) {
    console.error('[Messaging] Registration error:', err);
    return { success: false, error: err.message || 'registration-error' };
  }
}

/**
 * Unregisters device push token on logout or push disable.
 */
export async function unregisterDevicePush(userId: string, currentToken?: string): Promise<boolean> {
  if (typeof window === 'undefined' || !app || !userId) return false;

  try {
    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    let token = currentToken;

    if (!token && vapidKey) {
      try {
        const swReg = await navigator.serviceWorker.getRegistration('/sw.js');
        token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg || undefined });
      } catch (e) {}
    }

    if (token) {
      await removeUserPushToken(userId, token);
      await deleteToken(messaging).catch(() => {});
    }

    return true;
  } catch (err) {
    console.warn('[Messaging] Unregister error (best-effort):', err);
    return false;
  }
}

/**
 * Refreshes current device push token on app start or login if permission is already granted.
 */
export async function refreshDevicePushRegistration(userId: string): Promise<void> {
  if (typeof window === 'undefined' || !userId) return;
  const capability = await getPushCapabilityState();
  if (capability === 'granted') {
    await registerDevicePush(userId);
  }
}

// ─── LEGACY ALIAS EXPORTS ───────────────────────────────────────────

export const requestAndGetFCMToken = async (userId?: string): Promise<string | null> => {
  if (typeof window === 'undefined' || !userId) return null;
  const res = await registerDevicePush(userId);
  return res.token || null;
};

export const deleteFCMToken = async (userId?: string): Promise<boolean> => {
  if (typeof window === 'undefined' || !userId) return false;
  return await unregisterDevicePush(userId);
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (typeof window === 'undefined' || !app) return () => {};
  try {
    const messaging = getMessaging(app);
    return onMessage(messaging, callback);
  } catch (e) {
    return () => {};
  }
};
