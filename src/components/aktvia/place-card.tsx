'use client';

import Image from 'next/image';
import { Card } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage } from '@/components/ui/avatar';

type PlaceCardProps = {
  place: Place;
  onClick: () => void;
};

export function PlaceCard({ place, onClick }: PlaceCardProps) {
    const mainCategory = place.categories[0]?.split('.')[0].replace(/_/g, ' ') || 'Place';

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer group overflow-hidden rounded-2xl bg-card shadow-md hover:shadow-lg transition-shadow border"
    >
      <div className="relative w-full aspect-video overflow-hidden">
          <Image
              src={place.imageUrl}
              alt={`Photo of ${place.name}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
              data-ai-hint={place.imageHint}
              sizes="(max-width: 640px) 100vw, 50vw"
          />
          <div className="absolute bottom-3 right-3 flex items-center">
            <div className="flex -space-x-2 overflow-hidden rounded-full border-2 border-background/50 backdrop-blur-sm">
                <Avatar className="h-6 w-6">
                    <AvatarImage src="https://i.pravatar.cc/150?img=1" alt="User 1" />
                </Avatar>
                 <Avatar className="h-6 w-6">
                    <AvatarImage src="https://i.pravatar.cc/150?img=2" alt="User 2" />
                </Avatar>
                 <Avatar className="h-6 w-6">
                    <AvatarImage src="https://i.pravatar.cc/150?img=3" alt="User 3" />
                </Avatar>
            </div>
          </div>
      </div>

      <div className="p-3 space-y-1.5">
          <h3 className="text-lg font-bold leading-tight truncate">{place.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{place.address}</p>
          <div className="flex justify-between items-center pt-1">
            <Badge className="capitalize text-xs font-semibold bg-primary/10 text-primary border-transparent hover:bg-primary/20">{mainCategory}</Badge>
             {place.rating && (
                <div className="flex items-center gap-1 text-xs font-bold text-foreground/80 shrink-0">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{place.rating.toFixed(1)}</span>
                </div>
            )}
          </div>
      </div>

    </Card>
  );
}
