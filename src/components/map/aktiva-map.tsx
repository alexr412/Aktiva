'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  applyGridOffset,
  isValidCoordinate,
} from './map-marker-data';
import { getFirstName, normalizePrecisionMeters, formatDistanceBucketText } from '@/lib/radar-types';
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
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
  const friendHTMLMarkersRef = useRef<maplibregl.Marker[]>([]);
  const activePopupRef = useRef<maplibregl.Popup | null>(null);
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
    if (hasRadarAccess && radarEnabled) {
      setLayers((prev) => ({ ...prev, friends: true }));
    } else {
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

        // Friends Point Layer (Circle representing center of cells - transparent to avoid duplicate visual marker)
        map.addLayer({
          id: 'friends-point',
          type: 'circle',
          source: 'friends-source',
          filter: ['==', ['get', 'type'], 'friend-point'],
          paint: {
            'circle-color': '#2563eb',
            'circle-radius': 4,
            'circle-stroke-width': 0,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0,
          },
        });

        // Friends Point Label Symbol Layer (Disabled/Empty text to prevent duplicate rendering with HTML Avatar markers)
        map.addLayer({
          id: 'friends-point-label',
          type: 'symbol',
          source: 'friends-source',
          filter: ['==', ['get', 'type'], 'friend-point'],
          layout: {
            'text-field': '',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
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

        if (map.getLayer('friends-area')) map.moveLayer('friends-area');
        if (map.getLayer('friends-area-stroke')) map.moveLayer('friends-area-stroke');
        if (map.getLayer('friends-point')) map.moveLayer('friends-point');
        if (map.getLayer('friends-point-label')) map.moveLayer('friends-point-label');
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
      friendHTMLMarkersRef.current.forEach((m) => m.remove());
      friendHTMLMarkersRef.current = [];
      if (activePopupRef.current) {
        activePopupRef.current.remove();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Update GeoJSON Sources & HTML Markers on filtered data or layer toggle changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    // Clear old HTML friend markers
    friendHTMLMarkersRef.current.forEach((m) => m.remove());
    friendHTMLMarkersRef.current = [];

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
      const geoJsonData = createFriendsGeoJSON(parsedFriends);
      friendsSource.setData(geoJsonData);

      console.log('[FRIEND MAP SOURCE]', {
        friendCount: nearbyFriends.length,
        geoJson: geoJsonData,
        sourceExists: Boolean(friendsSource)
      });

      if (map.getLayer('friends-area')) map.moveLayer('friends-area');
      if (map.getLayer('friends-area-stroke')) map.moveLayer('friends-area-stroke');
      if (map.getLayer('friends-point')) map.moveLayer('friends-point');
      if (map.getLayer('friends-point-label')) map.moveLayer('friends-point-label');

      const isDebugMode = process.env.NODE_ENV !== 'production' || (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_RADAR_DEBUG === 'true');
      if (isDebugMode) {
        setTimeout(() => {
          if (mapInstanceRef.current && mapInstanceRef.current.isStyleLoaded()) {
            console.log('[FRIEND MAP RENDERED]', {
              features: mapInstanceRef.current.queryRenderedFeatures({
                layers: ['friends-point']
              })
            });
          }
        }, 100);
      }

      // Render interactive HTML markers for friends
      if (layers.friends) {
        const positionedFriends = applyGridOffset(nearbyFriends);
        positionedFriends.forEach(({ friend, renderLat, renderLng }) => {
          if (!isValidCoordinate(renderLat, renderLng)) return;

          const el = document.createElement('div');
          el.className = 'friend-map-marker group cursor-pointer flex flex-col items-center z-50 transition-transform hover:scale-110';

          const firstName = getFirstName(friend.displayName, friend.username);
          const fullName = friend.displayName || friend.username;
          const initial = (fullName || '?').substring(0, 1).toUpperCase();
          const distText = formatDistanceBucketText(friend.distanceBucket, language);
          const precMeters = normalizePrecisionMeters(friend);

          el.innerHTML = `
            <div class="w-10 h-10 rounded-full border-2 border-white ring-2 ring-blue-600 shadow-xl bg-blue-600 flex items-center justify-center overflow-hidden">
              ${friend.avatarUrl
                ? `<img src="${friend.avatarUrl}" class="w-full h-full object-cover rounded-full" alt="${firstName}" />`
                : `<span class="text-white text-sm font-black">${initial}</span>`}
            </div>
            <div class="mt-1 bg-slate-900/90 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-lg backdrop-blur-sm flex items-center gap-1 border border-white/20 whitespace-nowrap">
              <span>${firstName}</span>
            </div>
          `;

          el.addEventListener('click', (ev) => {
            ev.stopPropagation();
            onSelectEntity({ id: friend.userId, type: 'friend', data: friend });

            if (activePopupRef.current) {
              activePopupRef.current.remove();
            }

            const popupContent = document.createElement('div');
            popupContent.className =
              'aktiva-friend-card relative overflow-hidden p-4 rounded-[22px] bg-slate-50/95 dark:bg-neutral-900/95 backdrop-blur-md border border-slate-200/80 dark:border-neutral-700/80 shadow-2xl flex flex-col items-center text-center w-[230px] sm:w-[245px] cursor-pointer group transition-all hover:border-blue-400/50';

            popupContent.innerHTML = `
              <button type="button" class="friend-popup-close absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-200/60 hover:bg-slate-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all z-20 shadow-sm cursor-pointer" aria-label="Schließen">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>

              <div class="w-14 h-14 rounded-full mb-2.5 overflow-hidden border-2 border-blue-500/80 ring-4 ring-blue-500/15 shadow-md flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-600 group-hover:scale-105 transition-transform duration-200">
                ${
                  friend.avatarUrl
                    ? `<img src="${friend.avatarUrl}" class="w-full h-full object-cover rounded-full" alt="${fullName}" />`
                    : `<span class="text-white text-lg font-black">${initial}</span>`
                }
              </div>

              <div class="font-black text-base tracking-tight text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                ${fullName}
              </div>
              <div class="text-xs font-medium text-slate-400 dark:text-neutral-400 mb-2">
                @${friend.username}
              </div>

              <div class="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[11px] font-bold px-3 py-1 rounded-full mb-2.5 border border-blue-200/80 dark:border-blue-800/80 shadow-sm">
                <svg class="w-3 h-3 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span>${distText}</span>
              </div>

              <div class="text-[10px] text-slate-500 dark:text-neutral-400 font-medium italic bg-slate-100/70 dark:bg-neutral-800/50 px-2.5 py-1 rounded-lg w-full mb-3 border border-slate-200/40 dark:border-neutral-700/40">
                ${language === 'de' ? `Ungefährer Standort (~${precMeters}-Meter-Raster)` : `Approximate location (~${precMeters}m grid)`}
              </div>

              <button type="button" class="friend-popup-profile-btn w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all group-hover:shadow-blue-500/25">
                <span>${language === 'de' ? 'Profil ansehen' : 'View profile'}</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"></path>
                </svg>
              </button>
            `;

            const closeBtn = popupContent.querySelector('.friend-popup-close');
            if (closeBtn) {
              closeBtn.addEventListener('click', (closeEv) => {
                closeEv.stopPropagation();
                closeEv.preventDefault();
                if (activePopupRef.current) {
                  activePopupRef.current.remove();
                  activePopupRef.current = null;
                }
              });
            }

            popupContent.addEventListener('click', (cardEv) => {
              cardEv.stopPropagation();
              cardEv.preventDefault();
              if (activePopupRef.current) {
                activePopupRef.current.remove();
                activePopupRef.current = null;
              }
              router.push(`/users/${friend.userId}`);
            });

            activePopupRef.current = new maplibregl.Popup({ className: 'aktiva-friend-popup', offset: 25, closeButton: false })
              .setLngLat([renderLng, renderLat])
              .setDOMContent(popupContent)
              .addTo(map);
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([renderLng, renderLat])
            .addTo(map);

          friendHTMLMarkersRef.current.push(marker);
        });
      }
    }
  }, [places, communityActivities, nearbyFriends, layers, maxDistance, effectiveCenter, isMapLoaded, language]);

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
