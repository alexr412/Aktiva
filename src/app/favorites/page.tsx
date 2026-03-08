'use client';

import { useState } from 'react';
import { useFavorites } from '@/contexts/favorites-context';
import { PlaceCard } from '@/components/aktvia/place-card';
import type { Place } from '@/lib/types';
import { Bookmark } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { createActivity } from '@/lib/firebase/firestore';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';


const EmptyState = () => (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center h-full">
        <div className="bg-primary/10 p-4 rounded-full">
            <Bookmark className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">No Favorites Yet</h2>
        <p className="text-muted-foreground">
            Tap the bookmark icon on a place to save it for later.
        </p>
    </div>
);


export default function FavoritesPage() {
    const { favorites } = useFavorites();
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [activityModalPlace, setActivityModalPlace] = useState<Place | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

    const handleOpenActivityModal = (place: Place) => {
        if (!user) {
            router.push('/login');
            toast({
                title: 'Login Required',
                description: 'Please log in to create an activity.',
            });
            return;
        }
        setActivityModalPlace(place);
    };

    const handleCreateActivity = async (startDate: Date, endDate: Date | undefined, isTimeFlexible: boolean, customLocationName?: string, maxParticipants?: number): Promise<boolean> => {
        if (!user || !activityModalPlace) {
            toast({
                title: 'Error',
                description: 'You must be logged in to create an activity.',
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
            });
            toast({
                title: 'Activity Created!',
                description: `Your activity at ${activityModalPlace.name} is set.`,
            });
            setActivityModalPlace(null);
            router.push(`/chat/${newActivityRef.id}`);
            return true;
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Failed to Create Activity',
                description: error.message,
            });
            return false;
        }
    };

    const handlePlaceSelect = (place: Place) => {
        setSelectedPlace(place);
    };

    return (
        <>
            <div className="flex flex-col h-full bg-secondary/30">
                <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm">
                    <div className="px-4 h-16 flex items-center max-w-7xl mx-auto w-full">
                        <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto pb-20">
                    <div className="max-w-7xl mx-auto w-full">
                        {favorites.length === 0 ? (
                            <EmptyState />
                        ) : (
                            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {favorites.map(fav => (
                                    <PlaceCard
                                        key={fav.id}
                                        place={fav as Place} // Cast FavoritePlace to Place for the card
                                        onClick={() => handlePlaceSelect(fav as Place)}
                                        onAddActivity={() => handleOpenActivityModal(fav as Place)}
                                    />
                                ))}
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
                    {selectedPlace && <PlaceDetails place={selectedPlace} onClose={() => setSelectedPlace(null)} />}
                </DialogContent>
            </Dialog>
        </>
    );
}
