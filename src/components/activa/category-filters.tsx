'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  UtensilsCrossed,
  Sparkles,
  Users,
  Layers,
  Bookmark,
  Plus,
  Check,
  Loader2,
  MessageSquare,
  Compass,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { availableTabs } from './category-filters-data';
import { cn, formatLabel } from '@/lib/utils';
import { useLanguage } from '@/hooks/use-language';
import { translateAppString } from '@/lib/tag-config';

// Re-export für Onboarding und andere Konsumenten
export { availableTabs };

export type CategoryTab = {
  id: string;
  label: string;
  labelEn?: string;
  query: string[];
  icon: LucideIcon;
  color: string;
  isSystem?: boolean;
};
export const coreTabs: CategoryTab[] = [
    { id: "Active", label: "AKTIV", labelEn: "ACTIVE", query: ["has_activities"], icon: MessageSquare, isSystem: true, color: "#22c55e" },
    { id: "Highlights", label: "Highlights", labelEn: "Highlights", query: ["tourism.attraction"], icon: Sparkles, isSystem: true, color: "#f59e0b" },
    { id: "Favorites", label: "Favoriten", labelEn: "Favorites", query: ["favorites"], icon: Bookmark, isSystem: true, color: "#f43f5e" },
    { id: "Community", label: "Community", labelEn: "Community", query: ["community"], icon: Users, isSystem: true, color: "#8b5cf6" },
];

type CategoryFiltersProps = {
  activeCategory: string[];
  activeTabId: string;
  onCategoryChange: (categoryId: string[], tabId: string) => void;
  vertical?: boolean;
  isOpenRoomsMode?: boolean;
  onOpenRoomsChange?: (enabled: boolean) => void;
};

