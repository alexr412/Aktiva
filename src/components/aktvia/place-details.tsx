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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Place, Activity } from '@/lib/types';
import { AiRecommendation } from './ai-recommendation';

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
        <div className="flex flex-col h-full relative bg-background">
            <div className="absolute top-0 left-0 z-20 flex items-center p-2">
                <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-background/60 hover:bg-background/90 backdrop-blur-sm">
                    <ChevronLeft className="h-6 w-6" />
                    <span className="sr-only">Back</span>
                </Button>
            </div>
            <ScrollArea className="flex-1">
                <div className="relative flex items-center justify-center h-48 w-full bg-muted/30">
                     <Icon className="h-20 w-20 text-muted-foreground/80" />
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <h1 className="text-3xl font-bold">{place.name}</h1>
                         <div className="flex flex-col gap-1 mt-2">
                            <p className="text-sm text-muted-foreground">{place.address}</p>
                            {place.distance !== undefined && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                                    <Navigation className="h-4 w-4"/>
                                    <span>{formatDistance(place.distance)} entfernt</span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-center">
                        {place.rating ? (
                             <div className="p-4 rounded-xl bg-muted/80 flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center gap-2">
                                    <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
                                    <span className="font-bold text-2xl">{place.rating.toFixed(1)}</span>
                                </div>
                                <span className="text-sm text-muted-foreground">Rating</span>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-muted/80 flex flex-col items-center justify-center gap-1">
                                <Star className="h-6 w-6 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground mt-2">No Rating</span>
                            </div>
                        )}
                         <div className="p-4 rounded-xl bg-muted/80 flex flex-col items-center justify-center gap-2">
                            <div className="flex flex-wrap gap-2 justify-center">
                                {formattedCategories.slice(0, 2).map(cat => (
                                    <Badge key={cat} variant="secondary" className="capitalize">{cat.replace(/_/g, ' ')}</Badge>
                                ))}
                            </div>
                            <span className="text-sm text-muted-foreground">Categories</span>
                        </div>
                    </div>
                    
                    <Separator />

                    <div className="space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            <span>Upcoming Activities</span>
                        </h2>
                        {loadingActivities && (
                            <div className="space-y-3">
                                <Skeleton className="h-16 w-full rounded-lg" />
                                <Skeleton className="h-16 w-full rounded-lg" />
                            </div>
                        )}
                        {!loadingActivities && placeActivities.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                No activities scheduled here yet.
                            </p>
                        )}
                        <div className="space-y-3">
                            {placeActivities.map(activity => {
                                if (!activity.id) return null;
                                const isParticipant = activity.participantIds.includes(user?.uid || '---');
                                const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;
                                
                                return (
                                    <Card key={activity.id} className="p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-base">
                                                    {renderActivityDate(activity)}
                                                </p>
                                                <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5 mt-1">
                                                    <Users className="h-4 w-4" />
                                                    <span>
                                                        {activity.participantIds.length} / {activity.maxParticipants || '∞'} &bull; von {activity.creatorName}
                                                    </span>
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {isParticipant ? (
                                                    <Button size="sm" variant="outline" onClick={() => router.push(`/chat/${activity.id}`)}>
                                                        <MessageSquare className="mr-2 h-4 w-4" />
                                                        Chat
                                                    </Button>
                                                ) : isFull ? (
                                                    <Button size="sm" variant="secondary" disabled>
                                                        Voll
                                                    </Button>
                                                ) : (
                                                    <Button 
                                                        size="sm"
                                                        onClick={() => handleJoin(activity.id!)} 
                                                        disabled={joiningActivityId === activity.id}
                                                        className="w-28"
                                                    >
                                                        {joiningActivityId === activity.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <LogIn className="mr-2 h-4 w-4" />
                                                                Teilnehmen
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
                    </div>


                    <Separator />

                    <AiRecommendation place={place} />
                </div>
            </ScrollArea>
        </div>
    );
}
