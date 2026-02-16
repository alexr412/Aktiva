import {
    MapPin,
    Star,
    Tag
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Place } from '@/lib/types';
import { AiRecommendation } from './ai-recommendation';


type PlaceDetailsProps = {
    place: Place;
    onClose: () => void;
};

export function PlaceDetails({ place, onClose }: PlaceDetailsProps) {
    const formattedCategories = place.categories
        .map(cat => cat.split('.')[0])
        .filter((value, index, self) => self.indexOf(value) === index);

    return (
        <div className="flex flex-col h-full">
            <div className="p-4">
                <Button variant="ghost" size="sm" onClick={onClose} className="mb-2">
                    &larr; Back to list
                </Button>
                <h2 className="text-2xl font-bold font-headline">{place.name}</h2>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <MapPin className="h-4 w-4" />
                    <p className="text-sm">{place.address}</p>
                </div>
                {place.rating && (
                     <div className="flex items-center gap-1 text-amber-500 mt-2">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="font-bold text-sm">{place.rating.toFixed(1)}</span>
                    </div>
                )}
            </div>
            <Separator />
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2"><Tag className="h-4 w-4" /> Categories</h3>
                        <div className="flex flex-wrap gap-2">
                            {formattedCategories.map(cat => (
                                <Badge key={cat} variant="secondary">{cat.replace(/_/g, ' ')}</Badge>
                            ))}
                        </div>
                    </div>
                    
                    <AiRecommendation place={place} />

                </div>
            </ScrollArea>
        </div>
    );
}
