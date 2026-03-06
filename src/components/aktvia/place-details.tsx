import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { joinActivity } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';

import {
    Star,
    ChevronLeft,
    UtensilsCrossed,
    Coffee,
    TreePine,
    ShoppingBag,
    Bed,
    Landmark,
    Film,
    Building,
    type LucideIcon,
    Users,
    LogIn,
    Loader2,
    MessageSquare,
    Navigation,
    Bookmark,
    Calendar,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Place, Activity } from '@/lib/types';
import { AiRecommendation } from './ai-recommendation';
import { useFavorites } from '@/contexts/favorites-context';
import { cn } from '@/lib/utils';

const categoryIconMap: { [key: string]: LucideIcon } = {
  'catering.restaurant': UtensilsCrossed,
  'catering.cafe': Coffee,
  'leisure.park': TreePine,
  'tourism.attraction': Landmark,
  'commercial': ShoppingBag,
  'entertainment.cinema': Film,
  'accommodation.hotel': Bed,
};

const getCategoryIcon = (categories: string[]): LucideIcon => {
  for (const category of categories) {
    if (categoryIconMap[category]) {
      return categoryIconMap[category];
    }
    const parentCategory = category.split('.')[0];
    if (categoryIconMap[parentCategory]) {
      return categoryIconMap[parentCategory];
    }
  }
  return Building; // Default icon
};

type PlaceDetailsProps = {
    place: Place;
    onClose: () => void;
};

