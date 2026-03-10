'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Place } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';

/**
 * Fix for broken Leaflet icons in Next.js environments.
 * Uses static CDN paths to avoid path conflicts during SSR/Build.
 */
const customIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

type MapViewProps = {
  places: Place[];
  userLocation: { lat: number; lng: number };
  onPlaceSelect: (place: Place) => void;
};

/**
 * Sub-component to control the map camera.
 * Allows smooth panning on coordinate changes without re-initializing the container.
 */
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && map) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export function MapView({ places, userLocation, onPlaceSelect }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Generate a unique ID for this specific component instance.
  // This forces React to create a completely new DOM node if the component is remounted,
  // effectively bypassing the "Map container is already initialized" error.
  const mapInstanceKey = useMemo(() => `map-instance-${Math.random().toString(36).substr(2, 9)}`, []);

  useEffect(() => {
    // Mount-Lock: Only allow map rendering after the first client-side paint.
    setIsMounted(true);
    
    return () => {
      setIsMounted(false);
    };
  }, []);

  if (!isMounted || !userLocation) {
    return (
      <div className="h-full w-full bg-neutral-950 flex items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest">Initializing Map...</span>
        </div>
      </div>
    );
  }

  const center: [number, number] = [userLocation.lat, userLocation.lng];

  return (
    <div className="h-full w-full z-0 bg-neutral-950 overflow-hidden relative">
      <MapContainer 
        key={mapInstanceKey} 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true} 
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        {/* CartoDB Dark Matter Tiles for consistent Dark Mode */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* Puts the camera on position updates */}
        <ChangeView center={center} />
        
        {places.map((place) => {
          if (!place.lat || !place.lon) return null;
          
          return (
            <Marker 
              key={place.id} 
              position={[place.lat, place.lon]}
              icon={customIcon}
              eventHandlers={{
                click: () => onPlaceSelect(place),
              }}
            >
              <Popup className="dark-popup">
                <div className="p-1 min-w-[150px]">
                  <h3 className="font-bold text-sm text-neutral-900">{place.name}</h3>
                  <p className="text-xs text-neutral-600 mb-2 truncate">{place.address}</p>
                  <button 
                    onClick={() => onPlaceSelect(place)}
                    className="w-full py-1.5 bg-primary text-white rounded-md text-xs font-bold hover:opacity-90 transition-colors"
                  >
                    Details anzeigen
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
