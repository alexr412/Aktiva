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

    const formatTag = (tag: string) => {
      const parts = tag.split('.');
      const semanticPart = parts[parts.length - 1];
      return semanticPart.charAt(0).toUpperCase() + semanticPart.slice(1).replace(/_/g, ' ');
    };
    
    const cleanTags = place.categories
      ? place.categories
          .map(formatTag)
          .filter((value, index, self) => self.indexOf(value) === index)
      : [];

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer group overflow-hidden rounded-2xl bg-card shadow-md hover:shadow-lg transition-all duration-300 border-none flex flex-col"
    >
      <div className="flex items-stretch">
        <div className="relative flex flex-shrink-0 items-center justify-center w-28 bg-muted/30">
            <Icon className="h-10 w-10 text-muted-foreground/70" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center p-3">
            <h3 className="text-base font-semibold truncate w-full">{place.name}</h3>
            <p className="text-sm text-muted-foreground truncate w-full mt-1">{place.address}</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end p-3 pt-0">
        <div className="flex items-end justify-between gap-2">
            <div className="flex flex-wrap gap-2 mt-2 w-full overflow-hidden">
              {cleanTags.map((tag, index) => (
                <span 
                  key={index} 
                  className="inline-flex items-center px-2 py-1 text-[10px] font-medium bg-secondary text-secondary-foreground rounded-md whitespace-nowrap"
                >
                  {tag}
                </span>
              ))}
            </div>
            <Button
                size="icon"
                variant="outline"
                className="rounded-full h-8 w-8 bg-background flex-shrink-0"
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
    </Card>
  );
}
