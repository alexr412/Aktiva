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
  X,
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
        <DialogContent 
          overlayClassName="bg-black/50 backdrop-blur-xs"
          hideCloseButton
          className="fixed inset-x-0 bottom-0 top-auto left-0 right-0 translate-x-0 translate-y-0 lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:bottom-auto w-full max-w-full lg:w-[min(600px,calc(100vw-48px))] lg:max-w-[600px] max-h-[min(88dvh,680px)] lg:max-h-[min(760px,calc(100dvh-80px))] rounded-t-[28px] rounded-b-none lg:rounded-[28px] border-t border-slate-200/80 dark:border-neutral-800 lg:border bg-white dark:bg-neutral-900 p-0 gap-0 shadow-2xl overflow-hidden flex flex-col min-h-0 focus:outline-none"
        >
          {/* Mobile Visual Drag Handle */}
          <div className="w-12 h-1 bg-slate-200 dark:bg-neutral-700 rounded-full mx-auto mt-2.5 mb-0.5 lg:hidden shrink-0" />

          {/* Sticky / Fixed Header */}
          <div className="flex items-center justify-between px-5 lg:px-7 py-3.5 lg:py-4 border-b border-slate-100 dark:border-neutral-800/80 shrink-0">
            <DialogTitle className="text-lg lg:text-xl font-black text-slate-900 dark:text-neutral-100 tracking-tight truncate pr-4">
              {language === 'de' ? 'Kategorien anpassen' : 'Customize categories'}
            </DialogTitle>
            
            <button
              type="button"
              onClick={() => setIsConfigOpen(false)}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-slate-100/90 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200/90 dark:hover:bg-neutral-700 border border-slate-200/60 dark:border-neutral-700/60 shadow-xs transition-all shrink-0 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer"
              aria-label={language === 'de' ? 'Schließen' : 'Close'}
            >
              <X className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Scrollable Category List */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 lg:px-6 py-3.5 lg:py-4 custom-category-scrollbar hide-scrollbar lg:[scrollbar-width:thin]">
            <div className="flex flex-col gap-2 lg:gap-2.5">
              {availableTabs.map((tab) => {
                const isActive = draftTabs.includes(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => toggleDraftTab(tab.id)}
                    className={cn(
                      "group flex items-center justify-between px-4 lg:px-4.5 min-h-[60px] lg:min-h-[64px] py-2.5 rounded-2xl border transition-all text-left w-full shrink-0 cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                      isActive 
                        ? "shadow-xs" 
                        : "bg-slate-50/70 hover:bg-slate-100/70 border-slate-200/60 dark:bg-neutral-800/40 dark:hover:bg-neutral-800/70 dark:border-neutral-800/70"
                    )}
                    style={{ 
                      borderColor: isActive ? `${tab.color}45` : undefined,
                      backgroundColor: isActive ? `${tab.color}10` : undefined
                    }}
                  >
                    <div className="flex items-center gap-3 lg:gap-3.5 min-w-0 pr-2">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"
                        style={{ backgroundColor: `${tab.color}15` }}
                      >
                        <tab.icon className="h-5 w-5 shrink-0" style={{ color: tab.color }} />
                      </div>
                      <span 
                        className={cn(
                          "font-black text-xs lg:text-[13px] uppercase tracking-wider truncate transition-colors",
                          isActive ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-neutral-300"
                        )}
                      >
                        {formatLabel(language === 'de' ? tab.label : (tab.labelEn || tab.label))}
                      </span>
                    </div>

                    {isActive && (
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{ color: tab.color }}
                      >
                        <Check className="h-4 w-4 stroke-[3]" style={{ color: tab.color }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sticky / Fixed Footer with Safe Area Support */}
          <div className="flex-none p-4 lg:p-5 border-t border-slate-100 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 pb-[max(16px,env(safe-area-inset-bottom))]">
            <Button 
              onClick={saveConfiguration} 
              disabled={isSaving} 
              className="w-full h-12 lg:h-12.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-[11px] lg:text-xs rounded-full transition-all active:scale-[0.985] shadow-md shadow-emerald-600/20 focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                language === 'de' ? 'Konfiguration übernehmen' : 'Apply configuration'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
