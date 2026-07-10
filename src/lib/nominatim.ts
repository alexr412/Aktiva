'use client';

import type { Destination } from './types';

interface NominatimResult {
    display_name: string;
    lat: string;
    lon: string;
    importance: number;
    address?: {
        postcode?: string;
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        suburb?: string;
        state?: string;
        country?: string;
        road?: string;
        house_number?: string;
    };
}

export async function searchLocation(query: string, signal?: AbortSignal): Promise<Destination[]> {
    if (!query) return [];

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;

    try {
        const response = await fetch(url, {
            signal,
            headers: {
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });
        if (!response.ok) {
            throw new Error(`Nominatim API failed with status ${response.status}`);
        }
        const data: NominatimResult[] = await response.json();
        
        // Sort by importance and map to the Destination type
        return data
            .sort((a, b) => b.importance - a.importance)
            .map(item => {
                const postcode = item.address?.postcode || "";
                const city = item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || item.address?.suburb || "";
                
                // If it's a specific address (e.g. road or house_number exists), we format as PLZ + Ort
                // Otherwise, if postcode and city are present we format as PLZ + Ort as well.
                const formattedName = [postcode, city].filter(Boolean).join(" ").trim() || item.display_name;
                
                return {
                    name: formattedName,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                };
            });

    } catch (error) {
        console.error("Error fetching location from Nominatim:", error);
        return [];
    }
}
