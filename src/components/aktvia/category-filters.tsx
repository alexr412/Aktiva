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

export type CategoryTab = {
  id: string;
  label: string;
  query: string[];
  icon: LucideIcon;
  isSystem?: boolean;
};

export const coreTabs: CategoryTab[] = [
  { id: "All", label: "Alle", query: ["tourism", "entertainment", "heritage"], icon: Layers, isSystem: true },
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

  useEffect(() => {
    if (userProfile?.activeTabs) {
      setLocalActiveTabs(userProfile.activeTabs);
    } else {
      setLocalActiveTabs(['Gastronomy', 'Nature', 'Sights']);
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
      <div className="flex md:flex-wrap overflow-x-auto md:overflow-visible gap-2 pb-2 -mx-4 px-4 md:px-0 md:mx-0 hide-scrollbar items-center w-full">
        {displayedTabs.map((tab) => {
          const isActive = JSON.stringify(activeCategory) === JSON.stringify(tab.query);
          return (
            <Button
              key={tab.id}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange(tab.query, tab.id)}
              className={cn(
                "flex-shrink-0 flex items-center gap-2 rounded-full h-9 transition-all active:scale-95 shadow-sm border-none bg-[#ffffff] dark:bg-slate-800 dark:border-slate-700 font-bold",
                isActive ? "bg-primary text-white" : "text-[#64748b] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-[#0f172a] dark:hover:text-slate-100"
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
          className="flex-shrink-0 rounded-full h-9 w-9 bg-white dark:bg-slate-800 dark:border dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          <Plus className="h-4 w-4 text-[#64748b] dark:text-slate-400" />
          <span className="sr-only">Kategorien verwalten</span>
        </Button>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-md dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="font-black text-xl text-[#0f172a] dark:text-slate-100">Kategorien anpassen</DialogTitle>
            <DialogDescription className="font-medium text-[#64748b] dark:text-slate-400">
              Wähle aus, welche Kategorien in deiner Schnellwahl angezeigt werden sollen.
            </DialogDescription>
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
                      ? 'bg-primary/10 border-primary text-primary shadow-sm dark:bg-primary/20' 
                      : 'bg-white border-slate-100 text-[#64748b] hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
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
            <Button onClick={saveConfiguration} disabled={isSaving} className="w-full h-12 text-base font-black rounded-xl shadow-lg">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Konfiguration übernehmen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
