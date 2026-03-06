'use client';

import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '@/lib/config';
import type { Place } from '@/lib/types';
import { useMemo } from 'react';

type MapViewProps = {
  places: Place[];
  userLocation: { lat: number; lng: number };
  onPlaceSelect: (place: Place) => void;
};

export function MapView({ places, userLocation, onPlaceSelect }: MapViewProps) {
  const position = useMemo(() => userLocation, [userLocation]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <p className="text-destructive-foreground bg-destructive p-4 rounded-md">
          Google Maps API Key is missing.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={position}
          defaultZoom={13}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          mapId="aktvia-map"
        >
          {places.map((place) => (
            <AdvancedMarker
              key={place.id}
              position={{ lat: place.lat, lng: place.lon }}
              onClick={() => onPlaceSelect(place)}
              zIndex={place.isSponsored ? 1000 : 1}
            >
              {place.isSponsored ? (
                <Pin
                  background={'#FFD700'} // Gold
                  borderColor={'#DAA520'}
                  glyphColor={'#8B4513'}
                  scale={1.2}
                />
              ) : (
                <Pin
                  background={'hsl(var(--primary))'}
                  borderColor={'hsl(var(--primary))'}
                  glyphColor={'#fff'}
                />
              )}
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
