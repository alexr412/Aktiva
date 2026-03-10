'use client';

import React from 'react';
import { Map, Marker } from 'pigeon-maps';
import type { Place } from '@/lib/types';
import { useTheme } from '@/contexts/theme-context';

type MapViewProps = {
  places: Place[];
  userLocation: { lat: number; lng: number };
  onPlaceSelect: (place: Place) => void;
};

export function MapView({ places, userLocation, onPlaceSelect }: MapViewProps) {
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  // Dynamischer Kachel-Provider basierend auf dem aktiven Theme
  const dynamicTiler = (x: number, y: number, z: number) => {
    const style = isDark ? 'dark_all' : 'light_all';
    return `https://cartodb-basemaps-a.global.ssl.fastly.net/${style}/${z}/${x}/${y}.png`;
  };

  const center: [number, number] = [userLocation.lat, userLocation.lng];

  return (
    <div className={`h-full w-full z-0 overflow-hidden relative transition-colors duration-300 ${isDark ? 'bg-neutral-950' : 'bg-white'}`}>
      <Map 
        provider={dynamicTiler} 
        center={center} // Fixiert den Viewport dauerhaft auf die Nutzer-Koordinaten
        defaultZoom={13}
        minZoom={12} // Maximaler Raus-Zoom
        maxZoom={18} // Maximaler Rein-Zoom
        mouseEvents={true}
        touchEvents={true}
      >
        {/* Nutzerstandort-Marker (Grün / Primärfarbe) */}
        <Marker 
          width={40} 
          anchor={center} 
          color="hsl(150 60% 45%)" 
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
