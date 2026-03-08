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
    LogIn,
    Loader2,
    MessageSquare,
    Navigation,
    Bookmark,
    Calendar,
    ExternalLink,
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
import { getPrimaryTagStyle, getTagStyle } from '@/lib/tag-config';

type PlaceDetailsProps = {
    place: Place;
    onClose: () => void;
};

export function PlaceDetails({ place, onClose }: PlaceDetailsProps) {
    const primaryStyle = getPrimaryTagStyle(place.categories);
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

    const formatDistance = (distanceInMeters?: number) => {
        if (distanceInMeters === undefined) return null;
        if (distanceInMeters < 1000) return `${Math.round(distanceInMeters)} m`;
        return `${(distanceInMeters / 1000).toFixed(1)} km`;
    };

    useEffect(() => {
        if (!db || !place.id) return;
        setLoadingActivities(true);
        const activitiesQuery = query(collection(db, 'activities'), where('placeId', '==', place.id));
        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            const fetchedActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            fetchedActivities.sort((a, b) => a.activityDate.toMillis() - b.activityDate.toMillis());
            setActivities(fetchedActivities);
            setLoadingActivities(false);
        }, (error) => {
            console.error("Error fetching activities: ", error);
            setLoadingActivities(false);
        });
        return () => unsubscribe();
    }, [place.id]);

    const handleJoin = async (activityId: string) => {
        if (!user) { router.push('/login'); return; }
        setJoiningActivityId(activityId);
        try {
            await joinActivity(activityId, user);
            toast({ title: 'Success!', description: 'You have joined the activity.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally { setJoiningActivityId(null); }
    };

    const handleVote = async (activityId: string, type: 'up' | 'down' | 'none') => {
        if (!user || isVoting) return;
        setIsVoting(true);
        try { await voteActivity(activityId, user.uid, type); } catch (error) { console.error("Voting failed:", error); } finally { setIsVoting(false); }
    };
    
    const renderActivityDate = (activity: Activity) => {
        if (activity.activityEndDate) return `${format(activity.activityDate.toDate(), 'eee, MMM d')} - ${format(activity.activityEndDate.toDate(), 'MMM d')}`;
        if (activity.isTimeFlexible) return `${format(activity.activityDate.toDate(), 'eee, MMM d')} (Flexible Time)`;
        return `${format(activity.activityDate.toDate(), 'eee, MMM d')} at ${format(activity.activityDate.toDate(), 'p')}`;
    };

    const placeActivities = activities.filter(act => act.placeId === place.id);

    return (
        <div className="flex flex-col h-full bg-background relative overflow-hidden">
            <div className="absolute top-4 left-4 z-20 md:hidden">
                <Button variant="secondary" size="icon" onClick={onClose} className="rounded-full shadow-lg bg-background/80 backdrop-blur-sm">
                    <ChevronLeft className="h-6 w-6" />
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col md:grid md:grid-cols-[1fr_2fr] gap-8 p-6 md:p-10">
                    
                    <div className="flex flex-col items-center border-b md:border-b-0 md:border-r border-border pb-8 md:pb-0 md:pr-10">
                        <div 
                          className="w-24 h-24 md:w-32 md:h-32 rounded-3xl flex items-center justify-center mb-6 shadow-sm"
                          style={{ backgroundColor: `${primaryStyle.color}15` }}
                        >
                            <PrimaryIcon className="h-12 w-12 md:h-16 md:w-16" style={{ color: primaryStyle.color }} />
                        </div>
                        
                        <h1 className="text-2xl md:text-3xl font-black text-[#0f172a] text-center mb-2 tracking-tight">
                            {place.name}
                        </h1>
                        
                        <p className="text-sm text-[#64748b] text-center mb-4 leading-relaxed max-w-[200px] font-medium">
                            {place.address}
                        </p>

                        {place.distance !== undefined && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-6 uppercase tracking-wider">
                                <Navigation className="h-4 w-4"/>
                                <span>{formatDistance(place.distance)} entfernt</span>
                            </div>
                        )}
                        
                        <div className="w-full flex flex-col gap-3">
                            <Button 
                                variant="outline" 
                                className="w-full h-12 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-all font-bold"
                                onClick={handleBookmarkToggle}
                            >
                                <Bookmark className={cn("h-5 w-5", isFavorite && "fill-primary text-primary")} />
                                <span>{isFavorite ? 'Gespeichert' : 'Speichern'}</span>
                            </Button>

                            {place.affiliateUrl && (
                                <Button 
                                    className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black flex items-center justify-center gap-2 transition-all shadow-md"
                                    onClick={() => window.open(place.affiliateUrl, '_blank')}
                                >
                                    <ExternalLink className="h-5 w-5" />
                                    <span>JETZT BUCHEN</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-8">
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="p-4 bg-slate-50 border-none flex flex-col items-center justify-center gap-1 text-center shadow-none">
                                {place.rating ? (
                                    <>
                                        <div className="flex items-center gap-1.5">
                                            <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                                            <span className="font-black text-xl text-[#0f172a]">{place.rating.toFixed(1)}</span>
                                        </div>
                                        <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">Rating</span>
                                    </>
                                ) : (
                                    <span className="text-xs font-bold text-[#64748b] uppercase tracking-widest">No Rating</span>
                                )}
                            </Card>
                            
                            <Card className="p-4 bg-slate-50 border-none flex flex-col items-center justify-center gap-1 text-center shadow-none">
                                <div className="flex flex-wrap gap-1 justify-center">
                                    {place.categories && place.categories.map(cat => {
                                        const style = getTagStyle(cat);
                                        if (style.label === 'Ort' && cat.includes('.')) return null;
                                        return (
                                            <Badge key={cat} variant="outline" className="bg-white/80 text-[9px] font-bold border-none shadow-sm" style={{ color: style.color }}>
                                                {style.label}
                                            </Badge>
                                        );
                                    })}
                                </div>
                                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest mt-1">Kategorien</span>
                            </Card>
                        </div>

                        <Separator className="opacity-50" />

                        <div className="flex flex-col">
                            <h2 className="text-xl font-black text-[#0f172a] mb-4 flex items-center gap-2 tracking-tight">
                                <Users className="h-5 w-5 text-primary" />
                                <span>Aktivitäten vor Ort</span>
                            </h2>
                            
                            {loadingActivities ? (
                                <div className="space-y-3">
                                    <Skeleton className="h-20 w-full rounded-2xl" />
                                </div>
                            ) : placeActivities.length === 0 ? (
                                <div className="p-10 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center">
                                    <Calendar className="h-8 w-8 text-slate-300 mb-2" />
                                    <p className="text-sm font-medium text-[#64748b]">Noch keine Treffen geplant.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {placeActivities.map(activity => {
                                        if (!activity.id) return null;
                                        const isParticipant = activity.participantIds.includes(user?.uid || '---');
                                        const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;
                                        const userVote = user ? (activity.userVotes?.[user.uid] || 'none') : 'none';
                                        
                                        return (
                                            <Card key={activity.id} className={cn(
                                              "p-4 shadow-sm border-none bg-slate-50 flex flex-col gap-3 rounded-2xl",
                                              activity.isBoosted && "ring-1 ring-orange-500/20 bg-orange-50/30"
                                            )}>
                                                <div className="flex items-center justify-between gap-4">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-extrabold text-[#0f172a] text-base truncate">
                                                            {renderActivityDate(activity)}
                                                        </p>
                                                        <div className="text-xs font-bold text-[#64748b] flex items-center gap-1.5 mt-1">
                                                            <Users className="h-3.5 w-3.5" />
                                                            <span className="truncate">
                                                                {activity.participantIds.length} / {activity.maxParticipants || '∞'} &bull; {activity.creatorName}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0 flex gap-2">
                                                        {isParticipant ? (
                                                            <Button size="sm" variant="secondary" onClick={() => router.push(`/chat/${activity.id}`)} className="rounded-xl h-9 font-bold">
                                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                                Chat
                                                            </Button>
                                                        ) : isFull ? (
                                                            <Button size="sm" variant="outline" disabled className="rounded-xl h-9 opacity-50 font-bold">Voll</Button>
                                                        ) : (
                                                            <Button 
                                                                size="sm"
                                                                onClick={() => handleJoin(activity.id!)} 
                                                                disabled={joiningActivityId === activity.id}
                                                                className={cn(
                                                                  "w-28 rounded-xl h-9 font-bold",
                                                                  activity.isBoosted && "bg-orange-500 hover:bg-orange-600"
                                                                )}
                                                            >
                                                                {joiningActivityId === activity.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Beitreten'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="voting-controls flex gap-2 items-center pt-3 border-t border-slate-200/50">
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); handleVote(activity.id!, userVote === 'up' ? 'none' : 'up'); }} 
                                                    style={{ padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: '800', background: userVote === 'up' ? '#22c55e' : '#ffffff', color: userVote === 'up' ? '#ffffff' : '#0f172a', borderColor: userVote === 'up' ? '#22c55e' : '#e2e8f0', cursor: 'pointer' }}
                                                  >
                                                    {isVoting ? <Loader2 className="animate-spin h-3 w-3" /> : '↑'}
                                                  </button>
                                                  <button 
                                                    onClick={(e) => { e.stopPropagation(); handleVote(activity.id!, userVote === 'down' ? 'none' : 'down'); }} 
                                                    style={{ padding: '4px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: '800', background: userVote === 'down' ? '#ef4444' : '#ffffff', color: userVote === 'down' ? '#ffffff' : '#0f172a', borderColor: userVote === 'down' ? '#ef4444' : '#e2e8f0', cursor: 'pointer' }}
                                                  >
                                                    {isVoting ? <Loader2 className="animate-spin h-3 w-3" /> : '↓'}
                                                  </button>
                                                  {userProfile?.isAdmin && <span className="text-[10px] font-bold text-[#64748b] ml-1">↑{activity.upvotes || 0} ↓{activity.downvotes || 0}</span>}
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <Separator className="opacity-50" />
                        <AiRecommendation place={place} />
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
