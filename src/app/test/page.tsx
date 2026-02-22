'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fetchNearbyPlaces } from '@/lib/geoapify';
import { Loader2 } from 'lucide-react';
import type { Place } from '@/lib/types';
import { PlaceCard } from '@/components/aktvia/place-card';


const GEOAPIFY_CATEGORIES = [
  "accommodation", "adult", "airport", "building", "catering", 
  "childcare", "commercial", "education", "emergency", "entertainment", 
  "healthcare", "heritage", "leisure", "natural", "office", 
  "parking", "public_transport", "religion", "rental", "service", 
  "sport", "tourism"
];

export default function TestPage() {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [results, setResults] = useState<Place[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const toggleCategory = (category: string) => {
    setActiveFilters(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const fetchTestResults = async () => {
    if (activeFilters.length === 0) return;
    setIsLoading(true);
    setResults(null);
    
    try {
      // Statische Koordinaten (Bremerhaven) für isolierte Evaluierung
      const lat = 53.5395845;
      const lng = 8.5809341;

      const data = await fetchNearbyPlaces(lat, lng, activeFilters, 10, 0);
      setResults(data);
    } catch (error) {
      console.error("Fetch-Fehler:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="p-6 flex flex-col gap-6 h-dvh">
      <div>
        <h1 className="text-2xl font-bold">Geoapify Filter Visualisierung</h1>
        <p className="text-muted-foreground">Wählen Sie Kategorien aus, um die Karten-Darstellung der API-Antwort zu testen.</p>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {GEOAPIFY_CATEGORIES.map(category => (
          <Button
            key={category}
            variant={activeFilters.includes(category) ? 'default' : 'outline'}
            onClick={() => toggleCategory(category)}
            className="rounded-full"
          >
            {category}
          </Button>
        ))}
      </div>

       <div className="flex flex-col gap-4 border-t pt-4 flex-1 min-h-0">
        <div className="flex items-center gap-4">
           <Button 
            onClick={fetchTestResults}
            disabled={isLoading || activeFilters.length === 0}
            className="w-48"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? 'Lade...' : 'Karten generieren'}
          </Button>
          <Card className="flex-1">
            <CardContent className="p-2">
                <code className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">categories=</span>{activeFilters.length > 0 ? activeFilters.join(',') : '(none)'}
                </code>
            </CardContent>
          </Card>
        </div>

        <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader>
                <CardTitle className="text-base">Gefilterte Resultate</CardTitle>
                <CardDescription>
                    {results ? `${results.length} Entitäten gefunden` : 'Warten auf Datensatz...'}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto bg-muted/50 rounded-b-lg p-4">
                {isLoading ? (
                     <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : results && results.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.map((place) => (
                           <PlaceCard 
                                key={place.id}
                                place={place}
                                onClick={() => {}}
                                onAddActivity={() => {}}
                           />
                        ))}
                    </div>
                ) : results ? (
                     <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">Keine Ergebnisse für diese Filter.</p>
                    </div>
                ) : (
                     <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">Kategorien auswählen und auf "Karten generieren" klicken, um Ergebnisse anzuzeigen.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