export function CategoryFilters({ 
  activeCategory, 
  activeTabId, 
  onCategoryChange, 
  vertical = false,
  isOpenRoomsMode = false,
  onOpenRoomsChange
}: CategoryFiltersProps) {
  const { user, userProfile } = useAuth();
  const language = useLanguage();
  const { toast } = useToast();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  const [localActiveTabs, setLocalActiveTabs] = useState<string[]>([]);
  const [draftTabs, setDraftTabs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userProfile?.activeTabs) {
      setLocalActiveTabs(userProfile.activeTabs);
    } else {
      setLocalActiveTabs(['Sights', 'Nature', 'Restaurants']);
    }
  }, [userProfile]);

  useEffect(() => {
    if (isConfigOpen) {
      setDraftTabs(localActiveTabs);
    }
  }, [isConfigOpen, localActiveTabs]);

  // Center horizontally selected tab chip dynamically relative to the container scroll offset
  useEffect(() => {
    if (!activeTabId && !isOpenRoomsMode) return;
    if (!containerRef.current || vertical) return;
    
    // Defer measuring slightly to allow DOM/styles layout to resolve
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const activeBtn = container.querySelector('[aria-pressed="true"]') as HTMLElement;
      if (activeBtn) {
        const containerWidth = container.clientWidth;
        const buttonWidth = activeBtn.clientWidth;
        const buttonLeft = activeBtn.offsetLeft;
        const targetScrollLeft = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
        container.scrollTo({
          left: targetScrollLeft,
          behavior
        });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [activeTabId, isOpenRoomsMode, vertical]);

  const displayedTabs = [
    ...coreTabs,
    ...availableTabs.filter(tab => localActiveTabs.includes(tab.id))
  ];

  const toggleDraftTab = (tabId: string) => {
    setDraftTabs(prev => 
      prev.includes(tabId) 
        ? prev.filter(id => id !== tabId) 
        : [...prev, tabId]
    );
  };

  const saveConfiguration = async () => {
    if (!user || !db) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { activeTabs: draftTabs });
      setLocalActiveTabs(draftTabs);
      setIsConfigOpen(false);
      toast({ title: language === 'de' ? 'Gespeichert' : 'Saved', description: language === 'de' ? 'Deine Kategorien wurden aktualisiert.' : 'Your categories have been updated.' });
    } catch (error) {
      toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: language === 'de' ? 'Änderungen konnten nicht gespeichert werden.' : 'Changes could not be saved.' });
    } finally { setIsSaving(false); }
  };

  return (
    <>
      <div 
        ref={containerRef}
        className={cn(
        vertical 
          ? "flex flex-col gap-2 w-full items-stretch"
          : "flex flex-nowrap overflow-x-auto md:flex-wrap md:overflow-x-visible gap-2 pb-3 md:pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar sm:pb-4 items-center w-full min-w-0"
      )}>
        {isOpenRoomsMode && (
          <Button
            onClick={() => onOpenRoomsChange?.(false)}
            aria-pressed={true}
            aria-label={language === 'de' ? 'Offene Räume verlassen' : 'Exit open rooms'}
            className={cn(
              vertical
                ? "w-full flex items-center justify-start rounded-xl h-12 font-black border transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 px-4 text-[11px] uppercase tracking-wider active:scale-[0.985] gap-1.5 shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500"
                : "flex-shrink-0 flex items-center justify-center rounded-full h-11 font-black border transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 px-5 text-[11px] uppercase tracking-wider active:scale-[0.985] gap-1.5 shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-500"
            )}
            style={{ 
                backgroundColor: `#10b9811c`,
                borderColor: '#10b981',
                color: '#10b981'
            }}
          >
            <Compass className="h-3.5 w-3.5 mr-2 shrink-0 animate-pulse" style={{ color: '#10b981' }} />
            <span className="whitespace-nowrap truncate">
              {translateAppString('pulse.feed_mode.open_rooms', language)}
            </span>
            <span className="ml-1.5 text-[10px] opacity-60 pointer-events-none" aria-hidden="true">✕</span>
          </Button>
        )}

        {displayedTabs.map((tab) => {
          const isActive = activeTabId === tab.id && !isOpenRoomsMode;
          return (
            <Button
              key={tab.id}
              onClick={() => {
                if (isOpenRoomsMode) {
                  onOpenRoomsChange?.(false);
                }
                if (isActive) {
                  onCategoryChange([], "");
                } else {
                  onCategoryChange(tab.query, tab.id);
                }
              }}
              aria-pressed={isActive}
              className={cn(
                vertical
                  ? "w-full flex items-center justify-start rounded-xl h-12 font-black border transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 px-4 text-[11px] uppercase tracking-wider active:scale-[0.985]"
                  : "flex-shrink-0 flex items-center justify-center rounded-full h-11 font-black border transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 px-5 text-[11px] uppercase tracking-wider active:scale-[0.985]",
                isActive 
                    ? "shadow-sm" 
                    : "bg-slate-100/40 border-slate-200/40 text-slate-600 dark:bg-neutral-800/40 dark:border-neutral-800/60 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-700"
              )}
              style={isActive ? { 
                  backgroundColor: `${tab.color}1c`,
                  borderColor: tab.color,
                  color: tab.color
              } : {}}
            >
              <tab.icon className="h-3.5 w-3.5 mr-2 shrink-0" style={{ color: tab.color }} />
              <span className="whitespace-nowrap truncate">{formatLabel(language === 'de' ? tab.label : (tab.labelEn || tab.label))}</span>
            </Button>
          );
        })}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsConfigOpen(true)}
          className={cn(
            vertical
              ? "w-full flex items-center justify-center rounded-xl h-12 border border-dashed border-slate-200 dark:border-neutral-800 shadow-none hover:bg-slate-50 mt-1 bg-transparent active:scale-[0.985] transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200"
              : "flex-shrink-0 rounded-full h-11 w-11 bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 text-slate-500 dark:text-neutral-400 flex items-center justify-center active:scale-[0.985] hover:border-slate-300 dark:hover:border-neutral-700 transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-200 shadow-premium"
          )}
        >
          <Plus className={cn("h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400 shrink-0", vertical && "mr-2")} />
          {vertical && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'de' ? 'Kategorien anpassen' : 'Customize categories'}</span>}
        </Button>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-md dark:bg-neutral-900">
          <DialogHeader>
            <DialogTitle className="font-black text-xl dark:text-neutral-200">{language === 'de' ? 'Kategorien anpassen' : 'Customize categories'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {availableTabs.map((tab) => {
              const isActive = draftTabs.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => toggleDraftTab(tab.id)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left w-full",
                    isActive 
                      ? 'border-primary bg-primary/5 dark:bg-primary/20' 
                      : 'bg-white border-neutral-50 dark:bg-neutral-800 dark:border-neutral-700'
                  )}
                  style={{ 
                      borderColor: isActive ? tab.color : undefined,
                      backgroundColor: isActive ? `${tab.color}10` : undefined
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                         style={{ backgroundColor: `${tab.color}15` }}>
                        <tab.icon className="h-5 w-5" style={{ color: tab.color }} />
                    </div>
                    <span className={cn(
                        "font-black text-sm uppercase tracking-tight",
                        isActive ? "text-neutral-900 dark:text-white" : "text-neutral-500 dark:text-neutral-400"
                    )}>{formatLabel(language === 'de' ? tab.label : (tab.labelEn || tab.label))}</span>
                  </div>
                  {isActive && <Check className="h-5 w-5" style={{ color: tab.color }} />}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={saveConfiguration} disabled={isSaving} className="w-full h-14 font-black uppercase tracking-widest text-[11px] rounded-full transition-all active:scale-[0.98]">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (language === 'de' ? 'Konfiguration übernehmen' : 'Apply configuration')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
