'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import type { Place } from '@/lib/types';
import { useEffect } from 'react';

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

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

export function MapView({ places, userLocation, onPlaceSelect }: MapViewProps) {
  const center: [number, number] = [userLocation.lat, userLocation.lng];

  return (
    <div className="h-full w-full z-0 bg-neutral-950">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true} 
        className="h-full w-full"
      >
        {/* CartoDB Dark Matter Tiles für konsistenten Dark Mode */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <ChangeView center={center} />
        
        {places.map((place) => (
          <Marker 
            key={place.id} 
            position={[place.lat, place.lon]}
            icon={customIcon}
            eventHandlers={{
              click: () => onPlaceSelect(place),
            }}
          >
            <Popup className="dark-popup">
              <div className="p-1">
                <h3 className="font-bold text-sm text-neutral-900">{place.name}</h3>
                <p className="text-xs text-neutral-600">{place.address}</p>
                <button 
                  onClick={() => onPlaceSelect(place)}
                  className="mt-2 text-xs font-bold text-primary hover:underline"
                >
                  Details anzeigen
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
