'use client';

import { Megaphone, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import styles from './spot-card.module.css';

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
        styles.card, styles.adCard,
        className
      )}
    >
      {/* Top row with Badge */}
      <div className={styles.adTop}>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Megaphone className="h-3 w-3" />
          {isDe ? "Anzeige" : "Sponsored"}
        </span>
        <span className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500">
          #{adIndex ?? 1}
        </span>
      </div>

      {/* Main Content Placeholder */}
      <div className={styles.adContent}>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 shadow-sm transition-transform duration-200 group-hover:scale-105">
          <Megaphone className="h-5 w-5" />
        </div>
        <h4 className="text-sm font-semibold">
          {isDe ? "Werbeplatz" : "Ad Space"}
        </h4>
        <p className="mt-1 text-xs leading-relaxed">
          {isDe ? "Hier könnte Ihre Werbung stehen" : "Your ad could be here"}
        </p>
      </div>

      {/* Bottom Footer */}
      <div className={styles.adFooter}>
        <span>Activa Ads</span>
        <ExternalLink className="h-3 w-3 opacity-60" />
      </div>
    </article>
  );
}
