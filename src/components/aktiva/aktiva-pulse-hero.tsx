'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Activity } from '@/lib/types';
import { translateAppString } from '@/lib/tag-config';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AktivaPulseHeroProps {
  cityName: string | null;
  currentViewType: 'places' | 'activities' | 'favorites';
  visiblePlaceCount: number;
  eligibleActivities: Activity[];
  language: 'de' | 'en';
  onExplore: () => void;
}

/**
 * Defensive utility to normalize any incoming timestamp format into milliseconds since epoch.
 * Rejects invalid, NaN, empty, or ambiguous formats safely.
 */
function normalizeTimestamp(val: any): number | null {
  if (!val) return null;
  // 1. Firestore Timestamp check
  if (typeof val.toMillis === 'function') {
    return val.toMillis();
  }
  if (typeof val.toDate === 'function') {
    return val.toDate().getTime();
  }
  if (typeof val.seconds === 'number' && !isNaN(val.seconds)) {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  }
  // 2. JavaScript Date check
  if (val instanceof Date) {
    const time = val.getTime();
    return isNaN(time) ? null : time;
  }
  // 3. ISO string or direct numeric millisecond timestamp
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Helper to normalize city names.
 * Rejects empty values, loading indicators, or default placeholders.
 */
function normalizeCityName(city: string | null | undefined): string | null {
  if (!city) return null;
  const trimmed = city.trim();
  return trimmed || null;
}

export function AktivaPulseHero({
  cityName,
  currentViewType,
  visiblePlaceCount,
  eligibleActivities,
  language,
  onExplore
}: AktivaPulseHeroProps) {
  const [referenceTime, setReferenceTime] = useState<number | null>(null);

  // Set reference time after mount to prevent server/client hydration mismatches
  useEffect(() => {
    setReferenceTime(Date.now());
    
    // Refresh the client reference time once per minute
    const interval = setInterval(() => {
      setReferenceTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const normalizedCity = useMemo(() => normalizeCityName(cityName), [cityName]);

  // Starting soon calculations (defensive client-side check)
  const startingSoonCount = useMemo(() => {
    if (referenceTime === null || currentViewType !== 'activities') return 0;
    const twoHoursLater = referenceTime + 2 * 60 * 60 * 1000;

    return eligibleActivities.filter((act) => {
      // Exclude completed or cancelled status defensively
      if (act.status === 'completed' || act.status === 'cancelled') return false;
      const startMs = normalizeTimestamp(act.activityDate);
      if (startMs === null) return false;
      return startMs > referenceTime && startMs <= twoHoursLater;
    }).length;
  }, [eligibleActivities, referenceTime, currentViewType]);

  // Determine dynamic heading
  const headingText = normalizedCity
    ? translateAppString('pulse.heading.city', language, normalizedCity)
    : translateAppString('pulse.heading.near_you', language);

  // Determine dynamic stats and descriptions based on props and loaded dataset
  const renderStats = () => {
    if (currentViewType === 'favorites') {
      return (
        <span className="text-xs md:text-sm text-emerald-100 font-medium">
          {translateAppString('pulse.fallback.places', language)}
        </span>
      );
    }

    if (currentViewType === 'activities') {
      if (eligibleActivities.length === 0) {
        return (
          <span className="text-xs md:text-sm text-emerald-100 font-medium">
            {translateAppString('pulse.fallback', language)}
          </span>
        );
      }

      return (
        <div className="flex flex-col gap-1 w-full text-emerald-100">
          <span className="text-xs md:text-sm font-medium">
            {translateAppString('pulse.activities_count', language, eligibleActivities.length)}
          </span>
          {referenceTime !== null && startingSoonCount > 0 && (
            <span className="text-[10px] md:text-xs font-semibold bg-emerald-500/20 py-0.5 px-2 rounded-full self-start border border-emerald-400/20 mt-0.5">
              🚀 {translateAppString('pulse.starting_soon_count', language, startingSoonCount)}
            </span>
          )}
        </div>
      );
    }

    // Default: 'places' view
    if (visiblePlaceCount === 0) {
      return (
        <span className="text-xs md:text-sm text-emerald-100 font-medium">
          {translateAppString('pulse.fallback.places', language)}
        </span>
      );
    }

    return (
      <span className="text-xs md:text-sm text-emerald-100 font-medium">
        {translateAppString('pulse.places_count', language, visiblePlaceCount)}
      </span>
    );
  };

  return (
    <div 
      className="w-full flex flex-col justify-between py-6 px-5 md:px-7 rounded-[22px] bg-gradient-to-br from-emerald-600 to-teal-800 dark:from-emerald-800 dark:to-teal-950 text-white shadow-premium relative overflow-hidden transition-all duration-300 gap-4"
      aria-labelledby="pulse-heading"
    >
      {/* Decorative subtle visual elements */}
      <div 
        className="absolute -right-8 -bottom-8 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" 
        aria-hidden="true" 
      />
      <div 
        className="absolute right-[10%] top-[10%] w-24 h-24 bg-emerald-300/5 rounded-full blur-xl pointer-events-none" 
        aria-hidden="true" 
      />

      {/* Header and Eyebrow */}
      <div className="flex flex-col gap-2 z-10">
        <div className="flex items-center gap-2">
          {/* Status breathing pulse dot */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-200">
            {translateAppString('pulse.eyebrow', language)}
          </span>
        </div>
        <h2 
          id="pulse-heading" 
          className="text-lg md:text-xl font-black tracking-tight leading-tight text-white m-0"
        >
          {headingText}
        </h2>
      </div>

      {/* Derived Statistics Section */}
      <div className="min-h-[2.5rem] flex items-center z-10" aria-live="polite">
        {renderStats()}
      </div>

      {/* Primary Action Button */}
      <div className="z-10 mt-1">
        <Button
          onClick={onExplore}
          className="h-11 px-5 rounded-xl bg-white hover:bg-slate-50 text-emerald-800 font-black text-xs transition-all uppercase tracking-wider active:scale-[0.98] border-none shadow-sm flex items-center gap-1.5"
          aria-label={translateAppString('pulse.cta', language)}
        >
          <Compass className="h-4 w-4" />
          {translateAppString('pulse.cta', language)}
        </Button>
      </div>
    </div>
  );
}
