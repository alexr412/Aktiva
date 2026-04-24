'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { joinActivity } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

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
    X,
    MapPin,
    Sparkles,
    Plus,
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
    onCreateActivity: () => void;
};

export function PlaceDetails({ place, onClose, onCreateActivity }: PlaceDetailsProps) {
    const language = useLanguage();
    const primaryStyle = getPrimaryIconData(place, language);
    const PrimaryIcon = primaryStyle.icon;
    
    const { user, userProfile } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [joiningActivityId, setJoiningActivityId] = useState<string|null>(null);
    
    const [placeMeta, setPlaceMeta] = useState({ 
        avgRating: 0, 
        reviewCount: 0,
        upvotes: 0,
        downvotes: 0,
        communityScore: 0
    });
    const [loadingMeta, setLoadingMeta] = useState(true);
    
    const { addFavorite, removeFavorite, checkIsFavorite } = useFavorites();
    const isFavorite = checkIsFavorite(place.id);

    const handleBookmarkToggle = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (isFavorite) {
            removeFavorite(place.id);
        } else {
            addFavorite(place);
        }
    };

    useEffect(() => {
        if (!db || !place.id) return;
        const unsub = onSnapshot(doc(db, 'places', place.id), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPlaceMeta({
                    avgRating: data.avgRating || 0,
                    reviewCount: data.reviewCount || 0,
                    upvotes: data.upvotes || 0,
                    downvotes: data.downvotes || 0,
                    communityScore: data.communityScore || 0
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
            setActivities(fetchedActivities.sort((a,b) => b.activityDate.toMillis() - a.activityDate.toMillis()));
            setLoadingActivities(false);
        }, (error) => {
            console.error("🔥 FIRESTORE QUERY ERROR (PlaceDetails):", error.message);
            setLoadingActivities(false);
        });

        return () => unsubscribe();
    }, [place.id]);

    const handleJoin = async (activity: Activity) => {
        if (!user) { router.push('/login'); return; }
        if (activity.isPaid && activity.price && activity.price > 0) { router.push(`/checkout/${activity.id}`); return; }
        setJoiningActivityId(activity.id!);
        try {
            await joinActivity(activity.id!, user);
            toast({ title: language === 'de' ? 'Erfolgreich beigetreten!' : 'Successfully joined!' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: error.message });
        } finally { setJoiningActivityId(null); }
    };

    const categories = (place.categories || []);
    const processedTags = formatTags(categories, language);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-900 overflow-hidden rounded-none sm:rounded-[2.5rem] relative">
            {/* Immersiver Header */}
            <div className={cn(
                "relative h-56 sm:h-64 w-full flex-shrink-0 flex items-center justify-center overflow-hidden",
                primaryStyle.bgClass.replace('bg-', 'bg-gradient-to-br from-').replace('-50', '-400 to-').concat(primaryStyle.color === '#ef4444' ? 'red-500' : 'blue-500')
            )}
            style={{ backgroundColor: primaryStyle.color + '20' }}
            >
                {/* Main Dynamic Icon */}
                <div className="relative z-10 drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] transform transition-transform duration-700 hover:scale-110">
                    <div className="absolute inset-0 blur-2xl opacity-40 scale-150" style={{ color: primaryStyle.color }}>
                        <PrimaryIcon className="w-full h-full fill-current" />
                    </div>
                    <PrimaryIcon className="h-24 w-24 sm:h-32 sm:w-32 text-white fill-current/10" strokeWidth={1.5} />
                    <PrimaryIcon className="h-24 w-24 sm:h-32 sm:w-32 text-white absolute inset-0" strokeWidth={1.5} />
                </div>

                {/* Overlapping Badges */}
                <div className="absolute bottom-5 sm:bottom-6 left-5 sm:left-6 flex items-center gap-2 z-20">

                    <div className="bg-white/90 backdrop-blur-md text-neutral-800 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg border border-white/30">
                        {processedTags[0] || (language === 'de' ? 'Entdecken' : 'Discover')}
                    </div>
                </div>

                {/* Save Button */}
                <Button 
                    onClick={handleBookmarkToggle}
                    className={cn(
                        "absolute bottom-5 sm:bottom-6 right-5 sm:right-6 h-11 sm:h-12 px-5 sm:px-6 rounded-full font-black text-[13px] transition-all z-20 border-white/10 flex items-center gap-2 shadow-xl backdrop-blur-md",
                        isFavorite 
                            ? "bg-rose-500 text-white hover:bg-rose-600 border-none" 
                            : "bg-white text-neutral-800 hover:bg-neutral-50"
                    )}
                >
                    <Bookmark className={cn("h-4 w-4", isFavorite && "fill-current")} />
                    <span>{language === 'de' ? 'Speichern' : 'Save'}</span>
                </Button>
            </div>

            <ScrollArea className="flex-1 bg-white dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800/50">
                <div className="p-6 sm:p-8 pb-44">
                    {/* Metadata */}
                    <div className="mb-8">
                        <h2 className="text-[1.75rem] sm:text-[2rem] font-black text-[#0f172a] dark:text-neutral-50 leading-[1.1] mb-2 tracking-tight">
                            {place.name}
                        </h2>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-rose-500">
                                <MapPin className="h-4 w-4 fill-current" />
                                <span className="text-sm font-bold text-slate-400 dark:text-slate-500 truncate block max-w-[280px]">{place.address}</span>
                            </div>
                                <div className="flex items-start gap-2 text-slate-400 dark:text-slate-500">
                                    <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                                    <span className="text-[13px] font-bold leading-tight">
                                        {formatOpeningHours(place.openingHours)}
                                    </span>
                                </div>
                        </div>
                    </div>

                    {/* Horizontal Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-8">
                        <div className="bg-[#fff7ed] dark:bg-amber-950/20 p-4 rounded-[2rem] flex flex-col items-center justify-center gap-1 text-center border border-amber-100/50 dark:border-amber-900/30">
                            <div className="flex items-center gap-1.5">
                                <Star className="w-4 h-4 text-[#f59e0b] fill-[#f59e0b]" />
                                <span className="text-[18px] font-black text-[#854d0e] dark:text-amber-400">
                                {placeMeta.avgRating > 0 ? placeMeta.avgRating.toFixed(1) : '---'}
                                </span>
                            </div>
                            <span className="text-[11px] font-bold text-amber-900/40 dark:text-amber-400/50">Community</span>
                        </div>
                        <div className="bg-[#f0f9ff] dark:bg-blue-950/20 p-4 rounded-[2rem] flex flex-col items-center justify-center gap-1 text-center border border-blue-100/50 dark:border-blue-900/30">
                             <span className="text-[18px] font-black text-[#0369a1] dark:text-blue-400">
                                {place.distance ? (place.distance < 1000 ? `${Math.round(place.distance)}m` : `${(place.distance/1000).toFixed(1)}`) : '---'}
                            </span>
                            <span className="text-[11px] font-bold text-blue-900/40 dark:text-blue-400/50">{language === 'de' ? 'km entfernt' : 'km away'}</span>
                        </div>
                        <div className="bg-[#fef2f2] dark:bg-rose-950/20 p-4 rounded-[2rem] flex flex-col items-center justify-center gap-1 text-center border border-rose-100/50 dark:border-rose-900/30">
                             <span className="text-[18px] font-black text-[#b91c1c] dark:text-rose-400">
                                {activities.length}
                            </span>
                            <span className="text-[11px] font-bold text-rose-900/40 dark:text-rose-400/50">{language === 'de' ? 'Aktivitäten' : 'Activities'}</span>
                        </div>
                    </div>


                    {/* Activities Local */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-2">
                                <Users className="h-6 w-6 text-[#1e293b] dark:text-neutral-100" />
                                <h3 className="text-xl font-black text-[#0f172a] dark:text-neutral-50 tracking-tight">{language === 'de' ? 'Aktivitäten vor Ort' : 'Local Activities'}</h3>
                             </div>
                             <button onClick={onCreateActivity} className="text-[#59a27a] font-black text-sm hover:opacity-70 transition-all">+ {language === 'de' ? 'Erstellen' : 'Create'}</button>
                        </div>

                        {loadingActivities ? (
                            <div className="space-y-4">
                                <Skeleton className="h-24 w-full rounded-3xl" />
                                <Skeleton className="h-24 w-full rounded-3xl" />
                            </div>
                        ) : activities.length === 0 ? (
                             <div className="flex flex-col items-center justify-center py-12 px-6 bg-[#f8fafc] dark:bg-neutral-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-neutral-800 text-center group">
                                <div className="bg-white dark:bg-neutral-800 p-6 rounded-3xl shadow-sm mb-6 transform group-hover:-rotate-6 transition-transform">
                                    <span className="text-4xl">📬</span>
                                </div>
                                <h4 className="text-lg font-black text-[#0f172a] dark:text-neutral-100 mb-1">{language === 'de' ? 'Noch keine Treffen' : 'No meetups yet'}</h4>
                                <p className="text-sm text-slate-400 font-medium max-w-[200px] mb-8">{language === 'de' ? 'Sei der Erste und erstelle eine Aktivität!' : 'Be the first and create an activity!'}</p>
                                <Button 
                                    onClick={onCreateActivity}
                                    className="bg-[#1e293b] text-white hover:bg-black rounded-2xl h-14 px-8 font-black text-sm shadow-xl"
                                >
                                    + {language === 'de' ? 'Aktivität erstellen' : 'Create activity'}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activities.map(activity => {
                                    const actDate = activity.activityDate.toDate();
                                    const isParticipant = activity.participantIds.includes(user?.uid || '---');
                                    
                                    return (
                                        <div key={activity.id} className="bg-white dark:bg-neutral-800 rounded-[2rem] p-4 flex items-center gap-4 border border-slate-100 dark:border-neutral-800 hover:shadow-xl transition-all shadow-sm group">
                                            {/* Date Circle */}
                                            <div className="h-16 w-14 bg-[#f0fdf4] dark:bg-emerald-950/20 rounded-2xl flex flex-col items-center justify-center shrink-0 border border-emerald-100/50 dark:border-emerald-900/30">
                                                <span className="text-xl font-black text-[#59a27a]">{format(actDate, 'd')}</span>
                                                <span className="text-[9px] font-black text-[#59a27a] uppercase tracking-tighter">{format(actDate, 'MMM', { locale: language === 'de' ? de : enUS })}</span>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                     <h4 className="font-black text-[15px] truncate text-[#0f172a] dark:text-neutral-100 leading-tight">
                                                        {activity.placeName || (language === 'de' ? 'Treffen' : 'Meetup')}
                                                    </h4>

                                                </div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <div className="flex -space-x-1.5">
                                                        {(activity.participantsPreview || []).slice(0, 3).map((p, i) => (
                                                            <div key={i} className="w-5 h-5 rounded-full border-2 border-white dark:border-neutral-800 bg-slate-200 overflow-hidden">
                                                                <img src={p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} alt="avatar" className="w-full h-full object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                     <span className="text-[11px] font-bold text-slate-400">
                                                        {activity.participantIds.length} {language === 'de' ? 'Teilnehmer' : 'Participants'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action */}
                                            {isParticipant ? (
                                                <Button 
                                                    onClick={() => router.push(`/chat/${activity.id}`)}
                                                    variant="secondary"
                                                    className="bg-[#f5f3f2] hover:bg-slate-200 text-[#0f172a] rounded-[1.25rem] h-11 px-5 font-black text-sm border-none shadow-none"
                                                >
                                                    Chat
                                                </Button>
                                            ) : (
                                                 <Button 
                                                    onClick={() => handleJoin(activity)}
                                                    disabled={joiningActivityId === activity.id}
                                                    className="bg-[#59a27a] text-white hover:bg-[#4d8c6a] rounded-[1.25rem] h-11 px-5 font-black text-sm border-none shadow-lg shadow-[#59a27a]/20"
                                                >
                                                    {joiningActivityId === activity.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === 'de' ? 'Beitreten' : 'Join')}
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Fixed Sticky Footer */}
            <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 z-40">
                <div className="bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl p-3 sm:p-4 rounded-[2rem] sm:rounded-[2.5rem] flex items-center shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-white/40 dark:border-neutral-800/50">
                    <Button 
                         onClick={onCreateActivity}
                        className="bg-[#59a27a] hover:bg-[#4d8c6a] text-white rounded-[1.25rem] sm:rounded-[1.5rem] h-12 sm:h-14 w-full font-black text-[14px] sm:text-[15px] border-none shadow-lg shadow-[#59a27a]/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                    >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
                        {language === 'de' ? 'Aktivität erstellen' : 'Create activity'}
                    </Button>
                </div>
            </div>
        </div>
    );
}


