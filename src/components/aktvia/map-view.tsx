'use client';

import React, { useState } from 'react';
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
  
  // State für Zoom-Metrik
  const [zoomLevel, setZoomLevel] = useState(14);

  // Dynamischer Kachel-Provider basierend auf dem aktiven Theme
  const dynamicTiler = (x: number, y: number, z: number) => {
    const style = isDark ? 'dark_all' : 'light_all';
    return `https://cartodb-basemaps-a.global.ssl.fastly.net/${style}/${z}/${x}/${y}.png`;
  };

  const center: [number, number] = [userLocation.lat, userLocation.lng];

  return (
    <div className={`h-full w-full z-0 overflow-hidden relative transition-colors duration-300 ${isDark ? 'bg-neutral-950' : 'bg-white'}`}>
      
      {/* Metrik-Overlay für Zoom */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm shadow-sm border border-slate-100 dark:border-neutral-800 rounded-full px-4 py-1.5 flex items-center gap-2 pointer-events-none transition-all">
        <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-black uppercase tracking-wider">Zoom</span>
        <span className="text-sm font-black text-slate-800 dark:text-neutral-200">{Math.round(zoomLevel)}</span>
      </div>

      <Map 
        provider={dynamicTiler} 
        center={center} // Fixiert den Viewport dauerhaft auf die Nutzer-Koordinaten
        defaultZoom={14}
        minZoom={14} // Striktere Begrenzung für Rauszoomen (View-Lock)
        maxZoom={18} // Maximaler Rein-Zoom
        mouseEvents={true}
        touchEvents={true}
        onBoundsChanged={({ zoom }) => {
          setZoomLevel(zoom);
        }}
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
