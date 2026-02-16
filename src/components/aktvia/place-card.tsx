'use client';

import { Card } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import {
  Star,
  UtensilsCrossed,
  Coffee,
  TreePine,
  ShoppingBag,
  Bed,
  Landmark,
  Film,
  Building,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
};

export function PlaceCard({ place, onClick }: PlaceCardProps) {
    const mainCategory = place.categories[0]?.split('.')[0].replace(/_/g, ' ') || 'Place';
    const Icon = getCategoryIcon(place.categories);

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer group overflow-hidden rounded-2xl bg-card shadow-md hover:shadow-lg transition-shadow border-none"
    >
      <div className="relative flex items-center justify-center w-full aspect-[16/9] bg-muted/30 overflow-hidden rounded-t-2xl">
          <Icon className="h-12 w-12 text-muted-foreground/80 transition-colors group-hover:text-primary" />
      </div>

      <div className="p-3 space-y-1.5">
          <h3 className="text-lg font-bold leading-tight truncate">{place.name}</h3>
          <p className="text-sm text-foreground/80 truncate">{place.address}</p>
          <div className="flex justify-between items-center pt-1">
            <Badge className="capitalize text-xs font-semibold bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">{mainCategory}</Badge>
             {place.rating && (
                <div className="flex items-center gap-1 text-xs font-bold text-foreground/80 shrink-0">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{place.rating.toFixed(1)}</span>
                </div>
            )}
          </div>
      </div>

    </Card>
  );
}
