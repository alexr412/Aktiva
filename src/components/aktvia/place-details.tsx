import {
    MapPin,
    Star,
    Tag,
    ChevronLeft
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
            <ScrollArea className="flex-1">
                 <div className="sticky top-0 z-20 flex items-center p-2 bg-gradient-to-t from-transparent to-black/20 sm:bg-transparent sm:bg-none">
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-background/60 hover:bg-background/90 backdrop-blur-sm">
                        <ChevronLeft className="h-6 w-6" />
                        <span className="sr-only">Back</span>
                    </Button>
                </div>
                
                <div className="relative h-80 w-full -mt-14">
                    <Image
                        src={place.imageUrl}
                        alt={`Photo of ${place.name}`}
                        fill
                        className="object-cover"
                        data-ai-hint={place.imageHint}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                     <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                </div>

                <div className="p-6 space-y-6 -mt-10 relative z-10">
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
