'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from '@/contexts/location-context';
import { calculateDistanceKm, extractCoordinates, formatDistance } from '@/lib/geo-utils';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';

import {
    Star,
    Users,
    Loader2,
    Bookmark,
    Clock,
    X,
    MapPin,
    Plus,
    Info,
    Copy,
    Check,
    FolderPlus,
    BarChart3,
    Share2,
    ThumbsUp,
    ThumbsDown,
    MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { Place, Activity, Review } from '@/lib/types';
import { ActivityInfoSheet } from './activity-info-sheet';
import { useFavorites } from '@/contexts/favorites-context';
import { SaveToCollectionModal } from '@/components/premium/save-to-collection-modal';
import { OrganizerAnalyticsSheet } from '@/components/premium/organizer-analytics-sheet';
import { cn } from '@/lib/utils';
import { getPrimaryIconData } from '@/lib/tag-config';
import { formatOpeningHours } from '@/lib/tag-parser';
import { trackInteraction } from '@/lib/telemetry';
import { getReviewsForTarget } from '@/lib/firebase/firestore';

import { usePlaceActivities } from '@/features/places/details/use-place-activities';
import { usePlaceVoting } from '@/features/places/details/use-place-voting';
import { usePlaceJoin } from '@/features/places/details/use-place-join';

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
    const { position } = useLocation();
    const router = useRouter();
    const { toast } = useToast();

    // Dynamische Distanzberechnung aus dem aktuellen Standort (LocationProvider)
    const targetCoords = useMemo(() => extractCoordinates(place), [place]);

    const effectiveDistanceInKm = useMemo(() => {
        // 1. Live-Standort aus dem LocationProvider + Zielkoordinaten haben Priorität
        if (position && targetCoords) {
            return calculateDistanceKm(
                position.latitude,
                position.longitude,
                targetCoords.lat,
                targetCoords.lng
            );
        }
        // 2. Fallback: Keine Live-Position vorhanden, aber im place-Objekt existiert bereits ein gültiger distance-Wert (wird in Kilometern erwartet)
        if (
            place.distance !== undefined &&
            place.distance !== null &&
            typeof place.distance === 'number' &&
            !isNaN(place.distance) &&
            isFinite(place.distance) &&
            place.distance >= 0
        ) {
            return place.distance;
        }
        // 3. Kein gültiger Standort/Distanzwert -> null (führt im Formatter zum Fallback '---')
        return null;
    }, [position, targetCoords, place.distance]);

    const formattedDistance = formatDistance(effectiveDistanceInKm);

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
    
    // Extrahierte Custom Hooks für Business- & Firestore-Logik
    const { activities, loadingActivities } = usePlaceActivities(place.id);
    const { placeMeta, userVote, handleVoteClick } = usePlaceVoting(place, user, userProfile);
    const { joiningActivityId, requestedActivityIds, handleJoin } = usePlaceJoin(user, language);

    const [selectedInfoActivity, setSelectedInfoActivity] = useState<Activity | null>(null);
    const [copied, setCopied] = useState(false);
    const [isSaveToCollectionOpen, setIsSaveToCollectionOpen] = useState(false);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    
    const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
    const [isLoadingReviews, setIsLoadingReviews] = useState(false);
    const [placeReviews, setPlaceReviews] = useState<Review[]>([]);

    const handleOpenReviewsModal = async () => {
        setIsReviewsModalOpen(true);
        setIsLoadingReviews(true);
        try {
            const fetched = await getReviewsForTarget(place.id);
            if (fetched.length === 0 && activities.length > 0 && activities[0].id) {
                const activityReviews = await getReviewsForTarget(activities[0].id);
                setPlaceReviews(activityReviews);
            } else {
                setPlaceReviews(fetched);
            }
        } catch (err) {
            console.error("Failed to load place reviews:", err);
        } finally {
            setIsLoadingReviews(false);
        }
    };

    const handleCopyAddress = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        navigator.clipboard.writeText(place.address || "");
        setCopied(true);
        toast({
            title: language === 'de' ? 'Adresse kopiert' : 'Address copied',
            description: language === 'de' ? 'Adresse in Zwischenablage kopiert.' : 'Address copied to clipboard.'
        });
        setTimeout(() => setCopied(false), 2000);
    };

    // Long-Press & Touch interaction refs für Adress-Kopie
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const failsafeTimerRef = useRef<NodeJS.Timeout | null>(null);
    const startPosRef = useRef<{ x: number; y: number } | null>(null);
    const preventClickRef = useRef(false);
    const isTouchActiveRef = useRef(false);

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        startPosRef.current = null;
        isTouchActiveRef.current = false;
    };

    const clearFailsafeTimer = () => {
        if (failsafeTimerRef.current) {
            clearTimeout(failsafeTimerRef.current);
            failsafeTimerRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            clearLongPressTimer();
            clearFailsafeTimer();
        };
    }, []);

    const handleAddressPointerDown = (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return;

        clearLongPressTimer();
        clearFailsafeTimer();
        preventClickRef.current = false;
        isTouchActiveRef.current = true;
        startPosRef.current = { x: e.clientX, y: e.clientY };

        longPressTimerRef.current = setTimeout(() => {
            preventClickRef.current = true;
            handleCopyAddress();
            clearLongPressTimer();

            clearFailsafeTimer();
            failsafeTimerRef.current = setTimeout(() => {
                preventClickRef.current = false;
                failsafeTimerRef.current = null;
            }, 1000);
        }, 500);
    };

    const handleAddressPointerMove = (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch' || !startPosRef.current || !longPressTimerRef.current) return;

        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 10) {
            clearLongPressTimer();
        }
    };

    const handleAddressPointerUp = (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return;
        clearLongPressTimer();
    };

    const handleAddressPointerCancel = (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') return;
        clearLongPressTimer();
    };

    const handleAddressContextMenu = (e: React.SyntheticEvent) => {
        if (isTouchActiveRef.current || preventClickRef.current) {
            e.preventDefault();
        }
    };

    const handleAddressClick = (e: React.MouseEvent) => {
        if (preventClickRef.current) {
            e.preventDefault();
            e.stopPropagation();
            preventClickRef.current = false;
            clearFailsafeTimer();
            return;
        }
        trackInteraction(place.id, place.categories, 'directions', user?.uid);
    };
    
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
        if (place.id) {
            trackInteraction(place.id, place.categories, 'card_open', user?.uid);
        }
    }, [place.id, user?.uid, place.categories]);

    const openingHoursText = formatOpeningHours(place.openingHours);

    return (
        <div className="flex flex-col h-full min-h-0 w-full bg-white dark:bg-card overflow-hidden rounded-none sm:rounded-3xl relative">
            {/* Compact category header */}
            <div className={cn(
                "relative w-full shrink-0 flex items-center gap-3 py-5 pl-4 pr-16 sm:pl-5 overflow-hidden",
                primaryStyle.gradientClass
            )}
            >
                <div className="absolute -right-6 -top-10 h-32 w-32 rounded-full border-[20px] border-white/10 pointer-events-none" aria-hidden="true" />
                <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 border border-white/20" aria-hidden="true">
                    <PrimaryIcon className="h-7 w-7 text-white" strokeWidth={1.7} />
                </div>
                <div className="relative min-w-0">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/85">{primaryStyle.label}</p>
                    <h2 title={place.name} className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-white line-clamp-2 [overflow-wrap:anywhere]">{place.name}</h2>
                </div>
                {/* Close Button */}
                {onClose && (
                    <button
                        onClick={onClose}
                        type="button"
                        className="absolute top-3 right-3 z-30 h-11 w-11 rounded-xl bg-black/15 hover:bg-black/30 text-white flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-white focus:outline-none"
                        aria-label={language === 'de' ? 'Schließen' : 'Close'}
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}

            </div>

            <ScrollArea viewportRef={viewportRef} className="flex-1 min-h-0 w-full bg-white dark:bg-card">
                <div className="p-4 sm:p-5 pb-6 sm:pb-6">
                    {/* 1. Core metadata */}
                    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-background p-3">
                        <div className="space-y-2">
                            <div className="flex items-start gap-2">
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onPointerDown={handleAddressPointerDown}
                                    onPointerMove={handleAddressPointerMove}
                                    onPointerUp={handleAddressPointerUp}
                                    onPointerCancel={handleAddressPointerCancel}
                                    onContextMenu={handleAddressContextMenu}
                                    onClick={handleAddressClick}
                                    className="flex min-w-0 flex-1 items-start gap-2 text-slate-700 dark:text-slate-200 hover:text-rose-500 cursor-pointer group select-none pt-2"
                                    style={{ WebkitTouchCallout: 'none' }}
                                >
                                    <MapPin className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                                    <span className="min-w-0 text-xs sm:text-sm font-medium leading-relaxed [overflow-wrap:anywhere] underline decoration-rose-500/40 underline-offset-2">{place.address}</span>
                                </a>
                                <Button
                                    onClick={handleCopyAddress}
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-slate-400 hover:text-slate-600 transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus:outline-none"
                                    title={language === 'de' ? 'Adresse kopieren' : 'Copy address'}
                                    aria-label={language === 'de' ? 'Adresse kopieren' : 'Copy address'}
                                >
                                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            {openingHoursText && <div className="flex items-start gap-2 text-slate-500 dark:text-slate-400">
                                <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span className="text-[12px] md:text-sm font-medium leading-tight">
                                    {openingHoursText}
                                </span>
                            </div>}
                        </div>
                    </div>

                    <Separator className="my-4 dark:bg-neutral-800/80" />

                    {/* 2. Local Activities Section */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-[#1e293b] dark:text-neutral-100" />
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
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
                                            className="bg-slate-50 dark:bg-background rounded-2xl p-3 flex items-start gap-2.5 border border-slate-200 dark:border-white/10 hover:border-primary/30 transition-colors group cursor-pointer"
                                        >
                                            {/* Date badge: links, flex-none */}
                                            <div className="h-11 w-10 bg-accent dark:bg-emerald-950/20 rounded-xl flex flex-col items-center justify-center border border-emerald-100/50 dark:border-emerald-900/30 shrink-0 select-none">
                                                <span className="text-lg font-black text-primary leading-none">{format(actDate, 'd')}</span>
                                                <span className="text-[8px] font-black text-primary uppercase tracking-tighter mt-0.5">{format(actDate, 'MMM', { locale: language === 'de' ? de : enUS })}</span>
                                            </div>

                                            {/* Main content area: flex-1 min-w-0 */}
                                            <div className="flex-1 min-w-0 flex flex-col">
                                                {/* Obere Reihe */}
                                                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 w-full">
                                                    {/* Linker Block: Avatar + Title block */}
                                                    <div className="flex items-center gap-2 min-w-[100px] sm:min-w-0 flex-1">
                                                        {/* Resized Avatar */}
                                                        <div className="hidden sm:block w-8 h-8 rounded-full border border-slate-100 dark:border-neutral-800 bg-slate-200 overflow-hidden shrink-0">
                                                            <img 
                                                                src={activity.participantsPreview?.[0]?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activity.participantsPreview?.[0]?.uid || activity.hostId}`} 
                                                                alt="avatar" 
                                                                loading="lazy" 
                                                                decoding="async" 
                                                                className="w-full h-full object-cover" 
                                                            />
                                                        </div>
                                                        {/* Title block */}
                                                        <div className="min-w-0 flex-1">
                                                            <h4 className="font-semibold text-sm text-slate-800 dark:text-neutral-200 line-clamp-2 leading-snug break-words">
                                                                {activity.isCustomActivity ? (activity.title || activity.placeName) : (activity.placeName || (language === 'de' ? 'Treffen' : 'Meetup'))}
                                                            </h4>
                                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                                {activity.participantIds.length} {language === 'de' ? 'Teilnehmer' : 'Participants'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {/* Rechter Actions-Block */}
                                                    <div className="flex items-start gap-1.5 flex-none self-start">
                                                        <Button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedInfoActivity(activity);
                                                            }}
                                                            variant="ghost"
                                                            size="icon"
                                                            aria-label={language === 'de' ? 'Details zur Aktivität' : 'Activity details'}
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
                        <button 
                            onClick={handleOpenReviewsModal}
                            className="bg-[#fff7ed] dark:bg-amber-950/20 p-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-center border border-amber-100/50 dark:border-amber-900/30 hover:scale-105 active:scale-95 transition-all cursor-pointer group shadow-xs"
                        >
                            <div className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-[#f59e0b] fill-[#f59e0b] group-hover:scale-110 transition-transform" />
                                <span className={cn(
                                    "font-black text-[#854d0e] dark:text-amber-400 text-sm",
                                    placeMeta.avgRating > 0 ? "text-[14px]" : "text-[10px]"
                                )}>
                                    {placeMeta.avgRating > 0 ? placeMeta.avgRating.toFixed(1) : (language === 'de' ? 'Noch keine' : 'No ratings')}
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-amber-900/80 dark:text-amber-400/80 underline decoration-amber-400/40 underline-offset-2">Community</span>
                        </button>
                        <div className="bg-[#f0f9ff] dark:bg-blue-950/20 p-3 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-center border border-blue-100/50 dark:border-blue-900/30">
                             <span className="text-sm font-black text-[#0369a1] dark:text-blue-400">
                                {formattedDistance || '---'}
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
                                aria-pressed={userVote === 'up'}
                                className={cn(
                                    "h-7 rounded-xl flex items-center justify-center transition-[background-color,color,border-color,transform,box-shadow] duration-200 text-[11px] font-black leading-none gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                                    (userProfile?.role === 'admin' || userProfile?.role === 'supporter') ? "px-2" : "w-7",
                                    userVote === 'up'
                                        ? "bg-emerald-600 text-white border border-emerald-500 shadow-md shadow-emerald-500/25 scale-[1.04] active:scale-95"
                                        : "bg-transparent text-emerald-600/50 dark:text-emerald-400/50 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent active:scale-95"
                                )}
                            >
                                <ThumbsUp className="h-3.5 w-3.5 shrink-0" />
                                {(userProfile?.role === 'admin' || userProfile?.role === 'supporter') && (
                                    <span className={cn("text-[10px] font-black", userVote === 'up' ? "text-white opacity-100" : "opacity-70")}>
                                        {(placeMeta.weightedUpvotes || 0) > 0 ? `+${placeMeta.weightedUpvotes}` : '0'}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={(e) => handleVoteClick(e, userVote === 'down' ? 'none' : 'down')}
                                aria-pressed={userVote === 'down'}
                                className={cn(
                                    "h-7 rounded-xl flex items-center justify-center transition-[background-color,color,border-color,transform,box-shadow] duration-200 text-[11px] font-black leading-none gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2",
                                    (userProfile?.role === 'admin' || userProfile?.role === 'supporter') ? "px-2" : "w-7",
                                    userVote === 'down'
                                        ? "bg-rose-600 text-white border border-rose-500 shadow-md shadow-rose-500/25 scale-[1.04] active:scale-95"
                                        : "bg-transparent text-rose-600/50 dark:text-rose-400/50 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-transparent active:scale-95"
                                )}
                            >
                                <ThumbsDown className="h-3.5 w-3.5 shrink-0" />
                                {(userProfile?.role === 'admin' || userProfile?.role === 'supporter') && (
                                    <span className={cn("text-[10px] font-black", userVote === 'down' ? "text-white opacity-100" : "opacity-70")}>
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

            {/* Community Reviews Modal */}
            <Dialog open={isReviewsModalOpen} onOpenChange={setIsReviewsModalOpen}>
                <DialogContent className="sm:max-w-md bg-white dark:bg-neutral-900 rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-amber-50 dark:bg-amber-950/20">
                        <DialogTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-400">
                            <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                            {language === 'de' ? 'Community Bewertungen' : 'Community Reviews'}
                        </DialogTitle>
                        <DialogDescription className="text-amber-800/70 dark:text-amber-400/70 font-medium">
                            {language === 'de' ? `Erfahrungen & Feedback zu ${place.name}` : `Experiences & feedback for ${place.name}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
                        {isLoadingReviews ? (
                            <div className="flex flex-col items-center py-10 gap-2">
                                <Loader2 className="animate-spin text-primary h-6 w-6" />
                                <p className="text-xs font-black uppercase text-slate-400">{language === 'de' ? 'Lade Bewertungen...' : 'Loading reviews...'}</p>
                            </div>
                        ) : placeReviews.length > 0 ? (
                            placeReviews.map((review) => (
                                <div key={review.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800/80 border border-slate-100 dark:border-neutral-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-0.5">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star key={i} className={cn("h-3.5 w-3.5", i < review.rating ? "text-amber-500 fill-amber-500" : "text-slate-200 dark:text-neutral-700")} />
                                            ))}
                                        </div>
                                        {review.createdAt && (
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                {format(review.createdAt.toDate ? review.createdAt.toDate() : new Date(review.createdAt as any), 'dd.MM.yyyy')}
                                            </span>
                                        )}
                                    </div>
                                    {review.comment ? (
                                        <p className="text-sm font-medium text-slate-700 dark:text-neutral-200 leading-relaxed">"{review.comment}"</p>
                                    ) : (
                                        <p className="text-xs italic text-slate-400">{language === 'de' ? 'Kein Textkommentar hinterlassen.' : 'No comment left.'}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 space-y-2">
                                <MessageSquare className="h-10 w-10 text-slate-300 dark:text-neutral-700 mx-auto" />
                                <p className="text-sm font-bold text-slate-500 dark:text-neutral-400">{language === 'de' ? 'Noch keine Bewertungen für diesen Ort.' : 'No reviews for this place yet.'}</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="p-4 bg-slate-50 dark:bg-neutral-800/50">
                        <Button onClick={() => setIsReviewsModalOpen(false)} className="w-full rounded-xl font-black h-12">{language === 'de' ? 'Schließen' : 'Close'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
