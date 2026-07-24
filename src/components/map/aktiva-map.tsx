'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { Place, Activity } from '@/lib/types';
import type { MapLayerVisibility, SelectedMapEntity } from './map-types';
import type { NearbyFriend } from '@/hooks/use-friend-radar';
import { useAuth } from '@/hooks/use-auth';
import { useActivePremium } from '@/hooks/use-active-premium';
import { useToast } from '@/hooks/use-toast';
import { useFriendRadar } from '@/hooks/use-friend-radar';
import {
  parsePlaceMarkers,
  parseActivityMarkers,
  createMapGeoJSON,
  createRadiusCircleGeoJSON,
  createFriendsGeoJSON,
  isValidCoordinate,
} from './map-marker-data';
import { MapControls } from './map-controls';
import { MapResultPanel } from './map-result-panel';
import { MapResultSheet } from './map-result-sheet';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AktivaMapProps {
  places: Place[];
  communityActivities: Activity[];
  nearbyFriends?: NearbyFriend[];
  userLocation: { lat: number; lng: number } | null;
  maxDistance: number | null;
  planningDestination?: { lat: number; lng: number; name?: string; city?: string } | null;
  language?: 'de' | 'en';
  isMobile?: boolean;
  selectedEntity: SelectedMapEntity;
  onSelectEntity: (entity: SelectedMapEntity) => void;
  onCreateActivity?: (place: Place) => void;
  onJoinActivity?: (activity: Activity) => Promise<any>;
}

