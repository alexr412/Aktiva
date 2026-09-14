'use client';

import { getToken } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';
import { getOrInitAppCheck } from './firebase/app-check';
import { app as clientApp } from './firebase/client';

export interface FetchWithAppCheckOptions extends RequestInit {
  idToken?: string;
  timeoutMs?: number;
  enforceClientCheck?: boolean;
  firebaseApp?: FirebaseApp | null;
}

/**
 * Universal Client API Fetch Wrapper with Firebase App Check Header Injection.
 * Used exclusively for Custom Next.js API Routes (/api/geoapify, /api/parse-intent, /api/admin/usage).
 * MUST NOT be used for Firebase Callable Functions (httpsCallable) as the Firebase SDK handles Callables automatically.
 */
export async function fetchWithAppCheck(
  input: RequestInfo | URL,
  options: FetchWithAppCheckOptions = {}
): Promise<Response> {
  // 1. SSR Guard
  if (typeof window === 'undefined') {
    throw new Error('[fetchWithAppCheck] Client API fetch wrapper cannot be executed in Server Side Rendering (SSR) context');
  }

  const { idToken, timeoutMs = 10000, enforceClientCheck = false, firebaseApp, headers: rawHeaders, signal: userSignal, ...restInit } = options;

  // 2. Setup Headers Object & Sanitize Pre-existing App Check Header
  const reqHeaders = new Headers(rawHeaders || {});
  reqHeaders.delete('X-Firebase-AppCheck');
  reqHeaders.delete('x-firebase-appcheck');

  // 3. Pre-aborted User Signal Guard
  if (userSignal?.aborted) {
    throw userSignal.reason || new Error('Request aborted before start');
  }

  // 4. Attempt App Check Token Retrieval
  let appCheckToken: string | null = null;
  try {
    const targetApp = firebaseApp !== undefined ? firebaseApp : clientApp;
    const appCheck = await getOrInitAppCheck(targetApp);
    if (appCheck) {
      const tokenResult = await getToken(appCheck, false);
      if (tokenResult && tokenResult.token) {
        appCheckToken = tokenResult.token;
      }
    }
  } catch (err) {
    if (enforceClientCheck) {
      throw new Error(`[fetchWithAppCheck] Failed to acquire App Check token: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.warn('[fetchWithAppCheck Observation] Proceeding without App Check header due to token retrieval failure');
  }

  if (enforceClientCheck && !appCheckToken) {
    throw new Error('[fetchWithAppCheck] App Check token is required but could not be obtained');
  }

  // 5. Inject App Check Header
  if (appCheckToken) {
    reqHeaders.set('X-Firebase-AppCheck', appCheckToken);
  }

  // 6. Inject Authorization Bearer Token if provided
  if (idToken) {
    reqHeaders.set('Authorization', `Bearer ${idToken}`);
  }

  // 7. Setup Timeout Signal with Timer Cleanup & Abort Listener Cleanup
  const controller = new AbortController();
  let timerId: ReturnType<typeof setTimeout> | null = null;

  if (timeoutMs > 0) {
    timerId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  }

  const onUserAbort = () => {
    if (timerId) clearTimeout(timerId);
    controller.abort(userSignal?.reason);
  };

  if (userSignal) {
    userSignal.addEventListener('abort', onUserAbort);
  }

  try {
    const response = await fetch(input, {
      ...restInit,
      headers: reqHeaders,
      signal: controller.signal,
    });
    return response;
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
    if (userSignal) {
      userSignal.removeEventListener('abort', onUserAbort);
    }
  }
}

