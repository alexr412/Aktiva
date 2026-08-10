'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { extractReferralCode, storePendingReferralCode } from '@/lib/referral';

export function ReferralTrackerContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = extractReferralCode(searchParams);
    if (code) {
      storePendingReferralCode(code);
    }
  }, [searchParams]);

  return null;
}
