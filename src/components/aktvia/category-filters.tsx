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
  type LucideIcon,
} from 'lucide-react';

export const categories: { name: string; id: string[]; icon: LucideIcon }[] = [
  { name: 'Highlights', id: ['tourism', 'entertainment', 'leisure'], icon: Sparkles },
  { name: 'Community', id: ['user_event'], icon: Users },
  { name: 'Attractions', id: ['tourism.attraction'], icon: Landmark },
  { name: 'Sport', id: ['leisure.sport', 'service.sport_centre', 'leisure.stadium'], icon: Dumbbell },
  { name: 'Parks', id: ['leisure.park'], icon: TreePine },
  { name: 'Cinemas', id: ['entertainment.cinema'], icon: Film },
  { name: 'Restaurants', id: ['catering.restaurant'], icon: UtensilsCrossed },
  { name: 'Cafes', id: ['catering.cafe'], icon: Coffee },
  { name: 'Shopping', id: ['commercial'], icon: ShoppingBag },
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
