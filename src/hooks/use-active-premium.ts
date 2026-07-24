'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';
import { useLanguage } from './use-language';
import { isPremiumActive, getParticipantLimit, formatPremiumExpiry, parseTimestampMillis, UserProfile } from '@/lib/types';

// Maximum delay for setTimeout to prevent 32-bit signed integer overflow (~24.85 days)
export const MAX_SAFE_TIMER_MS = 2_147_483_000;

export function useActivePremium(overrideProfile?: UserProfile | null) {
  const { userProfile: authProfile } = useAuth();
  const userProfile = overrideProfile !== undefined ? overrideProfile : authProfile;
  const language = useLanguage();

  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!userProfile?.isPremium || !userProfile.premiumExpiresAt) {
      return;
    }

    const expiresMillis = parseTimestampMillis(userProfile.premiumExpiresAt);
    if (expiresMillis === null) return;

    let timerId: NodeJS.Timeout | null = null;

    const scheduleCheck = () => {
      const remainingMs = expiresMillis - Date.now();
      if (remainingMs <= 0) {
        setNow((prev) => (prev < expiresMillis ? Date.now() : prev));
        return;
      }

      // Cap timer delay at MAX_SAFE_TIMER_MS to avoid integer overflow
      const delay = Math.min(remainingMs + 50, MAX_SAFE_TIMER_MS);
      timerId = setTimeout(() => {
        setNow(Date.now());
        if (expiresMillis - Date.now() > 0) {
          scheduleCheck();
        }
      }, delay);
    };

    scheduleCheck();

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [userProfile?.isPremium, userProfile?.premiumExpiresAt]);

  const active = isPremiumActive(userProfile, now);
  const participantLimit = getParticipantLimit(userProfile, now);
  const formattedExpiry = formatPremiumExpiry(userProfile, language);

  return {
    isPremium: active,
    participantLimit,
    formattedExpiry,
    isOrganizer: !!userProfile?.isOrganizer,
  };
}
