
'use client';

import React from 'react';
import { Map, Marker } from 'pigeon-maps';
import type { Place } from '@/lib/types';

/**
 * Kachel-Provider: CartoDB Dark Matter für nahtlosen Dark Mode.
 * Pigeon-Maps nutzt diese Funktion, um die Kacheln für die entsprechenden Koordinaten zu laden.
 */
const darkTiler = (x: number, y: number, z: number) => {
  return `https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/${z}/${x}/${y}.png`;
};

type MapViewProps = {
  places: Place[];
  userLocation: { lat: number; lng: number };
  onPlaceSelect: (place: Place) => void;
};

export function MapView({ places, userLocation, onPlaceSelect }: MapViewProps) {
  // Pigeon-Maps erwartet Koordinaten als Array [lat, lng]
  const center: [number, number] = [userLocation.lat, userLocation.lng];

  return (
    <div className="h-full w-full bg-neutral-950 z-0 overflow-hidden relative">
      <Map 
        provider={darkTiler} 
        center={center} 
        defaultZoom={13}
        mouseEvents={true}
        touchEvents={true}
      >
        {/* Nutzerstandort-Marker (Grün / Primärfarbe) */}
        <Marker 
          width={40} 
          anchor={center} 
          color="hsl(150 60% 45%)" // Entspricht --primary
        />

        {/* Marker für alle gefundenen Orte (Blau) */}
        {places.map((place) => {
          if (!place.lat || !place.lon) return null;
          
          return (
            <Marker 
              key={place.id}
              width={30}
              anchor={[place.lat, place.lon]}
              color="#3b82f6"
              onClick={() => onPlaceSelect(place)}
            />
          );
        })}
      </Map>
    </div>
  );
}
