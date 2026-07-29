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
import { useFavorites } from '@/contexts/favorites-context';
import {
  parsePlaceMarkers,
  parseActivityMarkers,
  createMapGeoJSON,
  createRadiusCircleGeoJSON,
  createFriendsGeoJSON,
  applyGridOffset,
  isValidCoordinate,
  createPlacePopupHTML,
  createActivityPopupHTML,
  createFriendPopupHTML,
  getActivityJoinState,
} from './map-marker-data';
import { getFirstName, normalizePrecisionMeters, formatDistanceBucketText } from '@/lib/radar-types';
import {
  tryAcquireActivityActionLock,
  setActivityActionStatus,
  getActivityActionStatus,
} from '@/lib/activity-action-state';
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

  const { user, userProfile } = useAuth();
  const { isPremium, isOrganizer } = useActivePremium(userProfile);
  const hasRadarAccess = isPremium || isOrganizer;
  const { enabled: radarEnabled } = useFriendRadar();
  const { toast } = useToast();

  let checkIsFavorite = (_id: string) => false;
  let toggleFavorite = (_place: Place) => {};
  try {
    const favs = useFavorites();
    checkIsFavorite = favs.checkIsFavorite;
    toggleFavorite = (p: Place) => {
      if (favs.checkIsFavorite(p.id)) {
        favs.removeFavorite(p.id);
      } else {
        favs.addFavorite({
          id: p.id,
          name: p.name,
          address: p.address,
          categories: p.categories || [],
          lat: p.lat,
          lon: p.lon,
        });
      }
    };
  } catch (e) {
    // Fallback if rendered outside FavoritesProvider
  }

  // Stable Callback & Data Refs for MapLibre Click Handlers
  const onSelectEntityRef = useRef(onSelectEntity);
  useEffect(() => { onSelectEntityRef.current = onSelectEntity; }, [onSelectEntity]);

  const checkIsFavoriteRef = useRef(checkIsFavorite);
  useEffect(() => { checkIsFavoriteRef.current = checkIsFavorite; }, [checkIsFavorite]);

  const toggleFavoriteRef = useRef(toggleFavorite);
  useEffect(() => { toggleFavoriteRef.current = toggleFavorite; }, [toggleFavorite]);

  const placesRef = useRef(places);
  useEffect(() => { placesRef.current = places; }, [places]);

  const communityActivitiesRef = useRef(communityActivities);
  useEffect(() => { communityActivitiesRef.current = communityActivities; }, [communityActivities]);

  const userLocationRef = useRef(userLocation);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);

  const languageRef = useRef(language);
  useEffect(() => { languageRef.current = language; }, [language]);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const onJoinActivityRef = useRef(onJoinActivity);
  useEffect(() => { onJoinActivityRef.current = onJoinActivity; }, [onJoinActivity]);

  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const placeFavoriteLocksRef = useRef<Set<string>>(new Set());

  const prevPlacesGeoJsonStrRef = useRef<string>('');
  const prevActivitiesGeoJsonStrRef = useRef<string>('');
  const prevRadiusGeoJsonStrRef = useRef<string>('');
  const prevFriendsGeoJsonStrRef = useRef<string>('');

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

      // Handle missing style images gracefully (e.g. road_, poi icons) to eliminate console warnings
      map.on('styleimagemissing', (e) => {
        const id = e.id;
        if (!map.hasImage(id)) {
          const width = 1;
          const height = 1;
          const data = new Uint8Array(4); // transparent RGBA pixel
          try {
            map.addImage(id, { width, height, data });
          } catch {
            // Ignore if image was added concurrently
          }
        }
      });

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

        // ------------------ CLUSTER & LAYER CLICK HANDLERS ------------------
        // Cluster click handler for places (zooms into cluster, no popup)
        map.on('click', 'places-clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['places-clusters'] });
          const clusterId = features[0]?.properties?.cluster_id;
          const source = map.getSource('places-source') as maplibregl.GeoJSONSource;
          if (source && clusterId !== undefined) {
            source.getClusterExpansionZoom(clusterId).then((zoom) => {
              map.easeTo({
                center: (features[0].geometry as any).coordinates,
                zoom: zoom,
              });
            }).catch(() => {});
          }
        });

        // Cluster click handler for activities (zooms into cluster, no popup)
        map.on('click', 'activities-clusters', (e) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ['activities-clusters'] });
          const clusterId = features[0]?.properties?.cluster_id;
          const source = map.getSource('activities-source') as maplibregl.GeoJSONSource;
          if (source && clusterId !== undefined) {
            source.getClusterExpansionZoom(clusterId).then((zoom) => {
              map.easeTo({
                center: (features[0].geometry as any).coordinates,
                zoom: zoom,
              });
            }).catch(() => {});
          }
        });

        // Single Place marker click handler -> opens Place Popup
        map.on('click', 'places-unclustered', (e) => {
          const feature = e.features?.[0];
          if (feature?.properties?.id) {
            const place = placesRef.current.find((p) => p.id === feature.properties.id);
            if (place) {
              if (onSelectEntityRef.current) {
                onSelectEntityRef.current({ id: place.id, type: 'place', data: place });
              } else if (process.env.NODE_ENV !== 'production') {
                console.warn('[PLACE POPUP] onSelectEntity callback is missing');
              }

              if (activePopupRef.current) {
                activePopupRef.current.remove();
                activePopupRef.current = null;
              }

              const lon = place.lon ?? (place as any).lng ?? (place as any).longitude;
              const lat = place.lat ?? (place as any).latitude;
              if (isValidCoordinate(lat, lon)) {
                const isFav = checkIsFavoriteRef.current(place.id);
                const popupObj = createPlacePopupHTML(place, userLocationRef.current, languageRef.current, isFav);

                const popup = new maplibregl.Popup({
                  className: 'aktiva-place-popup',
                  offset: 20,
                  closeButton: false,
                })
                  .setLngLat([lon, lat])
                  .setDOMContent(popupObj.container)
                  .addTo(map);

                activePopupRef.current = popup;

                // Query elements from rendered Popup DOM or content container
                const popupElement = popup.getElement();
                const detailsBtn = popupElement?.querySelector<HTMLButtonElement>('.place-popup-details-btn') || popupObj.detailsBtn;
                const routeBtn = popupElement?.querySelector<HTMLButtonElement>('.place-popup-route-btn') || popupObj.routeBtn;
                const favBtn = (popupElement?.querySelector<HTMLButtonElement>('.place-popup-fav-btn') || popupObj.favBtn) as HTMLButtonElement | null;
                const shareBtn = popupElement?.querySelector<HTMLButtonElement>('.place-popup-share-btn') || popupObj.shareBtn;
                const closeBtn = popupElement?.querySelector<HTMLElement>('.friend-popup-close') || popupObj.closeBtn;

                if (process.env.NODE_ENV !== 'production' || (typeof window !== 'undefined' && (window as any).NEXT_PUBLIC_MAP_DEBUG === 'true')) {
                  console.log('[PLACE POPUP BINDINGS]', {
                    details: Boolean(detailsBtn),
                    route: Boolean(routeBtn),
                    favorite: Boolean(favBtn),
                    share: Boolean(shareBtn),
                    placeId: place.id
                  });
                }

                const handleClose = (event: MouseEvent) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (activePopupRef.current) {
                    activePopupRef.current.remove();
                    activePopupRef.current = null;
                  }
                };

                const handleDetails = (event: MouseEvent) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (activePopupRef.current) {
                    activePopupRef.current.remove();
                    activePopupRef.current = null;
                  }
                  if (onSelectEntityRef.current) {
                    onSelectEntityRef.current({ id: place.id, type: 'place', data: place });
                  } else if (process.env.NODE_ENV !== 'production') {
                    console.warn('[PLACE POPUP] onSelectEntity callback is missing');
                  }
                };

                const handleFavorite = async (event: MouseEvent) => {
                  event.preventDefault();
                  event.stopPropagation();

                  if (placeFavoriteLocksRef.current.has(place.id)) {
                    return;
                  }
                  placeFavoriteLocksRef.current.add(place.id);

                  if (favBtn) {
                    favBtn.disabled = true;
                    favBtn.innerHTML = `<svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>`;
                  }

                  try {
                    await toggleFavoriteRef.current(place);

                    const isNowFav = checkIsFavoriteRef.current(place.id);
                    if (favBtn) {
                      favBtn.className = `place-popup-fav-btn absolute top-2 left-2 w-10 h-10 min-w-[40px] min-h-[40px] rounded-full ${
                        isNowFav ? 'bg-rose-500 text-white' : 'bg-black/40 hover:bg-black/60 active:bg-black/80 text-white'
                      } flex items-center justify-center transition-all z-20 shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-400`;
                      favBtn.setAttribute('aria-label', isNowFav
                        ? (languageRef.current === 'de' ? 'Favorit entfernen' : 'Remove favorite')
                        : (languageRef.current === 'de' ? 'Als Favorit speichern' : 'Save as favorite'));
                      favBtn.innerHTML = `<svg class="w-4 h-4 ${isNowFav ? 'fill-white' : 'fill-none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
                    }
                  } catch (err) {
                    if (toastRef.current) {
                      toastRef.current({
                        variant: 'destructive',
                        title: languageRef.current === 'de' ? 'Fehler' : 'Error',
                        description: languageRef.current === 'de'
                          ? 'Favorit konnte nicht aktualisiert werden.'
                          : 'Could not update favorite.',
                      });
                    }
                    const isStillFav = checkIsFavoriteRef.current(place.id);
                    if (favBtn) {
                      favBtn.className = `place-popup-fav-btn absolute top-2 left-2 w-10 h-10 min-w-[40px] min-h-[40px] rounded-full ${
                        isStillFav ? 'bg-rose-500 text-white' : 'bg-black/40 hover:bg-black/60 active:bg-black/80 text-white'
                      } flex items-center justify-center transition-all z-20 shadow-md cursor-pointer focus-visible:ring-2 focus-visible:ring-rose-400`;
                      favBtn.innerHTML = `<svg class="w-4 h-4 ${isStillFav ? 'fill-white' : 'fill-none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>`;
                    }
                  } finally {
                    placeFavoriteLocksRef.current.delete(place.id);
                    if (favBtn) {
                      favBtn.disabled = false;
                    }
                  }
                };

                const handleRoute = (event: MouseEvent) => {
                  event.preventDefault();
                  event.stopPropagation();

                  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isValidCoordinate(lat, lon)) {
                    if (toastRef.current) {
                      toastRef.current({
                        variant: 'destructive',
                        title: languageRef.current === 'de' ? 'Fehler' : 'Error',
                        description: languageRef.current === 'de'
                          ? 'Für diesen Ort sind keine Routendaten verfügbar.'
                          : 'No valid route data available for this location.',
                      });
                    }
                    return;
                  }

                  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`;
                  window.open(url, '_blank', 'noopener,noreferrer');

                  if (activePopupRef.current) {
                    activePopupRef.current.remove();
                    activePopupRef.current = null;
                  }
                };

                const handleShare = async (event: MouseEvent) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const shareUrl = `${window.location.origin}/?placeId=${place.id}`;
                  const shareData = {
                    title: place.name,
                    text: languageRef.current === 'de' ? `Schau dir ${place.name} auf Aktiva an!` : `Check out ${place.name} on Aktiva!`,
                    url: shareUrl,
                  };
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    try {
                      await navigator.share(shareData);
                    } catch {
                      // User cancelled share
                    }
                  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      if (toastRef.current) {
                        toastRef.current({
                          title: languageRef.current === 'de' ? 'Link kopiert!' : 'Link copied!',
                          description: languageRef.current === 'de' ? 'Link in Zwischenablage kopiert.' : 'Link copied to clipboard.'
                        });
                      }
                    } catch (err) {
                      console.error('Clipboard copy failed:', err);
                    }
                  }
                };

                const handleCardClick = (event: MouseEvent) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (activePopupRef.current) {
                    activePopupRef.current.remove();
                    activePopupRef.current = null;
                  }
                  if (onSelectEntityRef.current) {
                    onSelectEntityRef.current({ id: place.id, type: 'place', data: place });
                  }
                };

                closeBtn?.addEventListener('click', handleClose);
                detailsBtn?.addEventListener('click', handleDetails);
                favBtn?.addEventListener('click', handleFavorite);
                routeBtn?.addEventListener('click', handleRoute);
                shareBtn?.addEventListener('click', handleShare);
                popupObj.container.addEventListener('click', handleCardClick);

                const cleanupPopupListeners = () => {
                  closeBtn?.removeEventListener('click', handleClose);
                  detailsBtn?.removeEventListener('click', handleDetails);
                  favBtn?.removeEventListener('click', handleFavorite);
                  routeBtn?.removeEventListener('click', handleRoute);
                  shareBtn?.removeEventListener('click', handleShare);
                  popupObj.container.removeEventListener('click', handleCardClick);
                };

                popup.on('close', cleanupPopupListeners);
              }
            }
          }
        });

        // Single Activity marker click handler -> opens Activity Popup
        map.on('click', 'activities-unclustered', (e) => {
          const feature = e.features?.[0];
          if (feature?.properties?.id) {
            const act = communityActivitiesRef.current.find((a) => a.id === feature.properties.id);
            if (act && act.id) {
              if (onSelectEntityRef.current) {
                onSelectEntityRef.current({ id: act.id, type: 'activity', data: act });
              }

              if (activePopupRef.current) {
                activePopupRef.current.remove();
                activePopupRef.current = null;
              }

              const lon = act.lon ?? (act as any).lng ?? (act as any).longitude;
              const lat = act.lat ?? (act as any).latitude;
              if (isValidCoordinate(lat, lon)) {
                const popupObj = createActivityPopupHTML(act, userLocationRef.current, userRef.current?.uid, languageRef.current);

                const popup = new maplibregl.Popup({
                  className: 'aktiva-activity-popup',
                  offset: 20,
                  closeButton: false,
                })
                  .setLngLat([lon, lat])
                  .setDOMContent(popupObj.container)
                  .addTo(map);

                activePopupRef.current = popup;

                const popupElement = popup.getElement();
                const closeBtn = popupElement?.querySelector<HTMLElement>('.friend-popup-close') || popupObj.closeBtn;
                const detailsBtn = popupElement?.querySelector<HTMLElement>('.activity-popup-details-btn') || popupObj.detailsBtn;
                const joinBtn = popupElement?.querySelector<HTMLElement>('.activity-popup-join-btn') || popupObj.joinBtn;

                const handleClose = (closeEv: MouseEvent) => {
                  closeEv.stopPropagation();
                  closeEv.preventDefault();
                  if (activePopupRef.current) {
                    activePopupRef.current.remove();
                    activePopupRef.current = null;
                  }
                };

                const handleDetails = (detailsEv: MouseEvent) => {
                  detailsEv.stopPropagation();
                  detailsEv.preventDefault();
                  if (activePopupRef.current) {
                    activePopupRef.current.remove();
                    activePopupRef.current = null;
                  }
                  if (onSelectEntityRef.current) {
                    onSelectEntityRef.current({ id: act.id!, type: 'activity', data: act });
                  }
                  routerRef.current.push(`/activities/${act.id}`);
                };

                const handleJoin = async (joinEv: MouseEvent) => {
                  joinEv.stopPropagation();
                  joinEv.preventDefault();

                  if (!userRef.current) {
                    routerRef.current.push('/login');
                    return;
                  }

                  if (popupObj.joinState.disabled || !onJoinActivityRef.current) return;

                  // Synchronous in-flight lock check
                  if (!tryAcquireActivityActionLock(act.id!)) {
                    return;
                  }

                  const isDirect = act.joinMode === 'direct';
                  setActivityActionStatus(act.id!, 'submitting');

                  if (joinBtn) {
                    joinBtn.setAttribute('disabled', 'true');
                    joinBtn.classList.add('opacity-80', 'cursor-wait');
                    joinBtn.innerHTML = `<span>${
                      isDirect
                        ? (languageRef.current === 'de' ? 'Wird beigetreten …' : 'Joining …')
                        : (languageRef.current === 'de' ? 'Wird gesendet …' : 'Submitting …')
                    }</span>`;
                  }

                  try {
                    const resStatus = await onJoinActivityRef.current(act);
                    const isJoinedRes = resStatus === 'joined' || isDirect;
                    const newStatus = isJoinedRes ? 'joined' : 'requested';
                    setActivityActionStatus(act.id!, newStatus);

                    if (joinBtn) {
                      joinBtn.setAttribute('disabled', 'true');
                      joinBtn.className = `activity-popup-join-btn flex-1 min-h-[44px] py-2 px-3 ${
                        isJoinedRes ? 'bg-emerald-600/90' : 'bg-amber-600/90'
                      } text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 cursor-default`;
                      joinBtn.innerHTML = `<span>${
                        isJoinedRes
                          ? (languageRef.current === 'de' ? 'Beigetreten' : 'Joined')
                          : (languageRef.current === 'de' ? 'Anfrage gesendet' : 'Request sent')
                      }</span>`;
                    }
                  } catch (err: any) {
                    setActivityActionStatus(act.id!, 'failed');
                    if (joinBtn) {
                      joinBtn.removeAttribute('disabled');
                      const fallbackState = getActivityJoinState(act, userRef.current?.uid, languageRef.current);
                      joinBtn.className = `activity-popup-join-btn flex-1 min-h-[44px] py-2 px-3 ${fallbackState.btnClass} font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all focus-visible:ring-2 focus-visible:ring-purple-400`;
                      joinBtn.innerHTML = `<span>${fallbackState.label}</span>`;
                    }
                  }
                };

                const handleCardClick = (cardEv: MouseEvent) => {
                  cardEv.stopPropagation();
                  cardEv.preventDefault();
                  if (activePopupRef.current) {
                    activePopupRef.current.remove();
                    activePopupRef.current = null;
                  }
                  if (onSelectEntityRef.current) {
                    onSelectEntityRef.current({ id: act.id!, type: 'activity', data: act });
                  }
                  routerRef.current.push(`/activities/${act.id}`);
                };

                closeBtn?.addEventListener('click', handleClose);
                detailsBtn?.addEventListener('click', handleDetails);
                joinBtn?.addEventListener('click', handleJoin);
                popupObj.container.addEventListener('click', handleCardClick);

                const cleanupPopupListeners = () => {
                  closeBtn?.removeEventListener('click', handleClose);
                  detailsBtn?.removeEventListener('click', handleDetails);
                  joinBtn?.removeEventListener('click', handleJoin);
                  popupObj.container.removeEventListener('click', handleCardClick);
                };

                popup.on('close', cleanupPopupListeners);
              }
            }
          }
        });

        // Cursor pointer on hover
        map.on('mouseenter', 'places-clusters', () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', 'places-clusters', () => (map.getCanvas().style.cursor = ''));
        map.on('mouseenter', 'activities-clusters', () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', 'activities-clusters', () => (map.getCanvas().style.cursor = ''));
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
      const geoJsonData = createMapGeoJSON(placeMarkers);
      const geoJsonStr = JSON.stringify(geoJsonData);
      if (geoJsonStr !== prevPlacesGeoJsonStrRef.current) {
        prevPlacesGeoJsonStrRef.current = geoJsonStr;
        placeSource.setData(geoJsonData);
      }
    }

    // Update Activities Source
    const actSource = map.getSource('activities-source') as maplibregl.GeoJSONSource;
    if (actSource) {
      const actMarkers = layers.activities ? parseActivityMarkers(communityActivities) : [];
      const geoJsonData = createMapGeoJSON(actMarkers);
      const geoJsonStr = JSON.stringify(geoJsonData);
      if (geoJsonStr !== prevActivitiesGeoJsonStrRef.current) {
        prevActivitiesGeoJsonStrRef.current = geoJsonStr;
        actSource.setData(geoJsonData);
      }
    }

    // Update Radius Source
    const radSource = map.getSource('radius-source') as maplibregl.GeoJSONSource;
    if (radSource) {
      const radiusGeoJson = createRadiusCircleGeoJSON(effectiveCenter[1], effectiveCenter[0], maxDistance || 10);
      const radiusGeoJsonStr = JSON.stringify(radiusGeoJson);
      if (radiusGeoJsonStr !== prevRadiusGeoJsonStrRef.current) {
        prevRadiusGeoJsonStrRef.current = radiusGeoJsonStr;
        radSource.setData(radiusGeoJson);
      }
    }

    // Update Friends Source
    const friendsSource = map.getSource('friends-source') as maplibregl.GeoJSONSource;
    if (friendsSource) {
      const parsedFriends = layers.friends ? nearbyFriends : [];
      const geoJsonData = createFriendsGeoJSON(parsedFriends);
      const geoJsonStr = JSON.stringify(geoJsonData);

      if (geoJsonStr !== prevFriendsGeoJsonStrRef.current) {
        prevFriendsGeoJsonStrRef.current = geoJsonStr;
        friendsSource.setData(geoJsonData);

        const isDebugMode = process.env.NODE_ENV !== 'production' || (typeof window !== 'undefined' && ((window as any).NEXT_PUBLIC_MAP_DEBUG === 'true' || (window as any).NEXT_PUBLIC_RADAR_DEBUG === 'true'));
        if (isDebugMode) {
          console.log('[FRIEND MAP SOURCE]', {
            friendCount: nearbyFriends.length,
            geoJson: geoJsonData,
            sourceExists: Boolean(friendsSource)
          });
        }

        if (map.getLayer('friends-area')) map.moveLayer('friends-area');
        if (map.getLayer('friends-area-stroke')) map.moveLayer('friends-area-stroke');
        if (map.getLayer('friends-point')) map.moveLayer('friends-point');
        if (map.getLayer('friends-point-label')) map.moveLayer('friends-point-label');

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
          const distText = formatDistanceBucketText(friend.distanceBucket, languageRef.current);
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
            if (onSelectEntityRef.current) {
              onSelectEntityRef.current({ id: friend.userId, type: 'friend', data: friend });
            }

            if (activePopupRef.current) {
              activePopupRef.current.remove();
              activePopupRef.current = null;
            }

            const popupObj = createFriendPopupHTML(friend, languageRef.current);

            const popup = new maplibregl.Popup({
              className: 'aktiva-friend-popup',
              offset: 20,
              closeButton: false,
            })
              .setLngLat([renderLng, renderLat])
              .setDOMContent(popupObj.container)
              .addTo(map);

            activePopupRef.current = popup;

            const popupElement = popup.getElement();
            const closeBtn = popupElement?.querySelector<HTMLElement>('.friend-popup-close') || popupObj.closeBtn;
            const profileBtn = popupElement?.querySelector<HTMLElement>('.friend-popup-profile-btn') || popupObj.profileBtn;

            const handleClose = (closeEv: MouseEvent) => {
              closeEv.stopPropagation();
              closeEv.preventDefault();
              if (activePopupRef.current) {
                activePopupRef.current.remove();
                activePopupRef.current = null;
              }
            };

            const handleProfile = (profileEv: MouseEvent) => {
              profileEv.stopPropagation();
              profileEv.preventDefault();
              if (activePopupRef.current) {
                activePopupRef.current.remove();
                activePopupRef.current = null;
              }
              if (onSelectEntityRef.current) {
                onSelectEntityRef.current({ id: friend.userId, type: 'friend', data: friend });
              }
              routerRef.current.push(`/profile/${friend.userId}`);
            };

            const handleCardClick = (cardEv: MouseEvent) => {
              cardEv.stopPropagation();
              cardEv.preventDefault();
              if (activePopupRef.current) {
                activePopupRef.current.remove();
                activePopupRef.current = null;
              }
              if (onSelectEntityRef.current) {
                onSelectEntityRef.current({ id: friend.userId, type: 'friend', data: friend });
              }
              routerRef.current.push(`/profile/${friend.userId}`);
            };

            closeBtn?.addEventListener('click', handleClose);
            profileBtn?.addEventListener('click', handleProfile);
            popupObj.container.addEventListener('click', handleCardClick);

            const cleanupPopupListeners = () => {
              closeBtn?.removeEventListener('click', handleClose);
              profileBtn?.removeEventListener('click', handleProfile);
              popupObj.container.removeEventListener('click', handleCardClick);
            };

            popup.on('close', cleanupPopupListeners);
          });

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([renderLng, renderLat])
            .addTo(map);

          friendHTMLMarkersRef.current.push(marker);
        });
      }
    }
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
