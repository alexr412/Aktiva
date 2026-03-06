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
  MessageSquare,
  type LucideIcon,
  Navigation,
  Bookmark,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/contexts/favorites-context';
import { cn } from '@/lib/utils';


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

const formatDistance = (distanceInMeters?: number) => {
    if (distanceInMeters === undefined) {
        return null;
    }
    if (distanceInMeters < 1000) {
        return `${Math.round(distanceInMeters)} m`;
    }
    return `${(distanceInMeters / 1000).toFixed(1)} km`;
};


type PlaceCardProps = {
  place: Place;
  onClick: () => void;
  onAddActivity: (place: Place) => void;
};

export function PlaceCard({ place, onClick, onAddActivity }: PlaceCardProps) {
    const { addFavorite, removeFavorite, checkIsFavorite } = useFavorites();
    const isFavorite = checkIsFavorite(place.id);
    const Icon = getCategoryIcon(place.categories);
    
    const cleanTags = place.categories
      ? place.categories
          .filter((value, index, self) => self.indexOf(value) === index)
      : [];
    
    const handleBookmarkToggle = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card's onClick from firing
        if (isFavorite) {
            removeFavorite(place.id);
        } else {
            addFavorite(place);
        }
    };


  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer group overflow-hidden rounded-2xl bg-card shadow-md hover:shadow-lg transition-all duration-300 border-none flex flex-col relative",
        place.isPromoted && "ring-2 ring-primary/20 bg-primary/[0.02]"
      )}
    >
      {place.isPromoted && (
        <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm animate-pulse">
          <Sparkles className="h-2.5 w-2.5" />
          <span>PROMOTED</span>
        </div>
      )}

      <div className="flex items-stretch">
        <div className={cn(
          "relative flex flex-shrink-0 items-center justify-center w-28",
          place.isPromoted ? "bg-primary/10" : "bg-muted/30"
        )}>
            <Icon className={cn(
              "h-10 w-10",
              place.isPromoted ? "text-primary/70" : "text-muted-foreground/70"
            )} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center p-3">
            <h3 className="text-base font-semibold truncate w-full">{place.name}</h3>
            <p className="text-sm text-muted-foreground truncate w-full mt-1">{place.address}</p>
            {place.distance !== undefined && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 font-medium">
                    <Navigation className="h-3 w-3"/>
                    <span>{formatDistance(place.distance)}</span>
                </div>
            )}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end p-3 pt-0">
        {/* Activity Indicator */}
        {place.activityCount && place.activityCount > 0 ? (
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground self-start">
            <MessageSquare className="h-4 w-4" />
            <span>
              {place.activityCount} Aktivität{place.activityCount > 1 ? 'en' : ''}
            </span>
          </div>
        ) : (
          <div className="h-[34px] mb-2" />
        )}
        
        {/* Tags and Button */}
        <div className="flex items-end justify-between gap-2">
          <div className="flex w-full flex-wrap items-center gap-2 overflow-hidden">
            {cleanTags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-[10px] font-medium text-secondary-foreground whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full bg-background"
                onClick={handleBookmarkToggle}
            >
                <Bookmark className={cn("h-4 w-4", isFavorite && "fill-current text-primary")} />
                <span className="sr-only">Bookmark place</span>
            </Button>
            <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 flex-shrink-0 rounded-full bg-background"
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
