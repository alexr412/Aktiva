'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FeedSortMode } from '@/lib/feed-sort';
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
        <SelectTrigger aria-labelledby="feed-sort-label" className={cn('h-11 text-xs', compact ? 'w-auto gap-1.5 rounded-lg border-0 bg-transparent px-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground' : 'w-[160px] rounded-2xl border-border bg-card font-bold dark:border-neutral-800 dark:bg-neutral-900')}>
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
