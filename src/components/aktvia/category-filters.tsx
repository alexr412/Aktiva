'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  UtensilsCrossed,
  Coffee,
  TreePine,
  ShoppingBag,
  Film,
  Sparkles,
  Dumbbell,
  Users,
  Layers,
  Bookmark,
  Plus,
  Check,
  Utensils,
  Waves,
  Beer,
  Ticket,
  ShoppingCart,
  Bird,
  Library,
  Music,
  Loader2,
  Building,
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
  { id: "Highlights", label: "Highlights", query: ["tourism.attraction"], icon: Sparkles, isSystem: true },
  { id: "Community", label: "Community", query: ["user_event"], icon: Users, isSystem: true },
];

export const availableTabs: CategoryTab[] = [
  { id: "Gastronomy", label: "Gastro", query: ["catering.restaurant", "catering.cafe"], icon: UtensilsCrossed },
  { id: "FastFood", label: "Fast Food", query: ["catering.fast_food"], icon: Utensils },
  { id: "Nightlife", label: "Bars & Pubs", query: ["catering.bar", "catering.pub"], icon: Beer },
  { id: "Clubs", label: "Clubs & Discos", query: ["adult.nightclub"], icon: Music },
  { id: "Nature", label: "Natur & Parks", query: ["leisure.park", "natural.forest"], icon: TreePine },
  { id: "Water", label: "Wasser & Strand", query: ["natural.water", "natural.beach"], icon: Waves },
  { id: "Sport", label: "Sportanlagen", query: ["sport"], icon: Dumbbell },
  { id: "Museums", label: "Museen", query: ["entertainment.museum"], icon: Library },
  { id: "Zoos", label: "Zoos & Aquarien", query: ["entertainment.zoo", "entertainment.aquarium"], icon: Bird },
  { id: "Cinemas", label: "Kinos", query: ["entertainment.cinema"], icon: Film },
  { id: "Shopping", label: "Shopping", query: ["commercial.shopping_mall", "commercial.clothing"], icon: ShoppingBag },
  { id: "Supermarkets", label: "Supermärkte", query: ["commercial.supermarket"], icon: ShoppingCart },
  { id: "Attractions", label: "Attraktionen", query: ["tourism.attraction", "tourism.sights"], icon: Ticket },
  { id: "Coworking", label: "Coworking", query: ["office.coworking"], icon: Building },
  { id: "Rental", label: "Verleih", query: ["rental.bicycle", "rental.boat", "rental.ski"], icon: ShoppingBag }
];

type CategoryFiltersProps = {
  activeCategory: string[];
  onCategoryChange: (categoryId: string[]) => void;
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
      setLocalActiveTabs(['Gastronomy', 'Nature']);
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
      
      toast({
        title: 'Gespeichert',
        description: 'Deine Kategorien wurden aktualisiert.',
      });
    } catch (error) {
      console.error("Tab configuration save failed:", error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Änderungen konnten nicht gespeichert werden.',
      });
    } finally {
      setIsSaving(false);
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
          
          <div className="grid grid-cols-1 gap-2 py-4 max-h-[60vh] overflow-y-auto pr-2">
            {availableTabs.map((tab) => {
              const isActive = draftTabs.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => toggleDraftTab(tab.id)}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left w-full ${
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
            <Button 
              type="button" 
              onClick={saveConfiguration} 
              disabled={isSaving}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Speichere...
                </>
              ) : (
                'Fertig'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
