'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      className="cursor-pointer group hover:shadow-md transition-shadow duration-200 rounded-2xl h-48 flex flex-col"
    >
      <CardHeader>
        <CardTitle className="text-lg font-bold truncate">{place.name}</CardTitle>
        <CardDescription className="flex items-center gap-2 pt-1">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <p className="truncate">{place.address}</p>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-end">
        {place.rating && (
          <div className="flex items-center gap-1 text-amber-400">
            <Star className="h-5 w-5 fill-current" />
            <span className="font-bold text-foreground">{place.rating.toFixed(1)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
