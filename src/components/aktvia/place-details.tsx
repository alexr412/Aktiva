import {
    MapPin,
    Star,
    Tag,
    X
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { Place } from '@/lib/types';
import { AiRecommendation } from './ai-recommendation';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';


type PlaceDetailsProps = {
    place: Place;
    onClose: () => void;
};

export function PlaceDetails({ place, onClose }: PlaceDetailsProps) {
    const formattedCategories = place.categories
        .map(cat => cat.split('.')[0])
        .filter((value, index, self) => self.indexOf(value) === index);

    return (
        <div className="flex flex-col h-full relative bg-background">
            <DialogHeader className="p-4 pb-2 border-b">
                <DialogTitle className="text-2xl font-bold font-headline">{place.name}</DialogTitle>
                <div className="flex items-center gap-2 text-muted-foreground pt-1">
                    <MapPin className="h-4 w-4" />
                    <p className="text-sm">{place.address}</p>
                </div>
            </DialogHeader>

            <div className="absolute top-2 right-2 z-10">
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close details</span>
                </Button>
            </div>
            
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {place.rating && (
                         <div className="flex items-center gap-2">
                            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                            <span className="font-bold text-base">{place.rating.toFixed(1)}</span>
                            <span className="text-sm text-muted-foreground">Rating</span>
                        </div>
                    )}

                    <div>
                        <h3 className="font-semibold mb-2 flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" /> Categories</h3>
                        <div className="flex flex-wrap gap-2">
                            {formattedCategories.map(cat => (
                                <Badge key={cat} variant="secondary">{cat.replace(/_/g, ' ')}</Badge>
                            ))}
                        </div>
                    </div>
                    
                    <Separator />

                    <AiRecommendation place={place} />
                </div>
            </ScrollArea>
        </div>
    );
}
