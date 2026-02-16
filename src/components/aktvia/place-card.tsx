'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import { MapPin, Star } from 'lucide-react';

type PlaceCardProps = {
  place: Place;
  onClick: () => void;
};

export function PlaceCard({ place, onClick }: PlaceCardProps) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer group overflow-hidden relative border-none shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl"
    >
      <div className="absolute inset-0 w-full h-full">
        <Image
          src={place.imageUrl}
          alt={place.name}
          width={place.imageWidth}
          height={place.imageHeight}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          data-ai-hint={place.imageHint}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>
      <CardContent className="relative flex flex-col justify-end h-64 p-4 text-white">
        <h3 className="text-lg font-bold truncate">{place.name}</h3>
        <div className="flex items-center gap-2 text-sm text-gray-200 mt-1">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <p className="truncate">{place.address}</p>
        </div>
        {place.rating && (
          <div className="flex items-center gap-1 text-amber-400 mt-2">
            <Star className="h-4 w-4 fill-current" />
            <span className="font-bold">{place.rating.toFixed(1)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
