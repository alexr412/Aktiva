'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FeedSortMode } from '@/lib/feed-sort';
import { ArrowDownWideNarrow } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FeedSortSelect({ value, onChange, language, compact = false }: {
  value: FeedSortMode;
  onChange: (value: FeedSortMode) => void;
  language: string;
  compact?: boolean;
}) {
  const label = language === 'de' ? 'Sortieren' : 'Sort';
  return (
    <div className="flex items-center justify-end gap-2">
      <span id="feed-sort-label" className={compact ? 'sr-only' : 'text-xs font-semibold text-slate-500 dark:text-neutral-400'}>
        {label}
      </span>
      <Select value={value} onValueChange={next => {
        if (next === 'recommended' || next === 'distance') onChange(next);
      }}>
        <SelectTrigger aria-labelledby="feed-sort-label" className={cn('h-11 border-border bg-card text-xs shadow-sm dark:border-neutral-800 dark:bg-neutral-900', compact ? 'w-[144px] gap-1 rounded-xl px-2 font-semibold' : 'w-[160px] rounded-2xl font-bold')}>
          {compact && <ArrowDownWideNarrow className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-2xl">
          <SelectItem value="recommended">{language === 'de' ? 'Empfohlen' : 'Recommended'}</SelectItem>
          <SelectItem value="distance">{language === 'de' ? 'Entfernung' : 'Distance'}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
