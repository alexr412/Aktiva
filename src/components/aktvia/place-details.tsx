'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { joinActivity, voteActivity } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { format } from 'date-fns';

import {
    Star,
    ChevronLeft,
    Users,
    Loader2,
    MessageSquare,
    Navigation,
    Bookmark,
    Calendar,
    ExternalLink,
    CreditCard,
    Share2,
    Clock,
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
import { getPrimaryIconData } from '@/lib/tag-config';
import { formatTags, formatOpeningHours } from '@/lib/tag-parser';

type PlaceDetailsProps = {
    place: Place;
    onClose: () => void;
};

export function PlaceDetails({ place, onClose }: PlaceDetailsProps) {
    const primaryStyle = getPrimaryIconData(place);
    const PrimaryIcon = primaryStyle.icon;
    
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [joiningActivityId, setJoiningActivityId] = useState<string|null>(null);
    
    const [placeMeta, setPlaceMeta] = useState({ avgRating: 0, reviewCount: 0 });
    const [loadingMeta, setLoadingMeta] = useState(true);
    
    const { addFavorite, removeFavorite, checkIsFavorite } = useFavorites();
    const isFavorite = checkIsFavorite(place.id);

    const handleBookmarkToggle = () => {
        if (isFavorite) {
            removeFavorite(place.id);
        } else {
            addFavorite(place);
        }
    };

    // Metadata Listener für persistente Orts-Reputation
    useEffect(() => {
        if (!db || !place.id) return;
        const unsub = onSnapshot(doc(db, 'places', place.id), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPlaceMeta({
                    avgRating: data.avgRating || 0,
                    reviewCount: data.reviewCount || 0
                });
            }
            setLoadingMeta(false);
        });
        return () => unsub();
    }, [place.id]);

    useEffect(() => {
        if (!db || !place.id) return;
        setLoadingActivities(true);
        
        const activitiesQuery = query(
            collection(db, 'activities'), 
            where('placeId', '==', place.id)
        );

        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            const fetchedActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setActivities(fetchedActivities);
            setLoadingActivities(false);
        }, (error) => {
            console.error("🔥 FIRESTORE QUERY ERROR (PlaceDetails):", error.message);
            setLoadingActivities(false);
        });

        return () => unsubscribe();
    }, [place.id]);

    const handleJoin = async (activity: Activity) => {
        if (!user) { 
            router.push('/login'); 
            return; 
        }

        if (activity.isPaid && activity.price && activity.price > 0) {
            router.push(`/checkout/${activity.id}`);
            return;
        }

        setJoiningActivityId(activity.id!);
        try {
            await joinActivity(activity.id!, user);
            toast({ title: 'Erfolgreich beigetreten!' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Fehler', description: error.message });
        } finally { 
            setJoiningActivityId(null); 
        }
    };

    const handleShareActivity = async (activity: Activity) => {
        const shareUrl = `${window.location.origin}/activities/${activity.id}?ref=${user?.uid || 'guest'}`;
        const shareData = {
            title: `Aktivität bei ${activity.placeName}`,
            text: `Schau dir diese Aktivität bei "${activity.placeName}" auf Aktvia an! Sei dabei!`,
            url: shareUrl,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.error("Fehler beim Teilen", error);
            }
        } else {
            navigator.clipboard.writeText(shareUrl);
            toast({ title: "Link kopiert", description: "Der Link wurde in die Zwischenablage kopiert." });
        }
    };

    const processedTags = formatTags(place.categories || []);

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden dark:bg-neutral-900">
            <div className="absolute top-4 left-4 z-20 md:hidden">
                <Button variant="secondary" size="icon" onClick={onClose} className="rounded-full bg-background/80 backdrop-blur-sm">
                    <ChevronLeft className="h-6 w-6" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col md:grid md:grid-cols-[1fr_2fr] gap-8 p-6 md:p-10">
                    <div className="flex flex-col items-center border-b md:border-b-0 md:border-r border-border pb-8 md:pb-0 md:pr-10 dark:border-neutral-800">
                        <div className={cn("w-24 h-24 md:w-32 md:h-32 rounded-3xl flex items-center justify-center mb-6", primaryStyle.bgClass, "dark:bg-neutral-800")}>
                            <PrimaryIcon className="h-12 w-12 md:h-16 md:w-16" style={{ color: primaryStyle.color }} />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-[#0f172a] dark:text-neutral-200 text-center mb-2">{place.name}</h1>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center font-medium">{place.address}</p>
                        
                        {place.openingHours && (
                          <div className="flex items-start justify-center gap-2 text-sm text-muted-foreground mt-3 mb-6">
                            <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                            <span className="text-center leading-snug">
                              {formatOpeningHours(place.openingHours)}
                            </span>
                          </div>
                        )}

                        <div className="w-full flex flex-col gap-3">
                            <Button variant="outline" className="w-full h-12 rounded-xl font-bold dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={handleBookmarkToggle}>
                                <Bookmark className={cn("h-5 w-5", isFavorite && "fill-primary text-primary")} />
                                <span>{isFavorite ? 'Gespeichert' : 'Speichern'}</span>
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-8">
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4 bg-neutral-50 dark:bg-neutral-800 border-none text-center shadow-none flex flex-col items-center justify-center">
                                {/* MODUL 18: Persistentes Orts-Rating */}
                                <div className="flex items-center justify-center gap-1.5">
                                    <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                                    {!loadingMeta && placeMeta.reviewCount > 0 ? (
                                        <span className="font-black text-xl dark:text-neutral-200">
                                            {placeMeta.avgRating.toFixed(1)} <span className="text-[10px] opacity-50">({placeMeta.reviewCount})</span>
                                        </span>
                                    ) : (
                                        <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Neu</span>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mt-1">Community Rating</span>
                            </Card>
                            <Card className="p-4 bg-neutral-50 dark:bg-neutral-800 border-none text-center shadow-none">
                                <div className="flex flex-wrap gap-1 justify-center">
                                    {processedTags.slice(0, 3).map((tag, index) => (
                                        <Badge key={index} variant="outline" className="bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[9px] font-bold border-none">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                                <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mt-1">Kategorien</span>
                            </Card>
                        </div>

                        <Separator className="opacity-50 dark:border-neutral-800" />

                        <div className="flex flex-col">
                            <h2 className="text-xl font-black dark:text-neutral-200 mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5 text-primary" />
                                    <span>Aktivitäten vor Ort</span>
                                </div>
                            </h2>
                            <div className="space-y-3">
                                {loadingActivities ? <Skeleton className="h-20 w-full rounded-2xl" /> : activities.length === 0 ? <p className="text-sm text-neutral-500">Keine Treffen geplant.</p> : activities.map(activity => {
                                    const isParticipant = activity.participantIds.includes(user?.uid || '---');
                                    const isPaidEvent = activity.isPaid && activity.price && activity.price > 0;
                                    
                                    const actRating = activity.avgRating || 0;
                                    const actReviewCount = activity.reviewCount || 0;

                                    return (
                                        <Card key={activity.id} className="p-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-extrabold dark:text-neutral-200 text-base truncate">{format(activity.activityDate.toDate(), 'eee, MMM d')}</p>
                                                        
                                                        <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                                                          <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                                                          {actReviewCount > 0 ? (
                                                            <span className="text-[10px] font-black text-amber-700 dark:text-amber-400">
                                                              {actRating.toFixed(1)} <span className="opacity-50">({actReviewCount})</span>
                                                            </span>
                                                          ) : (
                                                            <span className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-500">Neu</span>
                                                          )}
                                                        </div>

                                                        {isPaidEvent && (
                                                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0 border-none">
                                                                €{activity.price!.toFixed(2)}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">{activity.participantIds.length} Teilnehmer</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleShareActivity(activity)} className="rounded-full text-slate-400 hover:text-primary">
                                                        <Share2 className="h-4 w-4" />
                                                    </Button>
                                                    {isParticipant ? (
                                                        <Button size="sm" variant="secondary" onClick={() => router.push(`/chat/${activity.id}`)} className="rounded-xl font-bold">Chat</Button>
                                                    ) : (
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => handleJoin(activity)} 
                                                            disabled={joiningActivityId === activity.id}
                                                            className={cn(
                                                                "w-24 sm:w-32 rounded-xl font-black",
                                                                isPaidEvent ? "bg-slate-900 text-white" : ""
                                                            )}
                                                        >
                                                            {joiningActivityId === activity.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : isPaidEvent ? (
                                                                `Beitreten`
                                                            ) : (
                                                                'Beitreten'
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
                        <AiRecommendation place={place} />
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
