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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


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
      <div className="relative flex items-center justify-center w-full aspect-[16/9] bg-muted/30 overflow-hidden">
          <Icon className="h-16 w-16 text-muted-foreground/80 transition-transform group-hover:scale-110" />
           <div className="absolute bottom-2 right-2 flex -space-x-2">
            {/* Placeholder Avatars */}
            <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
                <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704e" />
                <AvatarFallback>B</AvatarFallback>
            </Avatar>
            <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704f" />
                <AvatarFallback>C</AvatarFallback>
            </Avatar>
        </div>
      </div>

      <div className="p-4 bg-card">
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold leading-tight truncate">{place.name}</h3>
          <p className="text-sm text-foreground/80 truncate">{place.address}</p>
        </div>
        <div className="flex justify-between items-center pt-3 mt-2 border-t border-border/50">
            <Badge className="capitalize text-xs font-semibold bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">{mainCategory}</Badge>
            <Button
                size="icon"
                variant="outline"
                className="rounded-full h-9 w-9 bg-background"
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
