'use client';

import type { Destination } from './types';

interface NominatimResult {
    display_name: string;
    lat: string;
    lon: string;
    importance: number;
}

export async function searchLocation(query: string): Promise<Destination[]> {
    if (!query) return [];

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`;

    try {
        const response = await fetch(url, {
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
            .map(item => ({
                name: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
            }));

    } catch (error) {
        console.error("Error fetching location from Nominatim:", error);
        return [];
    }
}
