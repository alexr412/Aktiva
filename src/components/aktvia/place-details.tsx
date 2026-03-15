'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { joinActivity, voteActivity } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
import { formatTags } from '@/lib/tag-parser';

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
    const [isVoting, setIsVoting] = useState(false);
    
    const { addFavorite, removeFavorite, checkIsFavorite } = useFavorites();
    const isFavorite = checkIsFavorite(place.id);

    const handleBookmarkToggle = () => {
        if (isFavorite) {
            removeFavorite(place.id);
        } else {
            addFavorite(place);
        }
    };

    useEffect(() => {
        if (!db || !place.id) return;
        setLoadingActivities(true);
        
        // --- DIAGNOSE OUTPUT FÜR ID-MISMATCH PRÜFUNG ---
        console.log("EXECUTE QUERY FOR PLACE ID:", place.id);
        
        // --- QUERY: REINE RELATION OHNE ZEITLICHE FILTERUNG ---
        const activitiesQuery = query(
            collection(db, 'activities'), 
            where('placeId', '==', place.id)
        );

        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            // --- ROHE STATE-ZUWEISUNG OHNE MODIFIKATION ---
            const fetchedActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setActivities(fetchedActivities);
            setLoadingActivities(false);
        }, (error) => {
            // --- ERROR LOGGING FÜR ENTWICKLER-DIAGNOSE (INDEX CHECK) ---
            console.error("🔥 FIRESTORE QUERY ERROR (PlaceDetails):", error.message, {
                placeId: place.id,
                path: 'activities'
            });
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

    const handleVote = async (activityId: string, type: 'up' | 'down' | 'none') => {
        if (!user || isVoting) return;
        setIsVoting(true);
        try { await voteActivity(activityId, user.uid, type); } catch (error) { console.error("Voting failed:", error); } finally { setIsVoting(false); }
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
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mb-6 font-medium">{place.address}</p>
                        
                        <div className="w-full flex flex-col gap-3">
                            <Button variant="outline" className="w-full h-12 rounded-xl font-bold dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={handleBookmarkToggle}>
                                <Bookmark className={cn("h-5 w-5", isFavorite && "fill-primary text-primary")} />
                                <span>{isFavorite ? 'Gespeichert' : 'Speichern'}</span>
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-8">
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4 bg-neutral-50 dark:bg-neutral-800 border-none text-center shadow-none">
                                {place.rating ? (
                                    <>
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                                            <span className="font-black text-xl dark:text-neutral-200">{place.rating.toFixed(1)}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Rating</span>
                                    </>
                                ) : (
                                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">No Rating</span>
                                )}
                            </Card>
                            <Card className="p-4 bg-neutral-50 dark:bg-neutral-800 border-none text-center shadow-none">
                                <div className="flex flex-wrap gap-1 justify-center">
                                    {processedTags.map((tag, index) => (
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
                                    const userVote = user ? (activity.userVotes?.[user.uid] || 'none') : 'none';
                                    const isPaidEvent = activity.isPaid && activity.price && activity.price > 0;

                                    return (
                                        <Card key={activity.id} className="p-4 bg-neutral-50 dark:bg-neutral-800 border-none rounded-2xl">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-extrabold dark:text-neutral-200 text-base truncate">{format(activity.activityDate.toDate(), 'eee, MMM d')}</p>
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
                                            <div className="flex gap-2 items-center pt-3 border-t border-neutral-200/50 dark:border-neutral-700/50 mt-3">
                                                <button onClick={() => handleVote(activity.id!, userVote === 'up' ? 'none' : 'up')} className="dark:text-neutral-200" style={{ padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: '800', background: userVote === 'up' ? '#22c55e' : 'inherit', cursor: 'pointer' }}>↑</button>
                                                <button onClick={() => handleVote(activity.id!, userVote === 'down' ? 'none' : 'down')} className="dark:text-neutral-200" style={{ padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: '800', background: userVote === 'down' ? '#ef4444' : 'inherit', cursor: 'pointer' }}>↓</button>
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