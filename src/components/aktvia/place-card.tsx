'use client';

import { Card } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import {
  UtensilsCrossed,
  Coffee,
  TreePine,
  ShoppingBag,
  Bed,
  Landmark,
  Film,
  Building,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';


const categoryIconMap: { [key: string]: LucideIcon } = {
  'catering.restaurant': UtensilsCrossed,
  'catering.cafe': Coffee,
  'leisure.park': TreePine,
  'tourism.attraction': Landmark,
  'commercial': ShoppingBag,
  'entertainment.cinema': Film,
  'accommodation.hotel': Bed,
};

const getCategoryIcon = (categories: string[]): LucideIcon => {
  for (const category of categories) {
    if (categoryIconMap[category]) {
      return categoryIconMap[category];
    }
    const parentCategory = category.split('.')[0];
    if (categoryIconMap[parentCategory]) {
      return categoryIconMap[parentCategory];
    }
  }
  return Building; // Default icon
};


type PlaceCardProps = {
  place: Place;
  onClick: () => void;
  onAddActivity: (place: Place) => void;
};

export function PlaceCard({ place, onClick, onAddActivity }: PlaceCardProps) {
    const Icon = getCategoryIcon(place.categories);
    const mainCategory = place.categories[0]?.split('.')[0].replace(/_/g, ' ') || 'Place';

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer group overflow-hidden rounded-2xl bg-card shadow-md hover:shadow-lg transition-all duration-300 border-none"
    >
      {/* --- Unified Mobile-First Layout --- */}
      <div className="flex items-stretch">
        <div className="relative flex flex-shrink-0 items-center justify-center w-28 bg-muted/30">
            <Icon className="h-10 w-10 text-muted-foreground/70" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center p-3">
            <h3 className="text-base font-semibold truncate w-full">{place.name}</h3>
            <p className="text-sm text-muted-foreground truncate w-full mt-1">{place.address}</p>
            
            <div className="flex items-center justify-between w-full mt-3">
                <Badge className="capitalize text-xs font-semibold bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">{mainCategory}</Badge>
                <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full h-8 w-8 bg-background"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddActivity(place);
                    }}
                >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">Create activity</span>
                </Button>
            </div>
        </div>
      </div>
    </Card>
  );
}
