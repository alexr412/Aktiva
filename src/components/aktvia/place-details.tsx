import {
    Star,
    ChevronLeft,
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
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Place } from '@/lib/types';
import { AiRecommendation } from './ai-recommendation';

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

type PlaceDetailsProps = {
    place: Place;
    onClose: () => void;
};

export function PlaceDetails({ place, onClose }: PlaceDetailsProps) {
    const Icon = getCategoryIcon(place.categories);
    const formattedCategories = place.categories
        .map(cat => cat.split('.')[0])
        .filter((value, index, self) => self.indexOf(value) === index);

    return (
        <div className="flex flex-col h-full relative bg-background">
            <div className="absolute top-0 left-0 z-20 flex items-center p-2">
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-background/60 hover:bg-background/90 backdrop-blur-sm">
                    <ChevronLeft className="h-6 w-6" />
                    <span className="sr-only">Back</span>
                </Button>
            </div>
            <ScrollArea className="flex-1">
                <div className="relative flex items-center justify-center h-48 w-full bg-muted/30">
                     <Icon className="h-20 w-20 text-muted-foreground/80" />
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold">{place.name}</h1>
                        <div className="flex items-center gap-2 text-muted-foreground pt-1">
                            <p className="text-sm">{place.address}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-center">
                        {place.rating ? (
                             <div className="p-4 rounded-xl bg-muted/80 flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center gap-2">
                                    <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
                                    <span className="font-bold text-2xl">{place.rating.toFixed(1)}</span>
                                </div>
                                <span className="text-sm text-muted-foreground">Rating</span>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-muted/80 flex flex-col items-center justify-center gap-1">
                                <Star className="h-6 w-6 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground mt-2">No Rating</span>
                            </div>
                        )}
                         <div className="p-4 rounded-xl bg-muted/80 flex flex-col items-center justify-center gap-2">
                            <div className="flex flex-wrap gap-2 justify-center">
                                {formattedCategories.slice(0, 2).map(cat => (
                                    <Badge key={cat} variant="secondary" className="capitalize">{cat.replace(/_/g, ' ')}</Badge>
                                ))}
                            </div>
                            <span className="text-sm text-muted-foreground">Categories</span>
                        </div>
                    </div>
                    
                    <Separator />

                    <AiRecommendation place={place} />
                </div>
            </ScrollArea>
        </div>
    );
}
