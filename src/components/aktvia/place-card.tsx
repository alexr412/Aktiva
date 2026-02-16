'use client';

import Image from 'next/image';
import { Card } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import { Star, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type PlaceCardProps = {
  place: Place;
  onClick: () => void;
};

export function PlaceCard({ place, onClick }: PlaceCardProps) {
    const mainCategory = place.categories[0]?.split('.')[0].replace(/_/g, ' ') || 'Place';

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer group border-0 shadow-none rounded-none bg-transparent overflow-visible"
    >
      <div className="relative w-full aspect-[4/5] overflow-hidden rounded-2xl">
          <Image
              src={place.imageUrl}
              alt={`Photo of ${place.name}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
              data-ai-hint={place.imageHint}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
           {place.rating && (
              <div className="absolute top-3 right-3 flex items-center gap-1 text-white bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-semibold">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span>{place.rating.toFixed(1)}</span>
              </div>
            )}
      </div>

      <div className="pt-3 space-y-1">
          <h3 className="text-base font-semibold leading-tight truncate">{place.name}</h3>
          <p className="text-sm text-muted-foreground truncate">{place.address}</p>
          <p className="text-sm text-muted-foreground capitalize">{mainCategory}</p>
      </div>

    </Card>
  );
}
