'use client';

import { useState, useEffect, useMemo } from 'react';
import { Compass, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { translateAppString } from '@/lib/tag-config';

interface AktivaPulseHeroProps {
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

export function AktivaPulseHero({
  cityName,
  openRoomsCount,
  uniqueParticipantsCount,
  language,
  onExplore,
  loading = false
}: AktivaPulseHeroProps) {
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
        className="w-full flex flex-col justify-between py-3.5 px-[18px] md:p-6 rounded-[22px] bg-gradient-to-br from-emerald-600 to-teal-800 dark:from-emerald-800 dark:to-teal-950 text-white shadow-premium relative overflow-hidden transition-all duration-300 gap-1.5 md:gap-4 pointer-events-none select-none"
        aria-hidden="true"
      >
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400/60" />
            <div className="h-3 w-16 bg-white/20 rounded animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="h-5 w-2/3 bg-white/20 rounded mt-1 animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="min-h-[2.5rem] flex items-center">
          <div className="h-4 w-1/2 bg-white/10 rounded animate-pulse motion-reduce:animate-none" />
        </div>
        <div>
          <div className="h-11 w-32 bg-white/30 rounded-xl mt-1 animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full flex flex-col justify-between py-3.5 px-[18px] md:p-6 rounded-[22px] bg-gradient-to-br from-emerald-600 to-teal-800 dark:from-emerald-800 dark:to-teal-950 text-white shadow-premium relative overflow-hidden transition-all duration-300 gap-1.5 md:gap-3"
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

      {/* Row 1 on mobile: Eyebrow left, indicators right. On desktop: Eyebrow + breathing dot */}
      <div className="flex items-center justify-between w-full md:block">
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

        {/* Indicators on the right (Mobile only) */}
        {metricsAvailable && !prefersReducedMotion && (
          <div 
            className="flex items-center md:hidden -mr-2.5" 
            aria-label={language === 'de' ? 'Statistik-Auswahl' : 'Metric selection'}
          >
            <button
              aria-pressed={activeMetric === 'rooms'}
              aria-label={language === 'de' ? 'Offene Räume anzeigen' : 'Show open rooms'}
              onClick={() => handleManualSwitch('rooms')}
              className="h-10 w-10 flex items-center justify-center rounded-full transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span 
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                  activeMetric === 'rooms' ? "bg-white" : "bg-white/40"
                )} 
              />
            </button>
            <button
              aria-pressed={activeMetric === 'participants'}
              aria-label={language === 'de' ? 'Teilnehmer anzeigen' : 'Show participants'}
              onClick={() => handleManualSwitch('participants')}
              className="h-10 w-10 flex items-center justify-center rounded-full transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <span 
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                  activeMetric === 'participants' ? "bg-white" : "bg-white/40"
                )} 
              />
            </button>
          </div>
        )}
      </div>

      {/* Row 2: Heading */}
      <h2 
        id="pulse-heading" 
        className="text-[17px] md:text-xl font-black tracking-tight leading-tight text-white m-0"
      >
        {headingText}
      </h2>

      {/* Row 3 on mobile: stats on left, CTA on right. On desktop: stats on top, CTA at the bottom */}
      <div className="flex items-center justify-between gap-3 w-full md:flex-col md:items-stretch md:gap-3">
        {/* Stats area */}
        <div className="flex-1 md:flex md:items-center md:justify-between w-full">
          <div className="grid grid-cols-1 grid-rows-1 min-h-[1.5rem] md:min-h-[2.5rem] items-center w-full">
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

          {/* Desktop-only indicator dots */}
          {metricsAvailable && !prefersReducedMotion && (
            <div 
              className="hidden md:flex items-center gap-0.5 shrink-0" 
              aria-label={language === 'de' ? 'Statistik-Auswahl' : 'Metric selection'}
            >
              <button
                aria-pressed={activeMetric === 'rooms'}
                aria-label={language === 'de' ? 'Offene Räume anzeigen' : 'Show open rooms'}
                onClick={() => handleManualSwitch('rooms')}
                className="h-10 w-10 flex items-center justify-center rounded-full transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span 
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                    activeMetric === 'rooms' ? "bg-white" : "bg-white/40"
                  )} 
                />
              </button>
              <button
                aria-pressed={activeMetric === 'participants'}
                aria-label={language === 'de' ? 'Teilnehmer anzeigen' : 'Show participants'}
                onClick={() => handleManualSwitch('participants')}
                className="h-10 w-10 flex items-center justify-center rounded-full transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span 
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-colors duration-200",
                    activeMetric === 'participants' ? "bg-white" : "bg-white/40"
                  )} 
                />
              </button>
            </div>
          )}
        </div>

        {/* CTA Button */}
        <div className="shrink-0 flex justify-end md:justify-start">
          <Button
            onClick={onExplore}
            disabled={openRoomsCount === null}
            className="h-11 px-4 md:px-5 rounded-xl bg-white hover:bg-slate-50 text-emerald-800 font-black text-xs transition-all uppercase tracking-wider active:scale-[0.985] border-none shadow-sm flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={openRoomsCount === 0 ? translateAppString('pulse.cta.create', language) : translateAppString('pulse.cta.open_rooms', language)}
            aria-disabled={openRoomsCount === null}
          >
            {openRoomsCount === 0 ? <Plus className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
            {openRoomsCount === 0 ? translateAppString('pulse.cta.create', language) : translateAppString('pulse.cta.open_rooms', language)}
          </Button>
        </div>
      </div>
    </div>
  );
}
