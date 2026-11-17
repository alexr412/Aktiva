import catalog from '../../data/spot-catalogs/bremerhaven-pilot.json';
import { calculateDistanceKm } from './geo-utils';
import type { Place } from './types';

const recommendationNames = [
  'Lieblingsplatz',
  'Bürgerpark',
  'Beyond Bowling (ehemals Fun Bowling)',
  'Klimahaus Bremerhaven',
  'Zoo am Meer',
  'Das Beet',
  'Bremerhaven Boulder Club',
  'Karlsburg',
];

const recommendationSpots = recommendationNames.flatMap(name => {
  const spot = catalog.places.find(place => place.name === name);
  return spot ? [spot] : [];
});

export function getBremerhavenSpotRecommendations(
  location: { lat: number; lng: number },
  radiusKm: number | null,
): Place[] {
  const distanceToCity = calculateDistanceKm(location.lat, location.lng, catalog.lat, catalog.lon);
  if (distanceToCity === null || distanceToCity > 10) return [];

  return recommendationSpots.flatMap(spot => {
    const distance = calculateDistanceKm(location.lat, location.lng, spot.lat, spot.lon);
    if (distance === null || (radiusKm !== null && distance > radiusKm)) return [];
    const { openingHours: _, ...place } = spot;
    return [{ ...place, distance }];
  });
}

function matchesRecommendation(spot: Place, recommendation: Place): boolean {
  if (spot.id === recommendation.id) return true;
  const name = spot.name.trim().toLowerCase();
  const sameName = name === recommendation.name.toLowerCase()
    || (recommendation.name.startsWith('Beyond Bowling') && ['fun bowling', 'beyond bowling'].includes(name));
  const distance = sameName ? calculateDistanceKm(spot.lat, spot.lon, recommendation.lat, recommendation.lon) : null;
  return distance !== null && distance <= 0.25;
}

export function prioritizeSpotRecommendations(spots: readonly Place[], recommendations: readonly Place[]): Place[] {
  const first = recommendations.map(recommendation => {
    const existing = spots.find(spot => spot.id === recommendation.id)
      ?? spots.find(spot => matchesRecommendation(spot, recommendation));
    if (!existing) return recommendation;
    return { ...existing, name: recommendation.name };
  });
  const remaining = spots.filter(spot =>
    !recommendations.some(recommendation => matchesRecommendation(spot, recommendation)),
  );
  return [...first, ...remaining];
}
