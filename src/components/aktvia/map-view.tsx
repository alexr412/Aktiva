'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Place } from '@/lib/types';
import { useEffect, useState } from 'react';

/**
 * Fix für defekte Leaflet-Icons in Next.js Umgebungen.
 * Nutzt statische CDN-Pfade, um Pfad-Konflikte während des SSR zu vermeiden.
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
 * Sub-Komponente zur Steuerung der Kamera.
 * Verhindert das vollständige Neu-Initialisieren des MapContainers.
 */
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

export function MapView({ places, userLocation, onPlaceSelect }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !userLocation) {
    return (
      <div className="h-full w-full bg-neutral-950 flex items-center justify-center text-muted-foreground">
        Lade Karte...
      </div>
    );
  }

  const center: [number, number] = [userLocation.lat, userLocation.lng];

  return (
    <div className="h-full w-full z-0 bg-neutral-950 overflow-hidden relative">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true} 
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        {/* CartoDB Dark Matter Tiles für konsistenten Dark Mode */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* Verarbeitet Updates der Position ohne Remount des Containers */}
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
                  <p className="text-xs text-neutral-600 mb-2">{place.address}</p>
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
