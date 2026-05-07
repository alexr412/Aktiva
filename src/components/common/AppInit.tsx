'use client';

import { useServiceWorker } from '@/hooks/use-service-worker';

/**
 * App-weite Initialisierungen die einen Client-Kontext brauchen.
 * Wird einmal im Root-Layout gemountet.
 */
export function AppInit() {
  useServiceWorker();
  return null;
}