export function AktivaMap({
  places,
  communityActivities,
  nearbyFriends = [],
  userLocation,
  maxDistance,
  planningDestination,
  language = 'de',
  isMobile = false,
  selectedEntity,
  onSelectEntity,
  onCreateActivity,
  onJoinActivity,
}: AktivaMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
  const nearbyFriendsRef = useRef<NearbyFriend[]>([]);

  useEffect(() => {
    nearbyFriendsRef.current = nearbyFriends;
  }, [nearbyFriends]);

  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  // Layer visibility state
  const [layers, setLayers] = useState<MapLayerVisibility>({
    places: true,
    activities: true,
    friends: false,
  });

  const { userProfile } = useAuth();
  const { isPremium, isOrganizer } = useActivePremium(userProfile);
  const hasRadarAccess = isPremium || isOrganizer;
  const { enabled: radarEnabled } = useFriendRadar();
  const { toast } = useToast();

  useEffect(() => {
    if (!hasRadarAccess || !radarEnabled) {
      setLayers((prev) => ({ ...prev, friends: false }));
    }
  }, [hasRadarAccess, radarEnabled]);

  const handleToggleLayer = (layerKey: keyof MapLayerVisibility) => {
    if (layerKey === 'friends') {
      if (!hasRadarAccess) {
        toast({
          variant: 'destructive',
          title: language === 'de' ? 'Zugriff verweigert' : 'Access Denied',
          description: language === 'de'
            ? 'Freunde-Radar erfordert Premium- oder Organizer-Zugriff.'
            : 'Friends Radar requires Premium or Organizer access.'
        });
        return;
      }
      if (!radarEnabled) {
        toast({
          title: language === 'de' ? 'Radar inaktiv' : 'Radar Inactive',
          description: language === 'de'
            ? 'Bitte aktiviere den Freunde-Radar in deinen Einstellungen.'
            : 'Please enable Friends Radar in your settings.'
        });
        return;
      }
    }
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  // Determine effective map center coordinate
  const effectiveCenter: [number, number] = (() => {
    if (planningDestination && isValidCoordinate(planningDestination.lat, planningDestination.lng)) {
      return [planningDestination.lng, planningDestination.lat];
    }
    if (userLocation && isValidCoordinate(userLocation.lat, userLocation.lng)) {
      return [userLocation.lng, userLocation.lat];
    }
    // Fallback: Bremerhaven / Germany default
    return [8.5802, 53.5442];
  })();

  // 1. Initialize MapLibre GL Map Client-Only
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isSupported = typeof (maplibregl as any).supported === 'function' ? (maplibregl as any).supported() : true;
    if (!isSupported) {
      setWebGlSupported(false);
      return;
    }

    if (!mapContainerRef.current) return;

    // Resolve Style URL from Environment Variable or Dev Fallback
    const envStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
    const isProd = process.env.NODE_ENV === 'production';

    if (!envStyleUrl && isProd) {
      setMapError(
        language === 'de'
          ? 'Kartenfehler in Production: Die Umgebungsvariable NEXT_PUBLIC_MAP_STYLE_URL ist nicht definiert.'
          : 'Production Map Error: The environment variable NEXT_PUBLIC_MAP_STYLE_URL is not defined.'
      );
      return;
    }

    const styleUrl = envStyleUrl || 'https://demotiles.maplibre.org/style.json';

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: styleUrl,
        center: effectiveCenter,
        zoom: 13,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      map.on('load', () => {
        setIsMapLoaded(true);

        // Add Attribution Control
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

        // Add Native Sources
        map.addSource('places-source', {
          type: 'geojson',
          data: createMapGeoJSON([]),
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        map.addSource('activities-source', {
          type: 'geojson',
          data: createMapGeoJSON([]),
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        map.addSource('radius-source', {
          type: 'geojson',
          data: createRadiusCircleGeoJSON(effectiveCenter[1], effectiveCenter[0], maxDistance || 10),
        });

        // Friends Native Source
        map.addSource('friends-source', {
          type: 'geojson',
          data: createFriendsGeoJSON([]),
        });

        // Friends Area Layer (Polygons for 2.0 km uncertainty grid cells)
        map.addLayer({
          id: 'friends-area',
          type: 'fill',
          source: 'friends-source',
          filter: ['==', ['get', 'type'], 'friend-area'],
          paint: {
            'fill-color': '#2563eb', // Blue indicator
            'fill-opacity': 0.12,
          },
        });

        map.addLayer({
          id: 'friends-area-stroke',
          type: 'line',
          source: 'friends-source',
          filter: ['==', ['get', 'type'], 'friend-area'],
          paint: {
            'line-color': '#2563eb',
            'line-width': 1.5,
            'line-dasharray': [2, 2],
          },
        });

        // Friends Point Layer (Circle representing center of cells)
        map.addLayer({
          id: 'friends-point',
          type: 'circle',
          source: 'friends-source',
          filter: ['==', ['get', 'type'], 'friend-point'],
          paint: {
            'circle-color': '#2563eb',
            'circle-radius': 9,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Click handler for friends
        map.on('click', 'friends-point', (e) => {
          const feature = e.features?.[0];
          if (feature?.properties?.userId) {
            const friend = nearbyFriendsRef.current.find((f) => f.userId === feature.properties.userId);
            if (friend) {
              onSelectEntity({ id: friend.userId, type: 'friend', data: friend });
            }
          }
        });

        map.on('mouseenter', 'friends-point', () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', 'friends-point', () => (map.getCanvas().style.cursor = ''));

        // ------------------ PLACES LAYERS ------------------
        // Places Clusters
        map.addLayer({
          id: 'places-clusters',
          type: 'circle',
          source: 'places-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#10b981', // Emerald
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 30, 30],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.addLayer({
          id: 'places-cluster-count',
          type: 'symbol',
          source: 'places-source',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        // Individual Place Points
        map.addLayer({
          id: 'places-unclustered',
          type: 'circle',
          source: 'places-source',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#10b981',
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // ------------------ ACTIVITIES LAYERS ------------------
        // Activities Clusters
        map.addLayer({
          id: 'activities-clusters',
          type: 'circle',
          source: 'activities-source',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#7c3aed', // Violet
            'circle-radius': ['step', ['get', 'point_count'], 18, 10, 24, 30, 30],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.addLayer({
          id: 'activities-cluster-count',
          type: 'symbol',
          source: 'activities-source',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        // Individual Activity Points
        map.addLayer({
          id: 'activities-unclustered',
          type: 'circle',
          source: 'activities-source',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'case',
              ['==', ['get', 'capacityStatus'], 'full'],
              '#ef4444', // Red for full
              ['==', ['get', 'capacityStatus'], 'almost_full'],
              ['case', ['==', ['get', 'isBoosted'], 1], '#f59e0b', '#f97316'], // Amber/Orange for almost full
              '#8b5cf6', // Violet default
            ],
            'circle-radius': ['case', ['==', ['get', 'isBoosted'], 1], 11, 8],
            'circle-stroke-width': 2,
            'circle-stroke-color': ['case', ['==', ['get', 'isBoosted'], 1], '#fbbf24', '#ffffff'],
          },
        });

        // Radius Fill & Line Layer
        map.addLayer({
          id: 'radius-fill',
          type: 'fill',
          source: 'radius-source',
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.08,
          },
        });

        map.addLayer({
          id: 'radius-line',
          type: 'line',
          source: 'radius-source',
          paint: {
            'line-color': '#10b981',
            'line-width': 1.5,
            'line-dasharray': [2, 2],
          },
        });

        // Click handlers on layers
        map.on('click', 'places-unclustered', (e) => {
          const feature = e.features?.[0];
          if (feature?.properties?.id) {
            const place = places.find((p) => p.id === feature.properties.id);
            if (place) {
              onSelectEntity({ id: place.id, type: 'place', data: place });
            }
          }
        });

        map.on('click', 'activities-unclustered', (e) => {
          const feature = e.features?.[0];
          if (feature?.properties?.id) {
            const act = communityActivities.find((a) => a.id === feature.properties.id);
            if (act) {
              onSelectEntity({ id: act.id!, type: 'activity', data: act });
            }
          }
        });

        // Cursor pointer on hover
        map.on('mouseenter', 'places-unclustered', () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', 'places-unclustered', () => (map.getCanvas().style.cursor = ''));
        map.on('mouseenter', 'activities-unclustered', () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', 'activities-unclustered', () => (map.getCanvas().style.cursor = ''));
      });

      map.on('error', (e) => {
        console.error('[AktivaMap] Map error:', e);
        setMapError(language === 'de' ? 'Kartendaten konnten nicht geladen werden.' : 'Failed to load map data.');
      });
    } catch (err: any) {
      console.error('[AktivaMap] Initialization exception:', err);
      setMapError(err?.message || 'Error initializing MapLibre GL');
    }

    return () => {
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.remove();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Update GeoJSON Sources on filtered data or layer toggle changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    // Update Places Source
    const placeSource = map.getSource('places-source') as maplibregl.GeoJSONSource;
    if (placeSource) {
      const placeMarkers = layers.places ? parsePlaceMarkers(places) : [];
      placeSource.setData(createMapGeoJSON(placeMarkers));
    }

    // Update Activities Source
    const actSource = map.getSource('activities-source') as maplibregl.GeoJSONSource;
    if (actSource) {
      const actMarkers = layers.activities ? parseActivityMarkers(communityActivities) : [];
      actSource.setData(createMapGeoJSON(actMarkers));
    }

    // Update Radius Source
    const radSource = map.getSource('radius-source') as maplibregl.GeoJSONSource;
    if (radSource) {
      radSource.setData(
        createRadiusCircleGeoJSON(effectiveCenter[1], effectiveCenter[0], maxDistance || 10)
      );
    }

    // Update Friends Source
    const friendsSource = map.getSource('friends-source') as maplibregl.GeoJSONSource;
    if (friendsSource) {
      const parsedFriends = layers.friends ? nearbyFriends : [];
      friendsSource.setData(createFriendsGeoJSON(parsedFriends));
    }
  }, [places, communityActivities, nearbyFriends, layers, maxDistance, effectiveCenter, isMapLoaded]);

  // 3. Highlight Selected Marker with HTML Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }

    if (selectedEntity) {
      const isFriend = selectedEntity.type === 'friend';
      const lat = isFriend ? (selectedEntity.data as any).approximateLatitude : (selectedEntity.data as any).lat;
      const lon = isFriend ? (selectedEntity.data as any).approximateLongitude : ((selectedEntity.data as any).lon ?? (selectedEntity.data as any).lng);

      if (isValidCoordinate(lat, lon)) {
        const el = document.createElement('div');
        if (isFriend) {
          el.className = 'w-9 h-9 bg-blue-600 border-2 border-white rounded-full shadow-2xl flex items-center justify-center animate-pulse';
          const avatarUrl = (selectedEntity.data as any).avatarUrl;
          if (avatarUrl) {
            el.innerHTML = `<img src="${avatarUrl}" class="w-full h-full rounded-full object-cover" />`;
          } else {
            const initial = ((selectedEntity.data as any).displayName || (selectedEntity.data as any).username || '?').substring(0, 1).toUpperCase();
            el.innerHTML = `<span class="text-white text-xs font-black">${initial}</span>`;
          }
        } else {
          el.className =
            'w-7 h-7 bg-amber-400 border-2 border-white rounded-full shadow-xl animate-bounce flex items-center justify-center';
          el.innerHTML = '<span class="w-2.5 h-2.5 bg-black rounded-full"></span>';
        }

        selectedMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map);

        map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 14) });
      }
    }
  }, [selectedEntity, isMapLoaded]);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();
  const handleRecenter = () => {
    mapInstanceRef.current?.flyTo({ center: effectiveCenter, zoom: 14 });
  };

  if (!webGlSupported) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-neutral-900">
        <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
        <h3 className="text-base font-black text-slate-800 dark:text-neutral-200">
          {language === 'de' ? 'WebGL wird nicht unterstützt' : 'WebGL not supported'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-sm">
          {language === 'de'
            ? 'Dein Browser unterstützt keine Hardwarebeschleunigung für WebGL-Karten.'
            : 'Your browser does not support WebGL hardware acceleration for maps.'}
        </p>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-neutral-900">
        <AlertTriangle className="h-10 w-10 text-rose-500 mb-3" />
        <h3 className="text-base font-black text-slate-800 dark:text-neutral-200">
          {language === 'de' ? 'Kartenfehler' : 'Map Error'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-sm">{mapError}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-4">
          {language === 'de' ? 'Erneut versuchen' : 'Try again'}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Map Container */}
      <div ref={mapContainerRef} className="h-full w-full z-0" />

      {/* Floating Map Controls & Layer Toggles */}
      <MapControls
        layers={layers}
        onToggleLayer={handleToggleLayer}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRecenter={handleRecenter}
        language={language}
        hasLocationPermission={!!userLocation}
        hasRadarAccess={hasRadarAccess}
      />

      {/* Desktop Side Panel */}
      {!isMobile && selectedEntity && (
        <MapResultPanel
          selectedEntity={selectedEntity}
          onClose={() => onSelectEntity(null)}
          onCreateActivity={onCreateActivity}
          onJoinActivity={onJoinActivity}
          language={language}
          className="absolute top-0 right-0 bottom-0"
          isLocationCurrent={selectedEntity.type === 'friend' ? ((selectedEntity.data as any)?.isLocationCurrent !== false && nearbyFriends.some(f => f.userId === selectedEntity.id)) : true}
        />
      )}

      {/* Mobile Bottom Sheet */}
      {isMobile && (
        <MapResultSheet
          placesCount={places.length}
          activitiesCount={communityActivities.length}
          places={places}
          activities={communityActivities}
          selectedEntity={selectedEntity}
          onSelectEntity={onSelectEntity}
          onCloseDetails={() => onSelectEntity(null)}
          onCreateActivity={onCreateActivity}
          onJoinActivity={onJoinActivity}
          language={language}
          isLocationCurrent={selectedEntity && selectedEntity.type === 'friend' ? ((selectedEntity.data as any)?.isLocationCurrent !== false && nearbyFriends.some(f => f.userId === selectedEntity.id)) : true}
        />
      )}
    </div>
  );
}
