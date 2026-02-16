'use client';

import Image from 'next/image';
import { Card } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import { Star } from 'lucide-react';
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
      className="cursor-pointer group overflow-hidden rounded-2xl border shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="relative w-full aspect-[4/5] overflow-hidden">
          <Image
              src={place.imageUrl}
              alt={`Photo of ${place.name}`}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
              data-ai-hint={place.imageHint}
              sizes="(max-width: 640px) 100vw, 50vw"
          />
      </div>

      <div className="p-3 space-y-1">
          <div className="flex justify-between items-start">
            <h3 className="text-base font-semibold leading-tight pr-2">{place.name}</h3>
            {place.rating && (
                <div className="flex items-center gap-1 text-sm font-semibold shrink-0">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span>{place.rating.toFixed(1)}</span>
                </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{place.address}</p>
          <Badge variant="secondary" className="capitalize text-xs font-medium">{mainCategory}</Badge>
      </div>

    </Card>
  );
}
