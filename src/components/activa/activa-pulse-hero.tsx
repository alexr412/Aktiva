'use client';

import { useState, useEffect, useMemo } from 'react';
import { Compass, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { translateAppString } from '@/lib/tag-config';

export interface ActivaPulseHeroProps {
  cityName: string | null;
  openRoomsCount: number | null;
  uniqueParticipantsCount: number | null;
  language: 'de' | 'en';
  onExplore: () => void;
  loading?: boolean;
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

export function ActivaPulseHero({
  cityName,
  openRoomsCount,
  uniqueParticipantsCount,
  language,
  onExplore,
  loading = false
}: ActivaPulseHeroProps) {
  // Unconditional Hook declarations first
  const [activeMetric, setActiveMetric] = useState<'rooms' | 'participants'>('rooms');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);

  // Monitor prefers-reduced-motion media query
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // Sync to open-rooms metric if reduced motion is requested
  useEffect(() => {
    if (prefersReducedMotion) {
      setActiveMetric('rooms');
    }
  }, [prefersReducedMotion]);

  // Derive city and heading
  const normalizedCity = useMemo(() => normalizeCityName(cityName), [cityName]);
  const headingText = normalizedCity
    ? translateAppString('pulse.heading.city', language, normalizedCity)
    : translateAppString('pulse.heading.near_you', language);

  const metricsAvailable = openRoomsCount !== null && uniqueParticipantsCount !== null;

  // Handle rotation interval (5 seconds)
  useEffect(() => {
    if (loading || prefersReducedMotion || !metricsAvailable) return;

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveMetric((prev) => (prev === 'rooms' ? 'participants' : 'rooms'));
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [loading, prefersReducedMotion, metricsAvailable, resetTrigger]);

  const handleManualSwitch = (metric: 'rooms' | 'participants') => {
    setActiveMetric(metric);
    setResetTrigger((prev) => prev + 1); // Reset/restart interval
  };

  // Loading state placeholder skeleton
  if (loading) {
    return (
      <div 
        className="w-full flex flex-col lg:flex-row lg:items-center lg:justify-between py-3.5 px-[18px] md:p-5 lg:py-[18px] lg:px-6 rounded-[22px] bg-gradient-to-br from-emerald-600 to-teal-800 dark:from-emerald-800 dark:to-teal-950 text-white shadow-premium relative overflow-hidden transition-all duration-300 gap-2 md:gap-3 lg:gap-4 pointer-events-none select-none min-h-[120px] lg:min-h-[135px]"
        aria-hidden="true"
      >
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl" />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400/60" />
            <div className="h-3 w-16 bg-white/20 rounded animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="h-5 w-2/3 max-w-sm bg-white/20 rounded mt-1 animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-1/2 max-w-xs bg-white/10 rounded animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="shrink-0 flex justify-end lg:justify-center items-center">
          <div className="h-10 lg:h-11 w-32 lg:w-40 bg-white/30 rounded-xl animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full flex flex-col lg:flex-row lg:items-center lg:justify-between py-3.5 px-[18px] md:p-5 lg:py-[18px] lg:px-6 rounded-[22px] bg-gradient-to-br from-emerald-600 to-teal-800 dark:from-emerald-800 dark:to-teal-950 text-white shadow-premium relative overflow-hidden transition-all duration-300 gap-1.5 md:gap-2 lg:gap-4 min-h-[120px] lg:min-h-[135px]"
      aria-labelledby="pulse-heading"
    >
      {/* Decorative background blurs */}
      <div 
        className="absolute -right-8 -bottom-8 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl pointer-events-none" 
        aria-hidden="true" 
      />
      <div 
        className="absolute right-[10%] top-[10%] w-24 h-24 bg-emerald-300/5 rounded-full blur-xl pointer-events-none" 
        aria-hidden="true" 
      />

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col justify-between lg:justify-center min-w-0 gap-1 lg:gap-1">
        {/* Eyebrow & Slider Navigation */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1.5">
            {/* Status breathing pulse dot */}
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-emerald-200">
              {translateAppString('pulse.eyebrow', language)}
            </span>
          </div>

          {/* Chevron Navigation Controls */}
          {metricsAvailable && !prefersReducedMotion && (
            <div 
              className="flex items-center gap-1.5 shrink-0" 
              aria-label={language === 'de' ? 'Statistik-Auswahl' : 'Metric selection'}
            >
              <button
                type="button"
                disabled={activeMetric === 'rooms'}
                aria-label={language === 'de' ? 'Vorheriger Slide' : 'Previous slide'}
                onClick={() => handleManualSwitch('rooms')}
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/70 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                  activeMetric === 'rooms'
                    ? "opacity-30 cursor-default pointer-events-none"
                    : "hover:bg-white/10 hover:text-white active:bg-white/15 cursor-pointer"
                )}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={activeMetric === 'participants'}
                aria-label={language === 'de' ? 'Nächster Slide' : 'Next slide'}
                onClick={() => handleManualSwitch('participants')}
                className={cn(
                  "w-7 h-7 flex items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/70 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                  activeMetric === 'participants'
                    ? "opacity-30 cursor-default pointer-events-none"
                    : "hover:bg-white/10 hover:text-white active:bg-white/15 cursor-pointer"
                )}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Heading */}
        <h2 
          id="pulse-heading" 
          className="text-[17px] md:text-xl lg:text-lg xl:text-xl font-black tracking-tight leading-tight text-white m-0 truncate"
        >
          {headingText}
        </h2>

        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-1 grid-rows-1 min-h-[1.5rem] lg:min-h-[1.25rem] items-center">
            {!metricsAvailable ? (
              <span className="col-start-1 row-start-1 text-xs md:text-sm text-emerald-100 font-medium leading-tight animate-in fade-in duration-300">
                {translateAppString('pulse.location_fallback', language)}
              </span>
            ) : (
              <>
                <div 
                  className={cn(
                    "col-start-1 row-start-1 flex flex-col transition-all duration-300",
                    prefersReducedMotion && "transition-none",
                    activeMetric === 'rooms' ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
                  )}
                >
                  <span className="text-xs md:text-sm text-emerald-100 font-medium leading-tight">
                    {translateAppString('pulse.open_rooms_count', language, openRoomsCount ?? 0)}
                  </span>
                </div>
                <div 
                  className={cn(
                    "col-start-1 row-start-1 flex flex-col transition-all duration-300",
                    prefersReducedMotion && "transition-none",
                    activeMetric === 'participants' ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none"
                  )}
                >
                  <span className="text-xs md:text-sm text-emerald-100 font-medium leading-tight">
                    {translateAppString('pulse.unique_participants_count', language, uniqueParticipantsCount ?? 0)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* CTA Button Column */}
      <div className="shrink-0 flex justify-end lg:justify-center items-center">
        <Button
          onClick={onExplore}
          disabled={openRoomsCount === null}
          className="h-10 lg:h-11 px-4 lg:px-5 rounded-xl bg-white hover:bg-slate-50 text-emerald-800 font-black text-xs transition-all uppercase tracking-wider active:scale-[0.985] border-none shadow-sm flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          aria-label={openRoomsCount === 0 ? translateAppString('pulse.cta.create', language) : translateAppString('pulse.cta.open_rooms', language)}
          aria-disabled={openRoomsCount === null}
        >
          {openRoomsCount === 0 ? <Plus className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
          {openRoomsCount === 0 ? translateAppString('pulse.cta.create', language) : translateAppString('pulse.cta.open_rooms', language)}
        </Button>
      </div>
    </div>
  );
}

