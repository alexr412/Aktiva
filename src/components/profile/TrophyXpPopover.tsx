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
          "w-[calc(100vw-2rem)] sm:w-96 p-0 border border-slate-200/80 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-2xl rounded-3xl z-50 overflow-hidden text-left",
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 dark:from-emerald-500/20 dark:via-teal-500/20 dark:to-cyan-500/20 p-5 pb-4 border-b border-slate-100 dark:border-neutral-800 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 font-black text-base shrink-0">
                🏆
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white text-base tracking-tight leading-snug">
                  {isDe ? 'Level & XP System' : 'Level & XP System'}
                </h4>
                <p className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">
                  {isDe ? 'So funktioniert der Fortschritt auf Aktiva' : 'How progress works on Aktiva'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors sm:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Section 1: Wie bekommt man XP */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-xs uppercase tracking-wider">
              <Zap className="h-4 w-4 fill-emerald-500/20" />
              <span>{isDe ? 'Wie bekommt man XP?' : 'How to earn XP?'}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-7 w-7 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  <CalendarPlus className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-neutral-200">
                      {isDe ? 'Aktivität erstellen' : 'Create Activity'}
                    </span>
                    <span className="font-black text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full shrink-0">
                      +10 XP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {isDe ? 'Für jede erstellte Aktivität (max. 2x täglich)' : 'For each activity created (max 2x daily)'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-7 w-7 rounded-xl bg-cyan-100 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  <Users className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-neutral-200">
                      {isDe ? 'Erster Teilnehmer' : 'First Participant'}
                    </span>
                    <span className="font-black text-[11px] text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full shrink-0">
                      +20 XP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {isDe ? 'Wenn der 1. Teilnehmer deiner Aktivität beitritt' : 'When the 1st participant joins your activity'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-7 w-7 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-neutral-200">
                      {isDe ? 'Erste Aktivität Bonus' : 'First Activity Bonus'}
                    </span>
                    <span className="font-black text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full shrink-0">
                      +50 XP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {isDe ? 'Einmaliger Bonus für deine allererste Aktivität' : 'One-time bonus for your very first activity'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-2xl bg-slate-50/80 dark:bg-neutral-800/50 border border-slate-100 dark:border-neutral-800/80">
                <div className="h-7 w-7 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-neutral-200">
                      {isDe ? 'Freunde einladen' : 'Invite Friends'}
                    </span>
                    <span className="font-black text-[11px] text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-full shrink-0">
                      +25 XP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5">
                    {isDe ? 'Für jeden geworbenen Freund via Referral-Link' : 'For each referred friend via invitation link'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 dark:border-neutral-800" />

          {/* Section 2: Wofür sind Level da */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-wider">
              <Award className="h-4 w-4" />
              <span>{isDe ? 'Wofür sind Level da?' : 'What are Levels for?'}</span>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100/60 dark:border-indigo-900/30 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-neutral-200">
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                  <span>{isDe ? 'Exklusive Rang-Titel' : 'Exclusive Rank Titles'}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-neutral-400 leading-relaxed">
                  {isDe 
                    ? 'Schalte Ränge frei wie Starter (Lv.1), Entdecker (Lv.5), Aktivist (Lv.10), Stammmitglied (Lv.20), Pionier (Lv.35) und Aktiva Legende (Lv.50+).'
                    : 'Unlock rank titles like Starter (Lv.1), Explorer (Lv.5), Activist (Lv.10), Regular (Lv.20), Pioneer (Lv.35), and Aktiva Legend (Lv.50+).'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-100/60 dark:border-teal-900/30 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-neutral-200">
                  <Sparkles className="h-3.5 w-3.5 text-teal-500" />
                  <span>{isDe ? 'Profil- & Avatar-Rahmen' : 'Profile & Avatar Frames'}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-neutral-400 leading-relaxed">
                  {isDe 
                    ? 'Erhalte mit höheren Leveln farbenfrohe Gradients und leuchtende Rahmen für dein Profilbild.'
                    : 'Get vibrant gradients and glowing borders for your avatar image at higher levels.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Wallet Link */}
        <div className="p-3 bg-slate-50 dark:bg-neutral-900/80 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
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
