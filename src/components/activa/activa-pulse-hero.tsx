'use client';

import { useMemo } from 'react';
import { Compass, Plus, DoorOpen, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  // Derive city and heading
  const normalizedCity = useMemo(() => normalizeCityName(cityName), [cityName]);
  const headingText = normalizedCity
    ? translateAppString('pulse.heading.city', language, normalizedCity)
    : translateAppString('pulse.heading.near_you', language);

  const metricsAvailable = openRoomsCount !== null && uniqueParticipantsCount !== null;

  // Loading state placeholder skeleton
  if (loading) {
    return (
      <div 
        className="w-full flex flex-row items-center justify-between py-4 px-[18px] md:p-5 lg:py-5 lg:px-6 rounded-[22px] bg-gradient-to-br from-emerald-600 to-teal-800 dark:from-emerald-800 dark:to-teal-950 text-white shadow-premium relative overflow-hidden transition-all duration-300 gap-4 pointer-events-none select-none min-h-[135px]"
        aria-hidden="true"
      >
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-teal-400/10 rounded-full blur-2xl" />
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400/60" />
            <div className="h-3 w-20 bg-white/20 rounded animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="h-6 w-3/4 max-w-sm bg-white/20 rounded animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-1/2 max-w-xs bg-white/10 rounded animate-pulse motion-reduce:animate-none" />
          <div className="h-10 w-44 bg-white/30 rounded-xl mt-1 animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="shrink-0 flex items-center">
          <div className="h-20 w-28 bg-white/10 rounded-xl animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="w-full flex flex-row items-center justify-between py-4 px-[18px] md:p-5 lg:py-5 lg:px-6 rounded-[22px] bg-gradient-to-br from-emerald-600 to-teal-800 dark:from-emerald-800 dark:to-teal-950 text-white shadow-premium relative overflow-hidden transition-all duration-300 gap-4 min-h-[135px]"
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

      {/* Left side content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 gap-2">
        {/* Eyebrow */}
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

        {/* Text block: Heading & Subline */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <h2 
            id="pulse-heading" 
            className="text-[17px] md:text-xl lg:text-xl xl:text-2xl font-black tracking-tight leading-tight text-white m-0 truncate"
          >
            {headingText}
          </h2>

          <p className="text-xs md:text-sm text-emerald-100/90 font-medium leading-tight m-0 truncate">
            {!metricsAvailable
              ? translateAppString('pulse.location_fallback', language)
              : translateAppString('pulse.unique_participants_count', language, uniqueParticipantsCount ?? 0)}
          </p>
        </div>

        {/* CTA Button positioned on the left under text block */}
        <div className="pt-1 flex items-center justify-start">
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

      {/* Right side fixed info panel */}
      {metricsAvailable && (
        <div className="shrink-0 flex flex-col rounded-xl bg-white/[0.07] border border-white/10 px-3.5 py-2.5 min-w-[100px] md:min-w-[120px] shadow-sm">
          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-white whitespace-nowrap">
            <DoorOpen className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>
              {openRoomsCount}{' '}
              {language === 'de'
                ? openRoomsCount === 1 ? 'Raum' : 'Räume'
                : openRoomsCount === 1 ? 'Room' : 'Rooms'}
            </span>
          </div>

          <div className="my-1.5 h-px w-full bg-white/10" />

          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-white whitespace-nowrap">
            <Users className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>
              {uniqueParticipantsCount}{' '}
              {language === 'de'
                ? uniqueParticipantsCount === 1 ? 'Person' : 'Personen'
                : uniqueParticipantsCount === 1 ? 'Person' : 'People'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
