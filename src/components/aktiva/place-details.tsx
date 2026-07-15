'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { joinActivity, votePlace, normalizeActivityDocument } from '@/lib/firebase/firestore';
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
    Info,
    Copy,
    Check,
    FolderPlus,
    Folder,
    BarChart3,
    ThumbsUp,
    ThumbsDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Place, Activity } from '@/lib/types';
import { AiRecommendation } from './ai-recommendation';
import { ActivityInfoSheet } from './activity-info-sheet';
import { useFavorites } from '@/contexts/favorites-context';
import { SaveToCollectionModal } from '@/components/premium/save-to-collection-modal';
import { OrganizerAnalyticsSheet } from '@/components/premium/organizer-analytics-sheet';
import { cn } from '@/lib/utils';
import { getPrimaryIconData, translateTag } from '@/lib/tag-config';
import { formatOpeningHours } from '@/lib/tag-parser';
import { trackInteraction } from '@/lib/telemetry';

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

    const viewportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const animId = requestAnimationFrame(() => {
            if (viewportRef.current) {
                viewportRef.current.scrollTop = 0;
            }
        });
        return () => {
            cancelAnimationFrame(animId);
        };
    }, [place.id]);
    
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [joiningActivityId, setJoiningActivityId] = useState<string|null>(null);
    const [requestedActivityIds, setRequestedActivityIds] = useState<Record<string, boolean>>({});
    const [selectedInfoActivity, setSelectedInfoActivity] = useState<Activity | null>(null);
    const [copied, setCopied] = useState(false);
    const [isSaveToCollectionOpen, setIsSaveToCollectionOpen] = useState(false);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

    const handleCopyAddress = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(place.address || "");
        setCopied(true);
        toast({
            title: language === 'de' ? 'Kopiert!' : 'Copied!',
            description: language === 'de' ? 'Adresse in Zwischenablage kopiert.' : 'Address copied to clipboard.'
        });
        setTimeout(() => setCopied(false), 2000);
    };
    
    const [placeMeta, setPlaceMeta] = useState({ 
        avgRating: 0, 
        reviewCount: 0,
        upvotes: 0,
        downvotes: 0,
        communityScore: 0,
        userVotes: {} as Record<string, 'up' | 'down'>,
        weightedUpvotes: 0,
        weightedDownvotes: 0
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
        trackInteraction(place.id, place.categories, 'favorite', user?.uid);
    };

    const userVote = user ? (placeMeta.userVotes?.[user.uid] || 'none') : 'none';
    const [isVoting, setIsVoting] = useState(false);

    const handleVoteClick = async (e: React.MouseEvent, type: 'up' | 'down' | 'none') => {
        e.stopPropagation();
        if (!user || isVoting) return;
        setIsVoting(true);

        setPlaceMeta(prev => {
            const prevVote = prev.userVotes?.[user.uid] || 'none';
            let upDelta = 0;
            let downDelta = 0;
            const newUserVotes = { ...prev.userVotes };

            if (prevVote === 'up') upDelta -= 1;
            else if (prevVote === 'down') downDelta -= 1;

            if (type === 'up') { upDelta += 1; newUserVotes[user.uid] = 'up'; }
            else if (type === 'down') { downDelta += 1; newUserVotes[user.uid] = 'down'; }
            else { delete newUserVotes[user.uid]; }

            return {
                ...prev,
                upvotes: Math.max(0, prev.upvotes + upDelta),
                downvotes: Math.max(0, prev.downvotes + downDelta),
                userVotes: newUserVotes
            };
        });

        try {
            await votePlace(place.id, user.uid, type, userProfile?.role, place);
        } catch (error) {
            console.error("Voting failed:", error);
        } finally {
            setIsVoting(false);
        }
    };

    const handleSharePlace = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const shareUrl = `${window.location.origin}/?placeId=${place.id}`;
        const shareData = {
            title: place.name,
            text: language === 'de' ? `Schau dir ${place.name} auf Aktiva an!` : `Check out ${place.name} on Aktiva!`,
            url: shareUrl,
        };

        trackInteraction(place.id, place.categories, 'share', user?.uid);

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.warn("Share failed:", error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareUrl);
                toast({
                    title: language === 'de' ? 'Link kopiert!' : 'Link copied!',
                    description: language === 'de' ? 'Link in Zwischenablage kopiert.' : 'Link copied to clipboard.'
                });
            } catch (err) {
                console.error("Clipboard copy failed:", err);
            }
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
                    communityScore: data.communityScore || 0,
                    userVotes: data.userVotes || {},
                    weightedUpvotes: data.weightedUpvotes || 0,
                    weightedDownvotes: data.weightedDownvotes || 0
                });
            }
            setLoadingMeta(false);
        });
        return () => unsub();
    }, [place.id]);

    useEffect(() => {
        if (place.id) {
            trackInteraction(place.id, place.categories, 'card_open', user?.uid);
        }
    }, [place.id, user?.uid, place.categories]);

    useEffect(() => {
        if (!db || !place.id) return;
        setLoadingActivities(true);
        
        const activitiesQuery = query(
            collection(db, 'activities'), 
            where('placeId', '==', place.id)
        );

        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            const fetchedActivities = snapshot.docs.map(doc => normalizeActivityDocument(doc.data(), doc.id));
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
        if (joiningActivityId === activity.id || requestedActivityIds[activity.id!]) return;
        
        setJoiningActivityId(activity.id!);
        try {
            const status = await joinActivity(activity.id!, user, null, null, activity.joinMode);
            if (status === 'joined') {
                toast({ title: language === 'de' ? 'Erfolgreich beigetreten!' : 'Successfully joined!' });
            } else if (status === 'already_requested') {
                setRequestedActivityIds(prev => ({
                    ...prev,
                    [activity.id!]: true
                }));
                toast({
                    title: language === 'de' ? 'Du hast bereits eine Anfrage gesendet.' : 'You already sent a request.',
                    description: language === 'de' ? 'Der Host hat deine Anfrage bereits erhalten.' : 'The host has already received your request.'
                });
            } else {
                setRequestedActivityIds(prev => ({
                    ...prev,
                    [activity.id!]: true
                }));
                toast({ title: language === 'de' ? 'Anfrage gesendet!' : 'Request sent!', description: language === 'de' ? 'Der Host wird benachrichtigt.' : 'The host will be notified.' });
            }
            return status;
        } catch (error: any) {
            toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: error.message || String(error) });
        } finally { setJoiningActivityId(null); }
    };

    const categories = (place.categories || []);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-neutral-900 overflow-hidden rounded-none sm:rounded-[2.5rem] relative">
            {/* Immersiver Header mit dynamischem Verlauf */}
            <div className={cn(
                "relative h-[115px] md:h-64 w-full flex-shrink-0 flex items-center justify-center overflow-hidden",
                primaryStyle.gradientClass
            )}
            >
                {/* Close Button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 z-30 h-11 w-11 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none border-none shadow-sm"
                        aria-label={language === 'de' ? 'Schließen' : 'Close'}
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}

                {/* Main Dynamic Icon (Reduced Scale) */}
                <div className="relative z-20 drop-shadow-[0_15px_30px_rgba(0,0,0,0.4)] transform transition-transform duration-700 hover:scale-110">
                    <div className="absolute inset-0 blur-2xl opacity-40 scale-150" style={{ color: primaryStyle.color }}>
                        <PrimaryIcon className="w-full h-full fill-current" />
                    </div>
                    <PrimaryIcon className="h-12 w-12 md:h-20 md:w-20 text-white fill-current/10" strokeWidth={1.5} />
                    <PrimaryIcon className="h-12 w-12 md:h-20 md:w-20 text-white absolute inset-0" strokeWidth={1.5} />
                </div>

                {/* Overlapping Badges */}
                <div className="absolute bottom-3 md:bottom-6 left-3 md:left-6 flex items-center gap-2 z-20">
                    <div className="bg-white/90 backdrop-blur-md text-neutral-800 px-4 h-7 flex items-center rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg border border-white/30 leading-none">
                        {translateTag(categories[0] || '', language)}
                    </div>
                </div>
            </div>

            <ScrollArea viewportRef={viewportRef} className="flex-1 bg-white dark:bg-neutral-900 border-t border-slate-100 dark:border-neutral-800/50">
                <div className="p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] md:p-8 md:pb-12">
                    {/* 1. Core metadata */}
                    <div className="mb-4 md:mb-6">
                        <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-neutral-50 mb-1 leading-snug">
                            {place.name}
                        </h2>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => trackInteraction(place.id, place.categories, 'directions', user?.uid)}
                                    className="flex items-center gap-1.5 text-rose-500 hover:text-rose-600 hover:underline cursor-pointer group"
                                >
                                    <MapPin className="h-3.5 w-3.5 fill-current group-hover:scale-110 transition-transform shrink-0" />
                                    <h4 className="text-[12px] md:text-sm font-bold leading-tight">{place.address}</h4>
                                </a>
                                <Button
                                    onClick={handleCopyAddress}
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-400 hover:text-slate-600 transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
                                    title={language === 'de' ? 'Adresse kopieren' : 'Copy address'}
                                >
                                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <div className="flex items-start gap-1.5 text-slate-500 dark:text-neutral-400">
                                <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span className="text-[12px] md:text-sm font-medium leading-tight">
                                    {formatOpeningHours(place.openingHours)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Separator className="my-4 dark:bg-neutral-800/80" />

                    {/* 2. Local Activities Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-[#1e293b] dark:text-neutral-100" />
                                <h3 className="text-sm font-black text-slate-800 dark:text-neutral-200">
                                    {language === 'de' ? 'Aktivitäten vor Ort' : 'Local Activities'}
                                    {activities.length > 0 && ` · ${activities.length}`}
                                </h3>
                            </div>
                            {activities.length > 0 && (
                                <Button
                                    onClick={onCreateActivity}
                                    variant="ghost"
                                    className="h-11 px-4 text-xs font-black bg-primary/10 hover:bg-primary/20 text-primary rounded-xl flex items-center gap-1.5 shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
                                    aria-label={language === 'de' ? 'Aktivität erstellen' : 'Create activity'}
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>
                                        {language === 'de' ? 'Erstellen' : 'Create'}
                                    </span>
                                </Button>
                            )}
                        </div>

                        {loadingActivities ? (
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full rounded-2xl" />
                                <Skeleton className="h-20 w-full rounded-2xl" />
                            </div>
                        ) : activities.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-5 bg-slate-50/50 dark:bg-neutral-800/40 rounded-2xl border border-slate-100 dark:border-neutral-800/50 text-center my-1 max-w-md mx-auto">
                                <h4 className="font-bold text-sm text-slate-800 dark:text-neutral-200 mb-1 leading-snug">
                                    {language === 'de' ? 'Noch keine offenen Aktivitäten an diesem Ort' : 'No open activities at this place yet'}
                                </h4>
                                <p className="text-xs text-slate-400 font-semibold mb-4 leading-normal max-w-xs">
                                    {language === 'de' ? 'Erstelle die erste Aktivität und finde Leute, die mitmachen.' : 'Create the first activity and find people to join.'}
                                </p>
                                <Button
                                    onClick={onCreateActivity}
                                    className="h-11 px-5 rounded-xl bg-primary text-white font-bold text-xs uppercase tracking-wider active:scale-[0.985] flex items-center gap-1.5 shadow shadow-primary/10 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
                                >
                                    <Plus className="h-4 w-4" />
                                    {language === 'de' ? 'Aktivität erstellen' : 'Create activity'}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activities.map(activity => {
                                    const actDate = activity.activityDate.toDate();
                                    const isParticipant = activity.participantIds.includes(user?.uid || '---');
                                    const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;
                                    const hasRequested = activity.id ? requestedActivityIds[activity.id] : false;
                                    
                                    return (
                                        <div 
                                            key={activity.id} 
                                            onClick={() => setSelectedInfoActivity(activity)}
                                            className="bg-white dark:bg-neutral-800 rounded-2xl p-3 md:p-3.5 flex flex-row items-center flex-wrap sm:flex-nowrap gap-2.5 md:gap-3 border border-slate-100 dark:border-neutral-800 hover:shadow-md transition-all shadow-sm group cursor-pointer min-h-[96px] md:min-h-[104px]"
                                        >
                                            {/* Date & Avatar Group */}
                                            <div className="flex items-center gap-2 md:gap-2.5 flex-none">
                                                {/* Date Circle */}
                                                <div className="h-[52px] w-[48px] bg-accent dark:bg-emerald-950/20 rounded-xl flex flex-col items-center justify-center border border-emerald-100/50 dark:border-emerald-900/30 flex-none select-none">
                                                    <span className="text-lg font-black text-primary leading-none">{format(actDate, 'd')}</span>
                                                    <span className="text-[8px] font-black text-primary uppercase tracking-tighter mt-0.5">{format(actDate, 'MMM', { locale: language === 'de' ? de : enUS })}</span>
                                                </div>

                                                {/* Resized Avatar */}
                                                <div className="w-12 h-12 sm:w-[52px] sm:h-[52px] md:w-14 md:h-14 rounded-full border border-slate-100 dark:border-neutral-800 bg-slate-200 overflow-hidden flex-none shadow-sm">
                                                    <img 
                                                        src={activity.participantsPreview?.[0]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.participantsPreview?.[0]?.uid || activity.hostId}`} 
                                                        alt="avatar" 
                                                        loading="lazy" 
                                                        decoding="async" 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                </div>
                                            </div>

                                            {/* Title & Count */}
                                            <div className="flex-1 min-w-[140px]">
                                                <h4 className="font-bold text-sm md:text-[15px] text-slate-800 dark:text-neutral-200 line-clamp-2 leading-snug break-words">
                                                    {activity.isCustomActivity ? (activity.title || activity.placeName) : (activity.placeName || (language === 'de' ? 'Treffen' : 'Meetup'))}
                                                </h4>
                                                <span className="text-[10px] md:text-[11px] font-bold text-slate-400 dark:text-neutral-500 mt-1 block">
                                                    {activity.participantIds.length} {language === 'de' ? 'Teilnehmer' : 'Participants'}
                                                </span>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1.5 flex-none ml-auto sm:ml-0 max-[369px]:w-full max-[369px]:justify-end max-[369px]:mt-1.5">
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedInfoActivity(activity);
                                                    }}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-11 w-11 rounded-full bg-slate-50 dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 text-slate-400 hover:text-primary transition-colors border border-slate-150 dark:border-neutral-800 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none flex-none"
                                                >
                                                    <Info className="h-4 w-4" />
                                                </Button>

                                                {isParticipant ? (
                                                    <Button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/chat/${activity.id}`);
                                                        }}
                                                        variant="secondary"
                                                        className="bg-[#f5f3f2] hover:bg-slate-200 text-[#0f172a] rounded-xl h-11 min-w-[64px] px-3 font-bold text-xs border-none shadow-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none flex-none whitespace-nowrap"
                                                    >
                                                        Chat
                                                    </Button>
                                                ) : (
                                                    <Button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleJoin(activity);
                                                        }}
                                                        disabled={joiningActivityId === activity.id || hasRequested || isFull || activity.status !== 'active'}
                                                        className={cn(
                                                            hasRequested
                                                              ? "bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 hover:opacity-100 cursor-not-allowed shadow-none"
                                                              : "bg-primary text-white hover:opacity-90 shadow-sm",
                                                            "rounded-xl h-11 min-w-[64px] px-3 font-bold text-xs border-none transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none flex-none whitespace-nowrap"
                                                        )}
                                                    >
                                                        {joiningActivityId === activity.id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : hasRequested ? (
                                                            language === 'de' ? 'Angefragt' : 'Requested'
                                                        ) : activity.joinMode !== 'direct' ? (
                                                            language === 'de' ? 'Anfrage' : 'Request'
                                                        ) : (
                                                            language === 'de' ? 'Beitreten' : 'Join'
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <Separator className="my-4 dark:bg-neutral-800/80" />

                    {/* 3. Secondary Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 my-4">
                        <Button 
                            onClick={handleBookmarkToggle}
                            className={cn(
                                "h-11 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border shadow-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none",
                                isFavorite 
                                    ? "bg-rose-500 hover:bg-rose-600 text-white border-transparent" 
                                    : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 border-slate-100 dark:border-neutral-800"
                            )}
                        >
                            <Bookmark className={cn("h-4 w-4 shrink-0", isFavorite && "fill-current")} />
                            <span className="whitespace-nowrap truncate">{isFavorite ? (language === 'de' ? 'Gespeichert' : 'Saved') : (language === 'de' ? 'Speichern' : 'Save')}</span>
                        </Button>
                        <Button 
                            onClick={() => setIsSaveToCollectionOpen(true)}
                            className="h-11 rounded-xl bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-slate-100 dark:border-neutral-800 font-bold text-xs transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
                        >
                            <FolderPlus className="h-4 w-4 text-emerald-500 shrink-0" />
                            <span className="whitespace-nowrap truncate">{language === 'de' ? 'Liste' : 'List'}</span>
                        </Button>
                        <Button 
                            onClick={() => setIsAnalyticsOpen(true)}
                            className="h-11 rounded-xl bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-slate-100 dark:border-neutral-800 font-bold text-xs transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
                        >
                            <BarChart3 className="h-4 w-4 text-violet-500 shrink-0" />
                            <span className="whitespace-nowrap truncate">{language === 'de' ? 'Statistik' : 'Stats'}</span>
                        </Button>
                        <Button 
                            onClick={handleSharePlace}
                            className="h-11 rounded-xl bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700 border border-slate-100 dark:border-neutral-800 font-bold text-xs transition-all flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
                        >
                            <Share2 className="h-4 w-4 text-sky-500 shrink-0" />
                            <span className="whitespace-nowrap truncate">{language === 'de' ? 'Teilen' : 'Share'}</span>
                        </Button>
                    </div>

                    {/* 4. Rating and Distance Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 my-4">
                        <div className="bg-[#fff7ed] dark:bg-amber-950/20 p-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-center border border-amber-100/50 dark:border-amber-900/30">
                            <div className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-[#f59e0b] fill-[#f59e0b]" />
                                <span className={cn(
                                    "font-black text-[#854d0e] dark:text-amber-400 text-sm",
                                    placeMeta.avgRating > 0 ? "text-[14px]" : "text-[10px]"
                                )}>
                                    {placeMeta.avgRating > 0 ? placeMeta.avgRating.toFixed(1) : (language === 'de' ? 'Noch keine' : 'No ratings')}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-amber-900/80 dark:text-amber-400/80">Community</span>
                        </div>
                        <div className="bg-[#f0f9ff] dark:bg-blue-950/20 p-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-center border border-blue-100/50 dark:border-blue-900/30">
                             <span className="text-sm font-black text-[#0369a1] dark:text-blue-400">
                                {place.distance ? (place.distance < 1000 ? `${Math.round(place.distance)}m` : `${(place.distance/1000).toFixed(1)}km`) : '---'}
                            </span>
                            <span className="text-[10px] font-bold text-blue-900/80 dark:text-blue-400/80">{language === 'de' ? 'Entfernung' : 'Distance'}</span>
                        </div>
                        <div className="hidden md:flex bg-[#fef2f2] dark:bg-rose-950/20 p-3 rounded-2xl flex-col items-center justify-center gap-0.5 text-center border border-rose-100/50 dark:border-rose-900/30">
                             <span className="text-sm font-black text-[#b91c1c] dark:text-rose-400">
                                {activities.length}
                            </span>
                            <span className="text-[10px] font-bold text-rose-900/80 dark:text-rose-400/80">{language === 'de' ? 'Aktivitäten' : 'Activities'}</span>
                        </div>
                    </div>

                    {/* Voting Widget */}
                    <div className="flex items-center gap-3 pt-2 justify-center">
                        <div className="flex items-center bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-0.5 gap-0.5 border border-neutral-100 dark:border-neutral-800">
                            <button
                                onClick={(e) => handleVoteClick(e, userVote === 'up' ? 'none' : 'up')}
                                className={cn(
                                    "h-7 rounded-xl flex items-center justify-center transition-all text-[11px] font-black leading-none gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none",
                                    (userProfile?.role === 'admin' || userProfile?.role === 'supporter') ? "px-2" : "w-7",
                                    userVote === 'up' ? "bg-white text-emerald-500 shadow-sm" : "text-emerald-500/40 hover:text-emerald-500"
                                )}
                            >
                                <ThumbsUp className="h-3.5 w-3.5" />
                                {(userProfile?.role === 'admin' || userProfile?.role === 'supporter') && (
                                    <span className="opacity-70 text-[10px]">
                                        {(placeMeta.weightedUpvotes || 0) > 0 ? `+${placeMeta.weightedUpvotes}` : '0'}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={(e) => handleVoteClick(e, userVote === 'down' ? 'none' : 'down')}
                                className={cn(
                                    "h-7 rounded-xl flex items-center justify-center transition-all text-[11px] font-black leading-none gap-1 shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none",
                                    (userProfile?.role === 'admin' || userProfile?.role === 'supporter') ? "px-2" : "w-7",
                                    userVote === 'down' ? "bg-white text-red-500 shadow-sm" : "text-red-500/40 hover:text-red-500"
                                )}
                            >
                                <ThumbsDown className="h-3.5 w-3.5" />
                                {(userProfile?.role === 'admin' || userProfile?.role === 'supporter') && (
                                    <span className="opacity-70 text-[10px]">
                                        {(placeMeta.weightedDownvotes || 0) > 0 ? `-${placeMeta.weightedDownvotes}` : '0'}
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* Reusable SaveToCollectionModal */}
            <SaveToCollectionModal
                placeId={place.id}
                placeName={place.name}
                open={isSaveToCollectionOpen}
                onOpenChange={setIsSaveToCollectionOpen}
            />

            {/* Reusable OrganizerAnalyticsSheet */}
            <OrganizerAnalyticsSheet
                placeId={place.id}
                placeName={place.name}
                open={isAnalyticsOpen}
                onOpenChange={setIsAnalyticsOpen}
            />

            {/* Reusable ActivityInfoSheet for details view */}
            <ActivityInfoSheet
                activity={selectedInfoActivity}
                open={!!selectedInfoActivity}
                onOpenChange={(open) => !open && setSelectedInfoActivity(null)}
                onJoin={handleJoin}
                isJoining={joiningActivityId === selectedInfoActivity?.id}
            />
        </div>
    );
}


