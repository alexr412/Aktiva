'use client';
import { X, Sparkles } from 'lucide-react';
import { parseLocalSearchIntent, searchCategoryLabel, type SearchIntent } from '@/lib/search-intent';

interface Props {
  draft: string; submitted: boolean; intent: SearchIntent | null; language: string;
  onRemoveCategory: (tag: string) => void; onRemoveRadius: () => void; onClear: () => void;
}
export function SearchIntentFilters({ draft, submitted, intent, language, onRemoveCategory, onRemoveRadius, onClear }: Props) {
  const de = language === 'de';
  if (!draft.trim() && !submitted) return null;
  const preview = parseLocalSearchIntent(draft);
  if (!submitted) return <p className="text-xs text-neutral-500 dark:text-neutral-400" aria-live="polite">
    {preview?.categories.length ? preview.categories.map(tag => searchCategoryLabel(tag, language)).join(' · ') + (preview.radiusKm ? ` · ${preview.radiusKm} km` : '') + ' — ' : ''}
    {de ? 'Mit Enter oder der Lupe suchen' : 'Press Enter or tap search'}
  </p>;
  if (!intent) return null;
  return <div className="flex flex-wrap items-center gap-2 text-xs" aria-label={de ? 'Suchfilter' : 'Search filters'}>
    {intent.categories.map(tag => <button key={tag} type="button" onClick={() => onRemoveCategory(tag)}
      aria-label={`${searchCategoryLabel(tag, language)} ${de ? 'aus Suchfiltern entfernen' : 'remove from search filters'}`}
      className="min-h-11 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 text-emerald-700 dark:text-emerald-300">
      {searchCategoryLabel(tag, language)} <X className="h-3.5 w-3.5" />
    </button>)}
    {intent.radiusKm != null && <button type="button" onClick={onRemoveRadius}
      aria-label={de ? 'Suchradius entfernen' : 'Remove search radius'}
      className="min-h-11 inline-flex items-center gap-2 rounded-xl bg-sky-500/10 px-3 text-sky-700 dark:text-sky-300">
      {intent.radiusKm} km <X className="h-3.5 w-3.5" />
    </button>}
    {intent.source === 'ai' || intent.source === 'cache' ? <span className="inline-flex items-center gap-1 text-neutral-500"><Sparkles className="h-3.5 w-3.5" />{de ? 'Suchwunsch erkannt' : 'Search understood'}</span> : null}
    {intent.source === 'fallback' && <span role="status" className="text-neutral-500">{de ? 'Namenssuche · KI gerade nicht verfügbar oder Anfrage nicht unterstützt' : 'Name search · AI unavailable or request unsupported'}</span>}
    <button type="button" onClick={onClear} className="min-h-11 px-2 text-neutral-500 underline underline-offset-4">{de ? 'Suche zurücksetzen' : 'Reset search'}</button>
  </div>;
}
