'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { fetchUnfilteredPlaceInfo, BASE_HARD_VETO, BASE_SOFT_VETO, BASE_WHITELIST } from '@/lib/geoapify';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Search, AlertCircle, CheckCircle2, XCircle, Info, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DebugPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Unautorisierter Zugriff blockieren
  if (authLoading) return (
    <div className="flex h-screen items-center justify-center bg-neutral-950">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (!user || userProfile?.role !== 'admin') {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-neutral-950 p-6 text-center">
        <XCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Zugriff Verweigert</h1>
        <p className="text-neutral-400 max-w-md">Diese Seite ist ausschließlich für Administratoren zur Veto-Diagnose reserviert.</p>
        <Button className="mt-6 rounded-full px-8" onClick={() => window.location.href = '/'}>Zurück zum Feed</Button>
      </div>
    );
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const data = await fetchUnfilteredPlaceInfo(query);
      setResults(data);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTagStatus = (tag: string) => {
    if (BASE_WHITELIST.includes(tag)) return 'whitelist';
    if (BASE_HARD_VETO.includes(tag)) return 'hard';
    if (BASE_SOFT_VETO.includes(tag)) return 'soft';
    
    // Check parent fallback
    const parent = tag.split('.')[0];
    if (BASE_WHITELIST.includes(parent)) return 'whitelist-fallback';
    if (BASE_HARD_VETO.includes(parent)) return 'hard-fallback';
    if (BASE_SOFT_VETO.includes(parent)) return 'soft-fallback';
    
    return 'none';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'whitelist': return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30';
      case 'whitelist-fallback': return 'bg-emerald-500/10 text-emerald-600/80 border-emerald-500/20 italic';
      case 'hard': return 'bg-red-500/20 text-red-600 border-red-500/30';
      case 'hard-fallback': return 'bg-red-500/10 text-red-600/80 border-red-500/20 italic';
      case 'soft': return 'bg-amber-500/20 text-amber-600 border-amber-500/30';
      case 'soft-fallback': return 'bg-amber-500/10 text-amber-600/80 border-amber-500/20 italic';
      default: return 'bg-secondary text-muted-foreground border-border';
    }
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto pb-32 pt-12 px-4 selection:bg-primary/30 relative bg-background/50">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 bg-gradient-to-tr from-primary to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic text-foreground leading-none">Veto <span className="text-primary tracking-normal not-italic tracking-tighter">Diagnosis</span></h1>
          </div>
          <p className="text-muted-foreground font-medium">Bypass applyFilters to identify tag collisions and logic conflicts.</p>
        </header>

        <form onSubmit={handleSearch} className="relative mb-12 group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
          </div>
          <Input 
            className="w-full bg-card border-input h-16 pl-14 pr-32 rounded-3xl text-lg font-medium focus:ring-primary focus:border-primary transition-all shadow-xl text-foreground"
            placeholder="Search place name (e.g. Klimahaus Bremerhaven)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button 
            disabled={loading}
            className="absolute right-3 top-3 bottom-3 rounded-2xl px-6 bg-primary hover:bg-primary/90 font-bold uppercase tracking-tight text-white"
            type="submit"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Diagnose"}
          </Button>
        </form>

        <div className="space-y-6">
          {searched && results.length === 0 && !loading && (
            <div className="bg-card border-border rounded-3xl p-12 text-center shadow-lg">
              <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg font-medium">No results found for your query. Try a more specific name.</p>
            </div>
          )}

          {results.map((place, idx) => (
            <Card key={idx} className="bg-card border-border rounded-[2.5rem] p-6 sm:p-8 overflow-hidden relative group hover:border-primary/30 transition-all duration-300 shadow-2xl">
              <div className="flex flex-col md:flex-row justify-between gap-8 relative z-10">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h2 className="text-2xl font-black truncate tracking-tighter text-foreground uppercase italic">{place.name}</h2>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-lg",
                      place.simulatedVetoStatus === 'hard' ? "bg-red-500/20 text-red-500 border-red-500/30" :
                      place.simulatedVetoStatus === 'soft' ? "bg-amber-500/20 text-amber-500 border-amber-500/30" :
                      "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                    )}>
                      {place.simulatedVetoStatus} Block
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm mb-8 flex items-center gap-2 font-medium">
                    <Navigation className="h-3 w-3 text-primary" /> {place.address}
                  </p>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                       RAW GEOAPIFY CATEGORIES <div className="h-[1px] flex-1 bg-border" />
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {place.rawCategories && place.rawCategories.length > 0 ? (
                        place.rawCategories.map((tag: string) => {
                          const status = getTagStatus(tag);
                          return (
                            <span 
                              key={tag} 
                              className={cn(
                                "px-2.5 py-1 text-[11px] font-mono border rounded-xl transition-all hover:scale-110 cursor-help shadow-sm uppercase",
                                getStatusColor(status)
                              )}
                            >
                              {tag}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-sm text-neutral-600 italic">Keine Tags übermittelt.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:w-64 shrink-0 bg-secondary/30 rounded-[2rem] p-6 border border-border flex flex-col items-center justify-center text-center">
                  <div className="bg-card h-16 w-16 rounded-2xl flex items-center justify-center mb-4 border border-border shadow-inner">
                    <CheckCircle2 className={cn(
                      "h-8 w-8",
                      place.simulatedVetoStatus === 'none' ? "text-emerald-500" : "text-muted"
                    )} />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">Final Logic Result</h3>
                  <div className={cn(
                    "text-lg font-black uppercase italic tracking-tighter",
                    place.simulatedVetoStatus === 'none' ? "text-emerald-500" : "text-muted-foreground"
                  )}>
                    {place.simulatedVetoStatus === 'none' ? 'PASS' : 'VETOED'}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
