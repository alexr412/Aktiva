import {
    MapPin,
    Star,
    Tag,
    X
} from 'lucide-react';
import Image from 'next/image';
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
             <div className="absolute top-2 right-2 z-20">
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-background/50 hover:bg-background/80">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close details</span>
                </Button>
            </div>
            
            <ScrollArea className="flex-1">
                <div className="relative h-64 w-full">
                    <Image
                        src={place.imageUrl}
                        alt={`Photo of ${place.name}`}
                        fill
                        className="object-cover"
                        data-ai-hint={place.imageHint}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                     <div className="absolute bottom-0 left-0 p-4">
                        <h1 className="text-2xl font-bold text-white shadow-md">{place.name}</h1>
                        <div className="flex items-center gap-2 text-white/90 pt-1">
                            <MapPin className="h-4 w-4" />
                            <p className="text-sm">{place.address}</p>
                        </div>
                     </div>
                </div>

                <div className="p-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        {place.rating ? (
                             <div className="p-4 rounded-lg bg-muted flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center gap-2">
                                    <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
                                    <span className="font-bold text-2xl">{place.rating.toFixed(1)}</span>
                                </div>
                                <span className="text-sm text-muted-foreground">Rating</span>
                            </div>
                        ) : (
                            <div className="p-4 rounded-lg bg-muted flex flex-col items-center justify-center gap-1">
                                <Star className="h-6 w-6 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground mt-2">No Rating</span>
                            </div>
                        )}
                         <div className="p-4 rounded-lg bg-muted flex flex-col items-center justify-center gap-1">
                             <Tag className="h-6 w-6 text-primary" />
                            <span className="text-sm text-muted-foreground mt-2">Categories</span>
                        </div>
                    </div>
                     <div className="flex flex-wrap gap-2 justify-center -mt-8 relative z-10">
                        {formattedCategories.map(cat => (
                            <Badge key={cat} variant="default" className="capitalize shadow-md">{cat.replace(/_/g, ' ')}</Badge>
                        ))}
                    </div>
                    
                    <Separator />

                    <AiRecommendation place={place} />
                </div>
            </ScrollArea>
        </div>
    );
}
