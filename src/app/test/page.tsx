
'use client';

import { useState } from 'react';
import { GEOAPIFY_API_KEY } from '@/lib/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Search, Activity } from 'lucide-react';

const LAT = 53.5395845;
const LNG = 8.5809341;

export default function TestPage() {
  const [testCategory, setTestCategory] = useState<string>("commercial,catering");
  const [results, setResults] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const executeTestQuery = async () => {
    if (!testCategory.trim()) return;
    setIsFetching(true);
    
    try {
      const url = `https://api.geoapify.com/v2/places?categories=${testCategory}&filter=circle:${LNG},${LAT},5000&limit=100&conditions=named&exclude=categories:adult&apiKey=${GEOAPIFY_API_KEY}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      
      const data = await response.json();
      setResults(data.features || []);
    } catch (error) {
      console.error("Test fetch failed:", error);
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
          Geoapify Category Diagnostic
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Echtzeit-Analyse von Kategorie-Strings und Sub-Kategorien. (Base: Bremerhaven)
        </p>
      </header>

      <div className="flex flex-col gap-4 p-6 border-b bg-muted/30 shrink-0">
        <div className="flex gap-2">
          <Input 
            type="text" 
            value={testCategory} 
            onChange={(e) => setTestCategory(e.target.value)} 
            placeholder="z.B. tourism,leisure.park,amenity.toilet"
            className="flex-1 font-mono text-sm bg-background h-12"
          />
          <Button 
            onClick={executeTestQuery} 
            disabled={isFetching || !testCategory.trim()}
            className="h-12 px-6 font-bold"
          >
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {isFetching ? "Executing..." : "Run Test"}
          </Button>
        </div>
        <div className="flex justify-between items-center px-1">
          <code className="text-xs text-muted-foreground break-all">
            URL: ...?categories=<span className="text-primary font-bold">{testCategory || "null"}</span>
          </code>
          <div className="text-sm font-semibold whitespace-nowrap">
            Results: <span className="text-primary">{results.length}</span>
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
                    {feature.properties.categories?.map((cat: string) => (
                      <span 
                        key={cat} 
                        className="font-mono text-[10px] px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full"
                      >
                        {cat}
                      </span>
                    ))}
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
                <p className="text-xs text-muted-foreground/60 mt-1">Gib einen Kategorie-String ein und klicke auf "Run Test".</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
