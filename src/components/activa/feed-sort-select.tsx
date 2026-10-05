'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FeedSortMode } from '@/lib/feed-sort';

export function FeedSortSelect({ value, onChange, language }: {
  value: FeedSortMode;
  onChange: (value: FeedSortMode) => void;
  language: string;
}) {
  const label = language === 'de' ? 'Sortieren' : 'Sort';
  return (
    <div className="flex items-center justify-end gap-2">
      <span id="feed-sort-label" className="text-xs font-semibold text-slate-500 dark:text-neutral-400">
        {label}
      </span>
      <Select value={value} onValueChange={next => {
        if (next === 'recommended' || next === 'distance') onChange(next);
      }}>
        <SelectTrigger aria-labelledby="feed-sort-label" className="h-11 w-[160px] rounded-2xl border-slate-200/50 bg-white text-xs font-bold shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
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