export function PlaceDetails({ place, onClose }: PlaceDetailsProps) {
    const Icon = getCategoryIcon(place.categories);
    const formattedCategories = place.categories
        .map(cat => cat.split('.')[0])
        .filter((value, index, self) => self.indexOf(value) === index);

    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [joiningActivityId, setJoiningActivityId] = useState<string|null>(null);
    
    const { addFavorite, removeFavorite, checkIsFavorite } = useFavorites();
    const isFavorite = checkIsFavorite(place.id);

    const handleBookmarkToggle = () => {
        if (isFavorite) {
            removeFavorite(place.id);
        } else {
            addFavorite(place);
        }
    };

    const formatDistance = (distanceInMeters?: number) => {
        if (distanceInMeters === undefined) {
            return null;
        }
        if (distanceInMeters < 1000) {
            return `${Math.round(distanceInMeters)} m`;
        }
        return `${(distanceInMeters / 1000).toFixed(1)} km`;
    };

    useEffect(() => {
        if (!db || !place.id) return;

        setLoadingActivities(true);
        const activitiesQuery = query(
            collection(db, 'activities'),
            where('placeId', '==', place.id)
        );

        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            const fetchedActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            fetchedActivities.sort((a, b) => a.activityDate.toMillis() - b.activityDate.toMillis());
            setActivities(fetchedActivities);
            setLoadingActivities(false);
        }, (error) => {
            console.error("Error fetching activities: ", error);
            toast({ title: "Error", description: "Could not load activities for this place.", variant: 'destructive'});
            setLoadingActivities(false);
        });

        return () => unsubscribe();
    }, [place.id, toast]);

    const handleJoin = async (activityId: string) => {
        if (!user) {
            toast({ title: 'Login Required', description: 'You must be logged in to join an activity.' });
            router.push('/login');
            return;
        }
        setJoiningActivityId(activityId);
        try {
            await joinActivity(activityId, user);
            toast({ title: 'Success!', description: 'You have joined the activity.' });
        } catch (error: any) {
            console.error(error);
            toast({ title: 'Error', description: error.message || 'Failed to join activity.', variant: 'destructive' });
        } finally {
            setJoiningActivityId(null);
        }
    };
    
    const renderActivityDate = (activity: Activity) => {
        if (activity.activityEndDate) {
            return `${format(activity.activityDate.toDate(), 'eee, MMM d')} - ${format(activity.activityEndDate.toDate(), 'MMM d')}`;
        }
        if (activity.isTimeFlexible) {
            return `${format(activity.activityDate.toDate(), 'eee, MMM d')} (Flexible Time)`;
        }
        return `${format(activity.activityDate.toDate(), 'eee, MMM d')} at ${format(activity.activityDate.toDate(), 'p')}`;
    };

    const placeActivities = activities.filter(act => act.placeId === place.id);

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            {/* Header / Schließen-Button Mobile */}
            <div className="absolute top-4 left-4 z-20 md:hidden">
                <Button variant="secondary" size="icon" onClick={onClose} className="rounded-full shadow-lg bg-background/80 backdrop-blur-sm">
                    <ChevronLeft className="h-6 w-6" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col md:grid md:grid-cols-[1fr_2fr] gap-8 p-6 md:p-10">
                    
                    {/* Linke Spalte: Meta-Daten & Header */}
                    <div className="flex flex-col items-center border-b md:border-b-0 md:border-r border-border pb-8 md:pb-0 md:pr-10">
                        <div className="w-24 h-24 md:w-32 md:h-32 bg-secondary rounded-full flex items-center justify-center mb-6 ring-4 ring-primary/5">
                            <Icon className="h-12 w-12 md:h-16 md:w-16 text-primary/70" />
                        </div>
                        
                        <h1 className="text-2xl md:text-3xl font-extrabold text-center mb-2 tracking-tight">
                            {place.name}
                        </h1>
                        
                        <p className="text-sm text-muted-foreground text-center mb-4 leading-relaxed max-w-[200px]">
                            {place.address}
                        </p>

                        {place.distance !== undefined && (
                            <div className="flex items-center gap-1.5 text-sm font-semibold text-primary mb-6">
                                <Navigation className="h-4 w-4"/>
                                <span>{formatDistance(place.distance)} entfernt</span>
                            </div>
                        )}
                        
                        <Button 
                            variant="outline" 
                            className="w-full h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-secondary transition-all"
                            onClick={handleBookmarkToggle}
                        >
                            <Bookmark className={cn("h-5 w-5 transition-colors", isFavorite && "fill-primary text-primary")} />
                            <span className="font-semibold">{isFavorite ? 'Gespeichert' : 'Speichern'}</span>
                        </Button>
                    </div>

                    {/* Rechte Spalte: Daten-Module & Listen */}
                    <div className="flex flex-col gap-8">
                        
                        {/* Info-Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4 bg-secondary/30 border-none flex flex-col items-center justify-center gap-1 text-center">
                                {place.rating ? (
                                    <>
                                        <div className="flex items-center gap-1.5">
                                            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                                            <span className="font-bold text-xl">{place.rating.toFixed(1)}</span>
                                        </div>
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rating</span>
                                    </>
                                ) : (
                                    <span className="text-sm font-semibold text-muted-foreground">No Rating</span>
                                )}
                            </Card>
                            
                            <Card className="p-4 bg-secondary/30 border-none flex flex-col items-center justify-center gap-1 text-center">
                                <div className="flex flex-wrap gap-1 justify-center">
                                    {formattedCategories.slice(0, 2).map(cat => (
                                        <Badge key={cat} variant="outline" className="bg-background/50 capitalize text-[10px]">
                                            {cat.replace(/_/g, ' ')}
                                        </Badge>
                                    ))}
                                </div>
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-1">Categories</span>
                            </Card>
                        </div>

                        <Separator className="opacity-50" />

                        {/* Activities-Modul */}
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" />
                                <span>Upcoming Activities</span>
                            </h2>
                            
                            {loadingActivities ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-20 w-full rounded-xl" />
                                    <Skeleton className="h-20 w-full rounded-xl" />
                                </div>
                            ) : placeActivities.length === 0 ? (
                                <div className="p-10 border border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-center">
                                    <Calendar className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                    <p className="text-sm text-muted-foreground">No activities scheduled here yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {placeActivities.map(activity => {
                                        if (!activity.id) return null;
                                        const isParticipant = activity.participantIds.includes(user?.uid || '---');
                                        const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;
                                        
                                        return (
                                            <Card key={activity.id} className="p-4 shadow-sm hover:shadow-md transition-shadow border-muted">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-base truncate">
                                                            {renderActivityDate(activity)}
                                                        </p>
                                                        <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                                                            <Users className="h-4 w-4" />
                                                            <span className="truncate">
                                                                {activity.participantIds.length} / {activity.maxParticipants || '∞'} &bull; {activity.creatorName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {isParticipant ? (
                                                            <Button size="sm" variant="secondary" onClick={() => router.push(`/chat/${activity.id}`)} className="rounded-lg h-9">
                                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                                Chat
                                                            </Button>
                                                        ) : isFull ? (
                                                            <Button size="sm" variant="outline" disabled className="rounded-lg h-9 opacity-50">
                                                                Voll
                                                            </Button>
                                                        ) : (
                                                            <Button 
                                                                size="sm"
                                                                onClick={() => handleJoin(activity.id!)} 
                                                                disabled={joiningActivityId === activity.id}
                                                                className="w-28 rounded-lg h-9 font-semibold"
                                                            >
                                                                {joiningActivityId === activity.id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <LogIn className="mr-2 h-4 w-4" />
                                                                        Beitreten
                                                                    </>
                                                                )}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <Separator className="opacity-50" />

                        {/* AI Recommendation Modul */}
                        <div className="rounded-2xl overflow-hidden shadow-inner">
                            <AiRecommendation place={place} />
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
