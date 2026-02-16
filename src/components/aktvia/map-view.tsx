'use client';

import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '@/lib/config';
import type { Place } from '@/lib/types';

type MapViewProps = {
  center: { lat: number; lng: number };
  places: Place[];
  selectedPlace: Place | null;
  onMarkerClick: (place: Place) => void;
};

export function MapView({ center, places, selectedPlace, onMarkerClick }: MapViewProps) {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    return (
        <div className="flex h-full w-full items-center justify-center bg-muted">
            <p className="max-w-xs text-center text-muted-foreground">
                Google Maps API key is not configured. Please add it to `src/lib/config.ts` to display the map.
            </p>
        </div>
    )
  }
  
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <Map
        mapId="aktvia-map"
        style={{ width: '100%', height: '100%' }}
        defaultCenter={center}
        center={center}
        defaultZoom={14}
        gestureHandling={'greedy'}
        disableDefaultUI={true}
      >
        {places.map((place) => (
          <AdvancedMarker
            key={place.id}
            position={{ lat: place.lat, lng: place.lon }}
            onClick={() => onMarkerClick(place)}
          >
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center transition-all duration-300 transform
                ${selectedPlace?.id === place.id 
                  ? 'bg-accent scale-125 border-2 border-white shadow-lg' 
                  : 'bg-primary border-2 border-white/80'}`}
            >
                <div className="h-2 w-2 bg-white rounded-full"></div>
            </div>
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  );
}
