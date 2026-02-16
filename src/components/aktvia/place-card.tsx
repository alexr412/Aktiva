'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Place } from '@/lib/types';
import { MapPin, Star } from 'lucide-react';

type PlaceCardProps = {
  place: Place;
  onClick: () => void;
};

export function PlaceCard({ place, onClick }: PlaceCardProps) {
    const formattedCategories = place.categories
        .map(cat => cat.split('.')[0])
        .filter((value, index, self) => self.indexOf(value) === index);

  return (
    <Card onClick={onClick} className="cursor-pointer hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg truncate">{place.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <p className="truncate">{place.address}</p>
        </div>
        {place.rating && (
            <div className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="font-bold">{place.rating.toFixed(1)}</span>
            </div>
        )}
        {formattedCategories.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
                {formattedCategories.slice(0, 3).map(cat => (
                    <Badge key={cat} variant="secondary">{cat.replace(/_/g, ' ')}</Badge>
                ))}
            </div>
        )}
      </CardContent>
    </Card>
  );
}
