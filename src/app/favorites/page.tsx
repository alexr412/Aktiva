'use client';

import { useState, useEffect } from 'react';
import { useFavorites } from '@/contexts/favorites-context';
import { useCollections } from '@/hooks/use-collections';
import { PlaceCard } from '@/components/aktvia/place-card';
import type { Place, ActivityCategory } from '@/lib/types';
import { Bookmark, Folder, Trash2, ArrowLeft, Plus, Loader2, Sparkles, Lock, FolderPlus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { createActivity } from '@/lib/firebase/firestore';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PremiumUpgradeModal } from '@/components/premium/PremiumUpgradeModal';
import { GEOAPIFY_API_KEY } from '@/lib/config';
import { cn } from '@/lib/utils';

export default function FavoritesPage() {
    const { favorites } = useFavorites();
    const { user } = useAuth();
    const language = useLanguage();
    const router = useRouter();
    const { toast } = useToast();

    // Collection Hook
    const {
        collections,
        loading: collectionsLoading,
        isPremium,
        createCollection,
        deleteCollection,
        removePlaceFromCollection,
        maxCollections
    } = useCollections();

    // UI States
    const [activeTab, setActiveTab] = useState<'favorites' | 'collections'>('favorites');
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [newColName, setNewColName] = useState('');
    const [isUpsellOpen, setIsUpsellOpen] = useState(false);

    // Place & Activity Dialog States
    const [activityModalPlace, setActivityModalPlace] = useState<Place | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

    // Place details cache for collections
    const [cachedDetails, setCachedDetails] = useState<Record<string, Place>>({});
    const [loadingPlaces, setLoadingPlaces] = useState<Record<string, boolean>>({});

    const selectedCollection = collections.find(c => c.id === selectedCollectionId);

    // Fetch details for places in the active collection
    useEffect(() => {
        if (!selectedCollection) return;

        selectedCollection.places.forEach(async (placeId) => {
            if (cachedDetails[placeId] || loadingPlaces[placeId]) return;

            // Check favorites first
            const favMatch = favorites.find(f => f.id === placeId);
            if (favMatch) {
                setCachedDetails(prev => ({ ...prev, [placeId]: favMatch as Place }));
                return;
            }

            // Fetch from Geoapify Place Details API
            setLoadingPlaces(prev => ({ ...prev, [placeId]: true }));
            try {
                const res = await fetch(`https://api.geoapify.com/v2/place-details?id=${placeId}&apiKey=${GEOAPIFY_API_KEY}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.features && data.features.length > 0) {
                        const props = data.features[0].properties;
                        const cats = Array.isArray(props.categories) ? props.categories : [props.categories];
                        const fetchedPlace: Place = {
                            id: props.place_id,
                            name: props.name || props.address_line1,
                            address: props.address_line2,
                            categories: cats,
                            lat: props.lat,
                            lon: props.lon,
                            openingHours: props.opening_hours || props.datasource?.raw?.opening_hours || null
                        };
                        setCachedDetails(prev => ({ ...prev, [placeId]: fetchedPlace }));
                    }
                }
            } catch (err) {
                console.error("Error fetching place details in collection:", err);
            } finally {
                setLoadingPlaces(prev => ({ ...prev, [placeId]: false }));
            }
        });
    }, [selectedCollectionId, selectedCollection, favorites, cachedDetails, loadingPlaces]);

    const handleCreateCollection = async () => {
        if (!newColName.trim()) return;
        const success = await createCollection(newColName.trim());
        if (success) {
            setNewColName('');
        }
    };

    const handleOpenActivityModal = (place: Place) => {
        if (!user) {
            router.push('/login');
            toast({
                title: language === 'de' ? 'Login erforderlich' : 'Login Required',
                description: language === 'de' ? 'Bitte logge dich ein, um eine Aktivität zu erstellen.' : 'Please log in to create an activity.',
            });
            return;
        }
        setActivityModalPlace(place);
    };

    const handleCreateActivity = async (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number, isBoosted?: boolean, isPaid?: boolean, price?: number, category?: ActivityCategory, description?: string, requirements?: any, joinMode?: 'direct' | 'request'): Promise<boolean> => {
        if (!user || !activityModalPlace) {
            toast({
                title: language === 'de' ? 'Fehler' : 'Error',
                description: language === 'de' ? 'Du musst angemeldet sein, um eine Aktivität zu erstellen.' : 'You must be logged in to create an activity.',
                variant: 'destructive',
            });
            return false;
        }

        try {
            const newActivityRef = await createActivity({
                place: activityModalPlace,
                startDate,
                endDate,
                user,
                isTimeFlexible,
                maxParticipants,
                category: category || (language === 'de' ? 'Sonstiges' : 'Other') as ActivityCategory,
                description,
                requirements,
                joinMode
            });
            toast({
                title: language === 'de' ? 'Aktivität erstellt!' : 'Activity Created!',
                description: language === 'de' ? `Deine Aktivität bei ${activityModalPlace.name} wurde geplant.` : `Your activity at ${activityModalPlace.name} is set.`,
            });

            setActivityModalPlace(null);
            router.push(`/chat/${newActivityRef.id}`);
            return true;
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Erstellen fehlgeschlagen' : 'Failed to Create Activity',
                description: error.message,
            });
            return false;
        }
    };

    return (
        <>
            <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-900/30">
                <header className="sticky top-0 z-10 w-full border-b dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm">
                    <div className="px-6 h-16 flex items-center justify-between max-w-7xl mx-auto w-full">
                        <h1 className="text-xl font-black text-slate-800 dark:text-neutral-200">
                          {selectedCollection 
                            ? selectedCollection.name 
                            : (language === 'de' ? 'Favoriten & Listen' : 'Favorites & Lists')}
                        </h1>
                        
                        {!selectedCollection && (
                          <div className="flex bg-slate-100 dark:bg-neutral-800 p-1 rounded-full text-xs font-black">
                            <button
                              onClick={() => setActiveTab('favorites')}
                              className={cn(
                                "px-4 py-2 rounded-full uppercase tracking-wider transition-all",
                                activeTab === 'favorites' 
                                  ? "bg-white dark:bg-neutral-700 shadow-md text-emerald-500" 
                                  : "text-slate-500"
                              )}
                            >
                              {language === 'de' ? 'Favoriten' : 'Favorites'}
                            </button>
                            <button
                              onClick={() => setActiveTab('collections')}
                              className={cn(
                                "px-4 py-2 rounded-full uppercase tracking-wider transition-all flex items-center gap-1.5",
                                activeTab === 'collections' 
                                  ? "bg-white dark:bg-neutral-700 shadow-md text-emerald-500" 
                                  : "text-slate-500"
                              )}
                            >
                              {language === 'de' ? 'Sammlungen' : 'Collections'}
                            </button>
                          </div>
                        )}

                        {selectedCollection && (
                          <Button
                            variant="ghost"
                            onClick={() => setSelectedCollectionId(null)}
                            className="rounded-full flex items-center gap-1 text-slate-500"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            {language === 'de' ? 'Zurück' : 'Back'}
                          </Button>
                        )}
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto pb-20">
                    <div className="max-w-7xl mx-auto w-full p-4 sm:p-6">
                        {/* 1. FAVORITES TAB */}
                        {activeTab === 'favorites' && !selectedCollectionId && (
                            favorites.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                                        <Bookmark className="h-10 w-10 text-primary" />
                                    </div>
                                    <h2 className="text-xl font-bold">{language === 'de' ? 'Noch keine Favoriten' : 'No Favorites Yet'}</h2>
                                    <p className="text-slate-400 dark:text-neutral-500 max-w-sm mt-1 text-sm font-semibold">
                                        {language === 'de' ? 'Tippe auf das Lesezeichen-Symbol bei einem Ort, um ihn für später zu speichern.' : 'Tap the bookmark icon on a place to save it for later.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {favorites.map(fav => (
                                        <PlaceCard
                                            key={fav.id}
                                            place={fav as Place}
                                            onClick={() => setSelectedPlace(fav as Place)}
                                            onAddActivity={() => handleOpenActivityModal(fav as Place)}
                                        />
                                    ))}
                                </div>
                            )
                        )}

                        {/* 2. COLLECTIONS LIST TAB */}
                        {activeTab === 'collections' && !selectedCollectionId && (
                            <div className="space-y-6">
                                {/* Creation Widget */}
                                <div className="bg-white dark:bg-neutral-800 p-5 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-sm max-w-xl">
                                  <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-neutral-200 mb-3">
                                    {language === 'de' ? 'Neue Sammlung erstellen' : 'Create New Collection'}
                                  </h3>
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder={language === 'de' ? 'Name der Sammlung...' : 'Collection Name...'}
                                      value={newColName}
                                      onChange={(e) => setNewColName(e.target.value)}
                                      className="rounded-full bg-slate-50 dark:bg-neutral-900 border-none font-bold text-xs h-11"
                                    />
                                    <Button 
                                      onClick={handleCreateCollection}
                                      className="rounded-full h-11 px-6 font-black uppercase text-xs"
                                    >
                                      <Plus className="h-4 w-4 mr-1.5" />
                                      {language === 'de' ? 'Erstellen' : 'Create'}
                                    </Button>
                                  </div>
                                  {!isPremium && (
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400 mt-4 px-1">
                                      <span>Limit kostenloser Account:</span>
                                      <span>{collections.length} / {maxCollections} Sammlungen</span>
                                    </div>
                                  )}
                                </div>

                                {/* Collections Grid */}
                                {collections.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="bg-emerald-500/10 p-4 rounded-full mb-4">
                                            <Folder className="h-10 w-10 text-emerald-500" />
                                        </div>
                                        <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-neutral-200">{language === 'de' ? 'Keine Sammlungen' : 'No Collections'}</h2>
                                        <p className="text-slate-400 dark:text-neutral-500 max-w-sm mt-1 text-xs font-bold uppercase tracking-wider">
                                            {language === 'de' ? 'Erstelle eine Sammlung, um Orte thematisch zu gruppieren.' : 'Create a collection to group places by theme.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {collections.map(col => (
                                            <div
                                              key={col.id}
                                              className="bg-white dark:bg-neutral-800 p-5 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative group overflow-hidden"
                                            >
                                              <button 
                                                onClick={() => setSelectedCollectionId(col.id)}
                                                className="flex items-start gap-4 text-left w-full cursor-pointer"
                                              >
                                                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                                                  <Folder className="h-6 w-6 text-emerald-500" />
                                                </div>
                                                <div>
                                                  <h4 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-neutral-200">
                                                    {col.name}
                                                  </h4>
                                                  <p className="text-xs font-bold text-slate-400 mt-1">
                                                    {col.places.length} {col.places.length === 1 ? 'Ort' : 'Orte'}
                                                  </p>
                                                </div>
                                              </button>

                                              <div className="flex justify-end mt-4 pt-4 border-t border-slate-50 dark:border-neutral-700/50">
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => deleteCollection(col.id)}
                                                  className="h-8 w-8 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. SELECTED COLLECTION DETAILS VIEW */}
                        {selectedCollection && (
                          <div className="space-y-6">
                            <div className="flex justify-between items-center bg-white dark:bg-neutral-800 p-4 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-sm">
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sammlung</p>
                                <h2 className="text-lg font-black uppercase text-slate-800 dark:text-neutral-200">{selectedCollection.name}</h2>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  deleteCollection(selectedCollection.id);
                                  setSelectedCollectionId(null);
                                }}
                                className="rounded-full font-black text-[10px] uppercase tracking-wider"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Sammlung Löschen
                              </Button>
                            </div>

                            {selectedCollection.places.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="bg-emerald-500/10 p-4 rounded-full mb-4">
                                  <FolderPlus className="h-10 w-10 text-emerald-500" />
                                </div>
                                <h3 className="font-black text-sm uppercase text-slate-700 dark:text-neutral-300">Diese Sammlung ist leer</h3>
                                <p className="text-slate-400 font-semibold text-xs mt-1">Füge Orte direkt vom Feed aus hinzu.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {selectedCollection.places.map(placeId => {
                                  const place = cachedDetails[placeId];
                                  const isLoading = loadingPlaces[placeId];

                                  if (isLoading) {
                                    return (
                                      <div key={placeId} className="h-72 bg-white dark:bg-neutral-800 rounded-3xl animate-pulse flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                      </div>
                                    );
                                  }

                                  if (!place) return null;

                                  return (
                                    <div key={placeId} className="relative group">
                                      <PlaceCard
                                        place={place}
                                        onClick={() => setSelectedPlace(place)}
                                        onAddActivity={() => handleOpenActivityModal(place)}
                                      />
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => removePlaceFromCollection(selectedCollection.id, placeId)}
                                        className="absolute top-3 right-3 h-8 w-8 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                </main>
            </div>

            <CreateActivityDialog
                place={activityModalPlace}
                open={!!activityModalPlace}
                onOpenChange={(open) => !open && setActivityModalPlace(null)}
                onCreateActivity={handleCreateActivity}
            />

            <Dialog open={!!selectedPlace} onOpenChange={(open) => !open && setSelectedPlace(null)}>
                <DialogContent className="max-h-[95vh] flex flex-col p-0 w-full max-w-4xl gap-0 overflow-hidden">
                    <DialogTitle className="sr-only">{selectedPlace?.name || 'Ort Details'}</DialogTitle>
                    <DialogDescription className="sr-only">Favorisierter Ort Details</DialogDescription>
                    {selectedPlace && (
                        <PlaceDetails 
                            place={selectedPlace} 
                            onClose={() => setSelectedPlace(null)} 
                            onCreateActivity={() => {
                                handleOpenActivityModal(selectedPlace);
                                setSelectedPlace(null);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <PremiumUpgradeModal 
              isOpen={isUpsellOpen} 
              onClose={() => setIsUpsellOpen(false)} 
            />
        </>
    );
}
