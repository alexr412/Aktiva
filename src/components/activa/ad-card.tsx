'use client';

import { Megaphone, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';

interface AdCardProps {
  adIndex?: number;
  className?: string;
}

export function AdCard({ adIndex, className }: AdCardProps) {
  const language = useLanguage();
  const isDe = language === 'de';

  return (
    <article
      aria-label={isDe ? "Werbeanzeige" : "Advertisement"}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-[22px] bg-gradient-to-br from-slate-50 via-white to-amber-50/40 dark:from-neutral-900 dark:via-neutral-900 dark:to-amber-950/20 border border-slate-200/60 dark:border-neutral-800/80 shadow-premium transition-all duration-200 p-3 sm:p-4 min-h-[210px] w-full h-full min-w-0 select-none",
        className
      )}
    >
      {/* Top row with Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Megaphone className="h-3 w-3" />
          {isDe ? "Anzeige" : "Sponsored"}
        </span>
        <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500">
          #{adIndex ?? 1}
        </span>
      </div>

      {/* Main Content Placeholder */}
      <div className="my-auto flex flex-col items-center justify-center text-center py-2 px-1">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 shadow-sm transition-transform duration-200 group-hover:scale-105">
          <Megaphone className="h-5 w-5" />
        </div>
        <h4 className="text-xs font-bold text-slate-800 dark:text-neutral-200 line-clamp-1">
          {isDe ? "Werbeplatz" : "Ad Space"}
        </h4>
        <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-tight">
          {isDe ? "Hier könnte Ihre Werbung stehen" : "Your ad could be here"}
        </p>
      </div>

      {/* Bottom Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-neutral-800/60 pt-2 text-[10px] text-neutral-400 dark:text-neutral-500">
        <span>Activa Ads</span>
        <ExternalLink className="h-3 w-3 opacity-60" />
      </div>
    </article>
  );
}
