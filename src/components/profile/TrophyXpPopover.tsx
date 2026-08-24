'use client';

import React, { useState, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Zap, Award, Sparkles, UserPlus, CalendarPlus, Users, Crown, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface TrophyXpPopoverProps {
  language?: 'de' | 'en';
  children?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  triggerClassName?: string;
}

export function TrophyXpPopover({
  language = 'de',
  children,
  align = 'end',
  side = 'bottom',
  className,
  triggerClassName,
}: TrophyXpPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsOpen(prev => !prev);
  };

  const isDe = language === 'de';

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-full transition-all duration-200 active:scale-95 cursor-pointer select-none group relative inline-flex items-center justify-center",
            triggerClassName
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          aria-label={isDe ? 'Level & XP Informationen anzeigen' : 'Show Level & XP Information'}
        >
          {children || (
            <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center text-emerald-500 font-black text-lg shrink-0 group-hover:bg-emerald-100/80 dark:group-hover:bg-emerald-900/60 group-hover:scale-105 transition-all shadow-sm">
              🏆
            </div>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        className={cn(
          "w-80 sm:w-96 max-w-[calc(100vw-2rem)] max-h-[60vh] sm:max-h-[65vh] flex flex-col p-0 border border-slate-200/80 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-2xl rounded-3xl z-50 overflow-hidden text-left",
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="shrink-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 dark:from-emerald-500/20 dark:via-teal-500/20 dark:to-cyan-500/20 p-4 pb-3 border-b border-slate-100 dark:border-neutral-800 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 font-black text-sm shrink-0">
                🏆
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm tracking-tight leading-snug">
                  {isDe ? 'Level & XP System' : 'Level & XP System'}
                </h4>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-neutral-400">
                  {isDe ? 'Fortschritt & Belohnungen' : 'Progress & Rewards'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors sm:hidden"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body - Fixed Layout & Sleek Dark Scrollbar */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700/80 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-emerald-500/60 transition-colors">
          {/* Section 1: Wie bekommt man XP */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-wider">
              <Zap className="h-3.5 w-3.5 fill-emerald-500/20" />
              <span>{isDe ? 'Wie bekommt man XP?' : 'How to earn XP?'}</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-6 w-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  <CalendarPlus className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[11px] text-slate-800 dark:text-neutral-200">
                      {isDe ? 'Aktivität erstellen' : 'Create Activity'}
                    </span>
                    <span className="font-black text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-md shrink-0">
                      +10 XP
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5 leading-tight">
                    {isDe ? 'Für jede erstellte Aktivität (max. 2x/Tag)' : 'For each activity created (max 2x/day)'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-6 w-6 rounded-lg bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[11px] text-slate-800 dark:text-neutral-200">
                      {isDe ? 'Erster Teilnehmer' : 'First Participant'}
                    </span>
                    <span className="font-black text-[10px] text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded-md shrink-0">
                      +20 XP
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5 leading-tight">
                    {isDe ? 'Wenn der 1. Teilnehmer beitritt' : 'When 1st participant joins'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-6 w-6 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[11px] text-slate-800 dark:text-neutral-200">
                      {isDe ? 'Erste Aktivität Bonus' : 'First Activity Bonus'}
                    </span>
                    <span className="font-black text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md shrink-0">
                      +50 XP
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5 leading-tight">
                    {isDe ? 'Einmaliger Willkommens-Bonus' : 'One-time welcome bonus'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-6 w-6 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  <UserPlus className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-[11px] text-slate-800 dark:text-neutral-200">
                      {isDe ? 'Freunde einladen' : 'Invite Friends'}
                    </span>
                    <span className="font-black text-[10px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded-md shrink-0">
                      +25 XP
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400 mt-0.5 leading-tight">
                    {isDe ? 'Pro geworbenem Freund via Referral' : 'Per referred friend via link'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-neutral-800" />

          {/* Section 2: Wofür sind Level da */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-wider">
              <Award className="h-3.5 w-3.5" />
              <span>{isDe ? 'Wofür sind Level da?' : 'What are Levels for?'}</span>
            </div>

            <div className="space-y-1.5">
              <div className="p-2.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/30 flex items-start gap-2.5">
                <Crown className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-[11px] text-slate-800 dark:text-neutral-200 block">
                    {isDe ? 'Exklusive Rang-Titel' : 'Exclusive Rank Titles'}
                  </span>
                  <p className="text-[10px] text-slate-600 dark:text-neutral-400 leading-tight mt-0.5">
                    {isDe 
                      ? 'Ränge wie Starter (Lv.1), Entdecker (Lv.5), Aktivist (Lv.10), Stammmitglied (Lv.20), Pionier (Lv.35) & Aktiva Legende (Lv.50+).'
                      : 'Titles like Starter (Lv.1), Explorer (Lv.5), Activist (Lv.10), Regular (Lv.20), Pioneer (Lv.35) & Legend (Lv.50+).'}
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-100/60 dark:border-teal-900/30 flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-teal-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-[11px] text-slate-800 dark:text-neutral-200 block">
                    {isDe ? 'Profil- & Avatar-Rahmen' : 'Profile & Avatar Frames'}
                  </span>
                  <p className="text-[10px] text-slate-600 dark:text-neutral-400 leading-tight mt-0.5">
                    {isDe 
                      ? 'Farbenfrohe Level-Gradients & leuchtende Rahmen für dein Profilbild.'
                      : 'Vibrant level gradients & glowing frames for your profile avatar.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Wallet Link */}
        <div className="shrink-0 p-2.5 px-3.5 bg-slate-50 dark:bg-neutral-900/80 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between text-[10px]">
          <span className="text-slate-400 dark:text-neutral-500 font-medium">
            {isDe ? 'Deine XP im Wallet einsehen' : 'View your XP in Wallet'}
          </span>
          <Link
            href="/wallet"
            onClick={() => setIsOpen(false)}
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
          >
            <span>{isDe ? 'Zum Wallet' : 'Go to Wallet'}</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
