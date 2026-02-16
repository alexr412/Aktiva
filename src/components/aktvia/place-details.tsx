import Image from 'next/image';
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
             <div className="relative h-64 w-full">
                <Image
                    src={place.imageUrl}
                    alt={place.name}
                    className="object-cover"
                    fill
                    data-ai-hint={place.imageHint}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute top-2 right-2 z-10">
                    <Button variant="ghost" size="icon" onClick={onClose} className="bg-black/30 hover:bg-black/50 text-white hover:text-white rounded-full">
                        <X className="h-5 w-5" />
                        <span className="sr-only">Close details</span>
                    </Button>
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                    <h2 className="text-2xl font-bold font-headline">{place.name}</h2>
                    <div className="flex items-center gap-2 text-gray-200 mt-1">
                        <MapPin className="h-4 w-4" />
                        <p className="text-sm">{place.address}</p>
                    </div>
                </div>
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
