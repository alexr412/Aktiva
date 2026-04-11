'use client';

import { useState, useEffect } from 'react';
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
import { cn } from '@/lib/utils';

// Re-export für Onboarding und andere Konsumenten
export { availableTabs };

export type CategoryTab = {
  id: string;
  label: string;
  query: string[];
  icon: LucideIcon;
  color: string;
  isSystem?: boolean;
};

export const coreTabs: CategoryTab[] = [
    { id: "Aktiv", label: "AKTIV", query: ["has_activities"], icon: MessageSquare, isSystem: true, color: "#22c55e" },
    { id: "Highlights", label: "Highlights", query: ["tourism.attraction"], icon: Sparkles, isSystem: true, color: "#f59e0b" },
    { id: "Favorites", label: "Favoriten", query: ["favorites"], icon: Bookmark, isSystem: true, color: "#f43f5e" },
    { id: "Community", label: "Community", query: ["user_event"], icon: Users, isSystem: true, color: "#8b5cf6" },
];

type CategoryFiltersProps = {
  activeCategory: string[];
  onCategoryChange: (categoryId: string[], tabId: string) => void;
};

export function CategoryFilters({ activeCategory, onCategoryChange }: CategoryFiltersProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  const [localActiveTabs, setLocalActiveTabs] = useState<string[]>([]);
  const [draftTabs, setDraftTabs] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Finde den aktuell aktiven Tab-ID basierend auf dem query-State
  // Wir nutzen dafür ein useEffect oder leiten es direkt ab
  const activeTabId = coreTabs.find(t => JSON.stringify(t.query) === JSON.stringify(activeCategory))?.id || 
                    availableTabs.find(t => JSON.stringify(t.query) === JSON.stringify(activeCategory))?.id || "";

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
      toast({ title: 'Gespeichert', description: 'Deine Kategorien wurden aktualisiert.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Fehler', description: 'Änderungen konnten nicht gespeichert werden.' });
    } finally { setIsSaving(false); }
  };

  return (
    <>
      <div className="flex overflow-x-auto gap-2 pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:scrollbar-thin sm:scrollbar-thumb-neutral-300 dark:sm:scrollbar-thumb-neutral-700 sm:scrollbar-track-transparent max-sm:hide-scrollbar sm:pb-4 items-center w-full">
        {displayedTabs.map((tab) => {
          const isActive = activeTabId === tab.id;
          return (
            <Button
              key={tab.id}
              onClick={() => {
                if (isActive) {
                  onCategoryChange([], "");
                } else {
                  onCategoryChange(tab.query, tab.id);
                }
              }}
              className={cn(
                "flex-shrink-0 flex items-center justify-center rounded-full h-11 font-black border-none transition-all px-6 text-[11px] uppercase tracking-wider",
                isActive 
                    ? "text-white shadow-xl shadow-primary/20" 
                    : "shadow-md shadow-slate-200/50"
              )}
              style={{ 
                  backgroundColor: isActive ? tab.color : `${tab.color}15`,
                  color: isActive ? '#fff' : tab.color
              }}
            >
              <tab.icon className="h-4 w-4 mr-2 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </Button>
          );
        })}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsConfigOpen(true)}
          className="flex-shrink-0 rounded-full h-9 w-9 bg-white dark:bg-neutral-800 dark:border dark:border-neutral-700 shadow-sm"
        >
          <Plus className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        </Button>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-md dark:bg-neutral-900">
          <DialogHeader>
            <DialogTitle className="font-black text-xl dark:text-neutral-200">Kategorien anpassen</DialogTitle>
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
                    )}>{tab.label}</span>
                  </div>
                  {isActive && <Check className="h-5 w-5" style={{ color: tab.color }} />}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={saveConfiguration} disabled={isSaving} className="w-full h-12 font-black rounded-xl">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Konfiguration übernehmen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
