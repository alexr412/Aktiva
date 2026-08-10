'use client';

import { Suspense } from 'react';
import { useServiceWorker } from '@/hooks/use-service-worker';
import { ReferralTrackerContent } from '@/components/referral/ReferralTracker';

/**
 * App-weite Initialisierungen die einen Client-Kontext brauchen.
 * Wird einmal im Root-Layout gemountet.
 */
export function AppInit() {
  useServiceWorker();
  return (
    <Suspense fallback={null}>
      <ReferralTrackerContent />
    </Suspense>
  );
}
