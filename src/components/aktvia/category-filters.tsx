'use client';

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
  type LucideIcon,
} from 'lucide-react';

/**
 * Kalibrierte Filter-Matrix für Geoapify POIs.
 * Nutzt Precision Whitelisting zur Vermeidung von Infrastruktur-Rauschen.
 */
export const categories: { name: string; id: string[]; icon: LucideIcon }[] = [
  { name: 'Favorites', id: ['favorites'], icon: Bookmark },
  { name: 'All', id: ['tourism', 'entertainment', 'heritage'], icon: Layers },
  { 
    name: 'Highlights', 
    id: ['tourism.attraction', 'entertainment.cinema', 'heritage.unesco'], 
    icon: Sparkles 
  },
  { name: 'Community', id: ['user_event'], icon: Users },
  { 
    name: 'Attractions', 
    id: ['tourism.attraction', 'tourism.sights', 'heritage'], 
    icon: Landmark 
  },
  { 
    name: 'Sport', 
    id: ['sport.sports_centre', 'sport.stadium', 'sport.swimming_pool'], 
    icon: Dumbbell 
  },
  { 
    name: 'Parks', 
    id: ['leisure.park', 'natural.forest', 'leisure.garden'], 
    icon: TreePine 
  },
  { 
    name: 'Cinemas', 
    id: ['entertainment.cinema', 'entertainment.culture'], 
    icon: Film 
  },
  { 
    name: 'Restaurants', 
    id: ['catering.restaurant', 'catering.bar'], 
    icon: UtensilsCrossed 
  },
  { 
    name: 'Cafes', 
    id: ['catering.cafe'], 
    icon: Coffee 
  },
  { 
    name: 'Shopping', 
    id: ['commercial.shopping_mall', 'commercial.clothing', 'commercial.books'], 
    icon: ShoppingBag 
  },
];

type CategoryFiltersProps = {
  activeCategory: string[];
  onCategoryChange: (categoryId: string[]) => void;
};

export function CategoryFilters({ activeCategory, onCategoryChange }: CategoryFiltersProps) {
  return (
    <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 hide-scrollbar">
      {categories.map((category) => (
        <Button
          key={category.name}
          variant={
            JSON.stringify(activeCategory) === JSON.stringify(category.id) ? 'default' : 'outline'
          }
          size="sm"
          onClick={() => onCategoryChange(category.id)}
          className="flex-shrink-0 flex items-center gap-2 rounded-full"
        >
          <category.icon className="h-4 w-4" />
          <span>{category.name}</span>
        </Button>
      ))}
    </div>
  );
}
