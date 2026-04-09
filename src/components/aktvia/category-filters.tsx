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
  isSystem?: boolean;
};

export const coreTabs: CategoryTab[] = [
  { id: "Aktiv", label: "AKTIV", query: ["has_activities"], icon: MessageSquare, isSystem: true },
  { id: "Highlights", label: "Highlights", query: ["tourism.attraction"], icon: Sparkles, isSystem: true },
  { id: "Favorites", label: "Favoriten", query: ["favorites"], icon: Bookmark, isSystem: true },
  { id: "Community", label: "Community", query: ["user_event"], icon: Users, isSystem: true },
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
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (isActive) {
                  // Toggle-Off: Wenn bereits aktiv, Filter entfernen (Alle anzeigen)
                  onCategoryChange([], "");
                } else {
                  onCategoryChange(tab.query, tab.id);
                }
              }}
              className={cn(
                "flex-shrink-0 flex items-center gap-2 rounded-full h-9 font-bold border-none transition-all",
                isActive ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-300 dark:border-neutral-700"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span className="text-[11px] uppercase tracking-wide">{tab.label}</span>
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
                    "flex items-center justify-between p-4 rounded-xl border transition-all text-left w-full",
                    isActive 
                      ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20' 
                      : 'bg-white border-neutral-100 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className="h-5 w-5" />
                    <span className="font-bold text-sm">{tab.label}</span>
                  </div>
                  {isActive && <Check className="h-5 w-5" />}
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
