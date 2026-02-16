'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Place } from '@/lib/types';
import { MapPin, Star } from 'lucide-react';
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
      className="cursor-pointer group hover:shadow-lg transition-shadow duration-300 ease-in-out rounded-2xl overflow-hidden"
    >
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="text-xl font-bold truncate pr-4">{place.name}</CardTitle>
            {place.rating && (
              <div className="flex items-center gap-1 text-amber-500 flex-shrink-0">
                <Star className="h-5 w-5 fill-current" />
                <span className="font-bold text-foreground">{place.rating.toFixed(1)}</span>
              </div>
            )}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground pt-1">
          <MapPin className="h-4 w-4 flex-shrink-0" />
          <p className="truncate text-sm">{place.address}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">{mainCategory}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
