'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  UtensilsCrossed,
  Coffee,
  TreePine,
  ShoppingBag,
  Landmark,
  Film,
  Sparkles,
  Dumbbell,
  Users,
  Layers,
  Bookmark,
  Plus,
  Check,
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
import { updateUserProfile } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export type CategoryTab = {
  id: string;
  label: string;
  query: string[];
  icon: LucideIcon;
  isSystem?: boolean;
};

export const coreTabs: CategoryTab[] = [
  { id: "Favorites", label: "Favoriten", query: ["favorites"], icon: Bookmark, isSystem: true },
  { id: "All", label: "Alle", query: ["tourism", "entertainment", "heritage"], icon: Layers, isSystem: true },
  { id: "Highlights", label: "Highlights", query: ["tourism.attraction", "entertainment.cinema", "heritage.unesco"], icon: Sparkles, isSystem: true },
  { id: "Community", label: "Community", query: ["user_event"], icon: Users, isSystem: true },
];

export const availableTabs: CategoryTab[] = [
  { id: "Gastronomy", label: "Gastro", query: ["catering.restaurant", "catering.cafe", "catering.bar"], icon: UtensilsCrossed },
  { id: "Nature", label: "Natur & Parks", query: ["leisure.park", "natural.forest", "leisure.garden"], icon: TreePine },
  { id: "Sport", label: "Sport", query: ["sport.sports_centre", "sport.stadium", "sport.swimming_pool"], icon: Dumbbell },
  { id: "Cinemas", label: "Kinos", query: ["entertainment.cinema", "entertainment.culture"], icon: Film },
  { id: "Shopping", label: "Shopping", query: ["commercial.shopping_mall", "commercial.clothing", "commercial.books"], icon: ShoppingBag },
  { id: "Attractions", label: "Attraktionen", query: ["tourism.attraction", "tourism.sights", "heritage"], icon: Landmark },
];

type CategoryFiltersProps = {
  activeCategory: string[];
  onCategoryChange: (categoryId: string[]) => void;
};

export function CategoryFilters({ activeCategory, onCategoryChange }: CategoryFiltersProps) {
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const userActiveTabIds = userProfile?.activeTabs || ['Gastronomy', 'Nature'];
  
  const displayedTabs = [
    ...coreTabs,
    ...availableTabs.filter(tab => userActiveTabIds.includes(tab.id))
  ];

  const handleToggleTab = async (tabId: string) => {
    if (!user) return;
    
    const newActiveTabs = userActiveTabIds.includes(tabId)
      ? userActiveTabIds.filter(id => id !== tabId)
      : [...userActiveTabIds, tabId];

    try {
      await updateUserProfile(user.uid, { activeTabs: newActiveTabs });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Kategorie konnte nicht aktualisiert werden.',
      });
    }
  };

  return (
    <>
      <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 hide-scrollbar items-center">
        {displayedTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={
              JSON.stringify(activeCategory) === JSON.stringify(tab.query) ? 'default' : 'outline'
            }
            size="sm"
            onClick={() => onCategoryChange(tab.query)}
            className="flex-shrink-0 flex items-center gap-2 rounded-full h-9"
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </Button>
        ))}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsConfigOpen(true)}
          className="flex-shrink-0 rounded-full h-9 w-9 bg-muted/50 hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">Kategorien verwalten</span>
        </Button>
      </div>

      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Kategorien anpassen</DialogTitle>
            <DialogDescription>
              Wähle aus, welche Kategorien in deiner Schnellwahl angezeigt werden sollen.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-2 py-4">
            {availableTabs.map((tab) => {
              const isActive = userActiveTabIds.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => handleToggleTab(tab.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isActive 
                      ? 'bg-primary/10 border-primary text-primary' 
                      : 'bg-background border-border text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <tab.icon className="h-5 w-5" />
                    <span className="font-medium text-foreground">{tab.label}</span>
                  </div>
                  {isActive && <Check className="h-5 w-5" />}
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsConfigOpen(false)} className="w-full">
              Fertig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
