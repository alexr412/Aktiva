import { NextResponse } from 'next/server';
import { GEOAPIFY_API_KEY } from '@/lib/config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text');

  if (!text) {
    return NextResponse.json({ error: 'Missing search text' }, { status: 400 });
  }

  const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(text)}&format=json&apiKey=${GEOAPIFY_API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("API Request failed");
    const initialData = await response.json();

    if (!initialData.results || initialData.results.length === 0) {
      return NextResponse.json(initialData);
    }

    // Für jedes Ergebnis die detaillierten Place-Details abrufen, um den vollständigen Tag-Satz zu erhalten
    const detailedResults = await Promise.all(initialData.results.map(async (item: any) => {
      if (!item.place_id) return item;

      try {
        const detailsUrl = `https://api.geoapify.com/v2/place-details?id=${item.place_id}&apiKey=${GEOAPIFY_API_KEY}`;
        const detailsRes = await fetch(detailsUrl);
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json();
          // Mergen der detaillierten Kategorien in das ursprüngliche Objekt
          return {
            ...item,
            categories: detailsData.features?.[0]?.properties?.categories || item.categories || [],
            category: detailsData.features?.[0]?.properties?.category || item.category
          };
        }
      } catch (e) {
        console.error("Details fetch error:", e);
      }
      return item;
    }));

    if (detailedResults.length > 0) {
      console.log("DEBUG DETAILED RESPONSE (Element 0):", JSON.stringify(detailedResults[0], null, 2));
    }

    return NextResponse.json({ ...initialData, results: detailedResults });
  } catch (error) {
    console.error("Debug Proxy Fetch Error:", error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}
