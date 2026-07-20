'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';
import { useLanguage } from './use-language';
import { isPremiumActive, getParticipantLimit, formatPremiumExpiry, parseTimestampMillis } from '@/lib/types';

export function useActivePremium() {
  const { userProfile } = useAuth();
  const language = useLanguage();

  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!userProfile?.isPremium || !userProfile.premiumExpiresAt) {
      return;
    }

    const expiresMillis = parseTimestampMillis(userProfile.premiumExpiresAt);
    if (expiresMillis === null) return;

    const remainingMs = expiresMillis - Date.now();
    if (remainingMs <= 0) {
      setNow(Date.now());
      return;
    }

    // Set timer to trigger live UI update at exact second of expiration
    const timer = setTimeout(() => {
      setNow(Date.now());
    }, remainingMs + 50); // Small buffer to ensure Date.now() > expiresMillis

    return () => clearTimeout(timer);
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
