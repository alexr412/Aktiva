'use client';

import { Button } from '@/components/ui/button';
import {
  UtensilsCrossed,
  Coffee,
  TreePine,
  ShoppingBag,
  Bed,
  Landmark,
  Film,
  type LucideIcon,
} from 'lucide-react';

export const categories: { name: string; id: string[]; icon: LucideIcon }[] = [
  { name: 'Restaurants', id: ['catering.restaurant'], icon: UtensilsCrossed },
  { name: 'Cafes', id: ['catering.cafe'], icon: Coffee },
  { name: 'Parks', id: ['leisure.park'], icon: TreePine },
  { name: 'Attractions', id: ['tourism.attraction'], icon: Landmark },
  { name: 'Shopping', id: ['commercial'], icon: ShoppingBag },
  { name: 'Cinemas', id: ['entertainment.cinema'], icon: Film },
  { name: 'Hotels', id: ['accommodation.hotel'], icon: Bed },
];

type CategoryFiltersProps = {
  activeCategory: string[];
  onCategoryChange: (categoryId: string[]) => void;
};

export function CategoryFilters({ activeCategory, onCategoryChange }: CategoryFiltersProps) {
  return (
    <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4">
      {categories.map((category) => (
        <Button
          key={category.name}
          variant={
            JSON.stringify(activeCategory) === JSON.stringify(category.id) ? 'default' : 'outline'
          }
          size="sm"
          onClick={() => onCategoryChange(category.id)}
          className="flex-shrink-0 flex items-center gap-2"
        >
          <category.icon className="h-4 w-4" />
          <span>{category.name}</span>
        </Button>
      ))}
    </div>
  );
}
