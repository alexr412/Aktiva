'use client';

import { initializeAppCheck, ReCaptchaEnterpriseProvider, CustomProvider, getToken, type AppCheck } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
    _aktiva_app_check_instance?: AppCheck;
    _aktiva_app_check_promise?: Promise<AppCheck | null>;
  }
}

const appCheckSingletons = new WeakMap<FirebaseApp, AppCheck>();

export function isLocalEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location?.hostname || '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  return isLocalHost && isDevOrTest;
}

/**
 * Synchronously initializes Firebase App Check if enabled.
 * Returns existing singleton for given FirebaseApp instance.
 * Uses WeakMap singleton per FirebaseApp.
 * Disables external reCAPTCHA calls in local emulator mode via CustomProvider.
 */
export function initializeAppCheckIfEnabled(firebaseApp: FirebaseApp): AppCheck | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (appCheckSingletons.has(firebaseApp)) {
    return appCheckSingletons.get(firebaseApp)!;
  }

  const isEnabled = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED === 'true';
  if (!isEnabled) {
    return null;
  }

  const useEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' || 
                      process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

  let provider;
  if (useEmulator) {
    const isStrictlyLocal = isLocalEnvironment() && process.env.NODE_ENV !== 'production';
    if (!isStrictlyLocal) {
      throw new Error('[AppCheck Security] Cannot enable emulator CustomProvider in non-local or production environment');
    }
    provider = new CustomProvider({
      getToken: async () => ({
        token: 'mock-emulator-app-check-token',
        expireTimeMillis: Date.now() + 3600000,
      }),
    });
  } else {
    const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
    if (!siteKey || siteKey.trim() === '') {
      throw new Error('[AppCheck Fail-Closed] NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is missing while NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED is true');
    }
    provider = new ReCaptchaEnterpriseProvider(siteKey);
  }

  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const hostname = window.location?.hostname || '';
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      if (window.FIREBASE_APPCHECK_DEBUG_TOKEN === undefined) {
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
    }
  }

  const isAutoRefresh = process.env.NODE_ENV !== 'test' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS !== 'true';

  const appCheck = initializeAppCheck(firebaseApp, {
    provider,
    isTokenAutoRefreshEnabled: isAutoRefresh,
  });

  appCheckSingletons.set(firebaseApp, appCheck);
  window._aktiva_app_check_instance = appCheck;
  return appCheck;
}

/**
 * Async backward-compatible helper for fetching App Check instance.
 */
export async function getOrInitAppCheck(targetApp?: FirebaseApp | null): Promise<AppCheck | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const isEnabled = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED === 'true';
  if (!isEnabled) {
    return null;
  }

  if (targetApp) {
    const instance = initializeAppCheckIfEnabled(targetApp);
    if (instance) return instance;
  }

  if (window._aktiva_app_check_instance) {
    return window._aktiva_app_check_instance;
  }

  if (!targetApp) {
    const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY;
    if (!siteKey || siteKey.trim() === '') {
      throw new Error('[AppCheck Fail-Closed] NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY is missing while NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED is true');
    }
  }

  return window._aktiva_app_check_instance || null;
}

