/** Geocoding uses singular `category`; Places uses `categories`. Preserve provider facts. */
export function toGeocodingFeatures(response: any): any[] {
  const results = Array.isArray(response?.results) ? response.results
    : Array.isArray(response?.features) ? response.features.map((feature: any) => ({ ...feature.properties,
      lat: feature.properties?.lat ?? feature.geometry?.coordinates?.[1],
      lon: feature.properties?.lon ?? feature.geometry?.coordinates?.[0],
    })) : [];
  return results.slice(0, 8).map((item: any) => ({
    properties: { ...item, categories: Array.isArray(item.categories) && item.categories.length
      ? item.categories : typeof item.category === 'string' && item.category ? [item.category] : [] },
    geometry: { coordinates: [item.lon, item.lat] },
  }));
}
