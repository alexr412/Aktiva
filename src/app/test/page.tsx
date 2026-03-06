'use client';

import { useState } from 'react';
import { GEOAPIFY_API_KEY } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Search, Activity, MapPin } from 'lucide-react';
import { GLOBAL_EXCLUDE_STRING, BASE_HARD_VETO, BASE_SOFT_VETO, CONDITION_PREFIXES } from '@/lib/geoapify';

export default function TestPage() {
  const [testCity, setTestCity] = useState<string>("Bremerhaven");
  const [testCategory, setTestCategory] = useState<string>("commercial,catering");
  const [coordinates, setCoordinates] = useState<{lat: number, lng: number}>({ lat: 53.5395845, lng: 8.5809341 });
  const [results, setResults] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const resolveCoordinates = async (cityName: string) => {
    const geoUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(cityName)}&limit=1&apiKey=${GEOAPIFY_API_KEY}`;
    const response = await fetch(geoUrl);
    if (!response.ok) throw new Error("Geocoding service unavailable");
    
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const { lat, lon } = data.features[0].properties;
      setCoordinates({ lat, lng: lon });
      return { lat, lng: lon };
    }
    throw new Error("City not found");
  };

  const executeTestQuery = async () => {
    const sanitizedCategory = testCategory.trim().replace(/\s+/g, '');
    if (!sanitizedCategory || !testCity.trim()) return;
    
    setIsFetching(true);
    
    try {
      const includeTags = sanitizedCategory.split(',');
      const { lat, lng } = await resolveCoordinates(testCity);

      const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(sanitizedCategory)}&filter=circle:${lng},${lat},5000&limit=100&conditions=named&exclude=${GLOBAL_EXCLUDE_STRING}&apiKey=${GEOAPIFY_API_KEY}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      const rawFeatures = data.features || [];
      
      const safeFeatures = rawFeatures.filter((feature: any) => {
        const itemTags: string[] = Array.isArray(feature.properties?.categories) 
          ? feature.properties.categories 
          : [feature.properties?.categories];

        // Stufe 0: Absolutes System-Veto (Hard Veto)
        const violatesBaseHard = itemTags.some(tag => 
          BASE_HARD_VETO.some(veto => tag === veto || tag.startsWith(`${veto}.`))
        );
        if (violatesBaseHard) return false;

        // Stufe 2: Zwingende Inklusion (Whitelist Override)
        if (includeTags.length > 0) {
          const satisfiesInclusion = itemTags.some(tag => includeTags.includes(tag));
          if (satisfiesInclusion) return true;
          return false;
        }

        // Stufe 3: Relative Exklusion (Soft Veto)
        const coreTags = itemTags.filter(tag => 
          !CONDITION_PREFIXES.some(prefix => tag === prefix || tag.startsWith(`${prefix}.`)) &&
          !tag.startsWith("building")
        );

        if (BASE_SOFT_VETO.length > 0 && coreTags.length > 0) {
          const isSolelyExcludedIdentity = coreTags.every(coreTag => 
            BASE_SOFT_VETO.some(excludedTag => coreTag === excludedTag || coreTag.startsWith(`${excludedTag}.`))
          );
          if (isSolelyExcludedIdentity) return false;
        }

        return true; 
      });

      setResults(safeFeatures);
    } catch (error: any) {
      console.error("Test pipeline failed:", error);
      alert(error.message || "An error occurred during the test.");
      setResults([]);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="p-6 border-b shrink-0 bg-card">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Activity className="text-primary" />
          Geoapify Diagnostic Console
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Echtzeit-Analyse mit Hard-/Soft-Veto Schichten.
        </p>
      </header>

      <div className="flex flex-col gap-4 p-6 border-b bg-muted/30 shrink-0">
        <div className="space-y-4">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="text" 
              value={testCity} 
              onChange={(e) => setTestCity(e.target.value)} 
              placeholder="Stadt eingeben (z.B. Berlin, Hamburg)"
              className="pl-10 bg-background h-12 font-medium"
            />
          </div>
          
          <div className="flex gap-2">
            <Input 
              type="text" 
              value={testCategory} 
              onChange={(e) => setTestCategory(e.target.value)} 
              placeholder="Kategorien (z.B. tourism,catering.restaurant)"
              className="flex-1 font-mono text-sm bg-background h-12"
            />
            <Button 
              onClick={executeTestQuery} 
              disabled={isFetching || !testCategory.trim() || !testCity.trim()}
              className="h-12 px-6 font-bold"
            >
              {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {isFetching ? "Resolving..." : "Run Test"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1 px-1 bg-background/50 p-3 rounded-lg border border-border/50">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Resolved Coordinates:</span>
            <span className="text-primary font-bold">{coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}</span>
          </div>
          <div className="text-sm font-semibold whitespace-nowrap mt-2">
            Results (Hard/Soft logic): <span className="text-primary">{results.length}</span>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6 bg-secondary/20">
        <div className="max-w-4xl mx-auto space-y-3 pb-20">
          {results.length > 0 ? (
            results.map((feature, index) => (
              <Card key={index} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-bold text-base">{feature.properties.name || "UNNAMED ENTITY"}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{feature.properties.address_line2}</p>
                    </div>
                    <div className="text-[10px] bg-muted px-2 py-1 rounded font-mono">
                      {feature.properties.place_id.slice(0, 8)}...
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {feature.properties.categories?.map((cat: string) => {
                      const isHard = BASE_HARD_VETO.some(veto => cat === veto || cat.startsWith(`${veto}.`));
                      const isSoft = BASE_SOFT_VETO.some(veto => cat === veto || cat.startsWith(`${veto}.`));
                      
                      return (
                        <span 
                          key={cat} 
                          className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${
                            isHard 
                              ? 'bg-destructive text-white border-none' 
                              : isSoft
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-primary/10 text-primary border-primary/20'
                          }`}
                        >
                          {cat}
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="bg-muted p-4 rounded-full">
                <Search className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-muted-foreground">Warte auf Datensatz...</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Stadt und Kategorien wählen, dann auf "Run Test" klicken.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
