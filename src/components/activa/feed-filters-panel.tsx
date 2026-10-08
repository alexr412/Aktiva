'use client';

import type { ReactNode } from 'react';
import { Compass, Eye, EyeOff, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetTrigger, SheetContent, SheetClose, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { useLanguage } from '@/hooks/use-language';
import { cn, formatLabel } from '@/lib/utils';
import { translateAppString } from '@/lib/tag-config';
import { availableTabs } from './category-filters-data';
import type { CategoryTab } from './category-filters';

export type FeedFiltersToolbar = { title?: string; actions?: ReactNode };

type FeedFiltersPanelProps = {
  systemTabs: CategoryTab[];
  activeCategory: string[];
  activeTabId: string;
  onCategoryChange: (query: string[], tabId: string) => void;
  isOpenRoomsMode: boolean;
  onOpenRoomsChange?: (enabled: boolean) => void;
  hiddenCategoryIds: readonly string[];
  onToggleCategoryVisibility?: (tabId: string) => void;
  onShowAllCategories?: () => void;
  visibilityReady: boolean;
  toolbar?: FeedFiltersToolbar;
};

export function FeedFiltersPanel({
  systemTabs, activeCategory, activeTabId, onCategoryChange, isOpenRoomsMode,
  onOpenRoomsChange, hiddenCategoryIds, onToggleCategoryVisibility,
  onShowAllCategories, visibilityReady, toolbar,
}: FeedFiltersPanelProps) {
  const language = useLanguage();
  const de = language === 'de';
  const labelFor = (tab: CategoryTab) => de ? tab.label : (tab.labelEn || tab.label);
  const allSpotsLabel = de ? 'Alle Spots' : 'All spots';
  const isSelected = (tab: CategoryTab) => !isOpenRoomsMode && (
    activeTabId === tab.id || (tab.id === 'GenderOnly' && ['WomenOnly', 'MenOnly'].includes(activeTabId))
  );
  const selectedTab = [...systemTabs, ...availableTabs].find(isSelected);
  const summary = isOpenRoomsMode
    ? translateAppString('pulse.feed_mode.open_rooms', language)
    : selectedTab ? labelFor(selectedTab) : activeCategory.length ? (de ? 'Suchergebnisse' : 'Search results') : allSpotsLabel;
  const hiddenCount = hiddenCategoryIds.length;
  const select = (tab?: CategoryTab) => {
    onOpenRoomsChange?.(false);
    if (!tab || isSelected(tab)) onCategoryChange([], '');
    else onCategoryChange(tab.query, tab.id);
  };

  return (
    <Sheet>
      <div data-tutorial-id="feed-filters" className={cn('flex min-w-0 gap-3', toolbar ? 'flex-wrap items-center justify-between' : 'items-center pb-3 sm:pb-4')}>
        {toolbar && <div className="min-w-0 w-full sm:w-auto sm:flex-1" aria-live="polite" aria-atomic="true">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">{toolbar.title || summary}</h2>
          {(toolbar.title || hiddenCount > 0) && <p className="mt-0.5 text-xs text-muted-foreground dark:text-slate-400">
            {toolbar.title && (summary === allSpotsLabel ? (de ? 'Alle Spots in deiner Nähe' : 'All spots near you') : summary)}
            {toolbar.title && hiddenCount > 0 && ' · '}
            {hiddenCount > 0 && `${hiddenCount} ${de ? (hiddenCount === 1 ? 'Kategorie ausgeblendet' : 'Kategorien ausgeblendet') : (hiddenCount === 1 ? 'category hidden' : 'categories hidden')}`}
          </p>}
        </div>}
        <div className={toolbar ? 'flex w-full sm:w-auto shrink-0 flex-wrap items-center justify-between gap-2' : 'contents'}>
          <SheetTrigger asChild>
            <Button variant="outline" className={cn('h-11 shrink-0 gap-2', toolbar ? 'rounded-xl border-border bg-card px-3 font-semibold dark:border-neutral-800 dark:bg-neutral-900' : 'rounded-full px-4 font-bold', toolbar && (hiddenCount > 0 || !!activeCategory.length || isOpenRoomsMode) && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300')}>
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {de ? 'Filter' : 'Filters'}
              {hiddenCount > 0 && <span className="rounded-full bg-emerald-500/15 px-1.5 text-xs text-emerald-700 dark:text-emerald-300">{hiddenCount}</span>}
            </Button>
          </SheetTrigger>
          {toolbar?.actions}
        </div>
        {!toolbar && <div className="min-w-0 text-sm" aria-live="polite" aria-atomic="true">
          <p className="truncate font-semibold" title={summary}>{summary}</p>
          {hiddenCount > 0 && <p className="truncate text-xs text-muted-foreground">{hiddenCount} {de ? 'ausgeblendet' : 'hidden'}</p>}
        </div>}
      </div>
      <SheetContent side="left" hideCloseButton className="flex h-[100dvh] w-[calc(100%-20px)] max-w-[420px] flex-col gap-0 overflow-hidden rounded-r-3xl p-0 sm:max-w-[420px] motion-reduce:animate-none motion-reduce:transition-none">
        <div className="shrink-0 border-b px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-xl font-black">{de ? 'Dein Feed' : 'Your feed'}</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label={de ? 'Filter schließen' : 'Close filters'}>
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="mt-1 text-xs leading-relaxed">
            {de ? 'Wähle eine Ansicht. Mit dem Auge blendest du Kategorien im Feed ein oder aus.' : 'Choose a view. Use the eye to show or hide categories in your feed.'}
          </SheetDescription>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 py-5">
          <section aria-labelledby="feed-filter-views">
            <h2 id="feed-filter-views" className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{de ? 'Ansicht' : 'View'}</h2>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" aria-pressed={!activeCategory.length && !isOpenRoomsMode} onClick={() => select()} className={cn('col-span-2 h-12 justify-start gap-2 rounded-xl', !activeCategory.length && !isOpenRoomsMode && 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>
                <Compass className="h-4 w-4 shrink-0" aria-hidden="true" />{allSpotsLabel}
              </Button>
              {systemTabs.map(tab => (
                <Button key={tab.id} variant="outline" data-category-select data-tutorial-id={tab.id === 'Active' ? 'feed-tab-active' : tab.id === 'Community' ? 'feed-tab-community' : tab.id === 'Favorites' ? 'feed-tab-favorites' : undefined} aria-pressed={isSelected(tab)} onClick={() => select(tab)} className="h-12 min-w-0 justify-start gap-2 rounded-xl px-3 text-xs" style={isSelected(tab) ? { borderColor: tab.color, backgroundColor: `${tab.color}1c` } : undefined}>
                  <tab.icon className="h-4 w-4 shrink-0" style={{ color: tab.color }} aria-hidden="true" />
                  <span className="truncate">{labelFor(tab)}</span>
                </Button>
              ))}
            </div>
          </section>
          <section aria-labelledby="feed-filter-categories">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 px-1">
              <h2 id="feed-filter-categories" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{de ? 'Kategorien im Feed' : 'Feed categories'}</h2>
              {hiddenCount > 0 && onShowAllCategories && <Button variant="ghost" disabled={!visibilityReady} onClick={onShowAllCategories} className="h-11 px-2 text-xs text-emerald-700 dark:text-emerald-300">{de ? 'Alle einblenden' : 'Show all'}</Button>}
            </div>
            <div className="space-y-2">
              {availableTabs.map(tab => {
                const hidden = hiddenCategoryIds.includes(tab.id);
                const label = labelFor(tab);
                const visibilityLabel = de ? `${label} im Feed ${hidden ? 'einblenden' : 'ausblenden'}` : `${hidden ? 'Show' : 'Hide'} ${label} in feed`;
                return (
                  <div key={tab.id} className="flex min-w-0 items-stretch overflow-hidden rounded-xl border" style={isSelected(tab) ? { borderColor: tab.color, backgroundColor: `${tab.color}1c` } : undefined}>
                    <Button variant="ghost" data-category-select aria-pressed={isSelected(tab)} onClick={() => select(tab)} className={cn('h-auto min-h-14 min-w-0 flex-1 justify-start gap-3 rounded-none px-3 py-2 text-left', hidden && 'opacity-50')}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${tab.color}15` }}><tab.icon className="h-4 w-4" style={{ color: tab.color }} aria-hidden="true" /></span>
                      <span className="whitespace-normal text-xs font-bold leading-relaxed">{formatLabel(label)}</span>
                    </Button>
                    {onToggleCategoryVisibility && <Button variant="ghost" disabled={!visibilityReady} aria-label={visibilityLabel} title={visibilityLabel} aria-pressed={!hidden} onClick={() => onToggleCategoryVisibility(tab.id)} className={cn('h-auto min-h-14 w-12 shrink-0 rounded-none border-l text-muted-foreground', hidden && 'text-emerald-700 dark:text-emerald-300')}>
                      {hidden ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </Button>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <div className="shrink-0 border-t px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <SheetClose asChild><Button className="h-12 w-full rounded-full bg-emerald-600 font-bold text-white hover:bg-emerald-500">{de ? 'Ergebnisse anzeigen' : 'Show results'}</Button></SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
