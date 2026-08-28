'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { joinActivity, createActivity, normalizeActivityDocument } from '@/lib/firebase/firestore';
import type { Activity, Place, ActivityCategory } from '@/lib/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Compass, X, Check, Info, MapPin, Star, PlusCircle, Plus, RefreshCw, ChevronDown, Loader2, ExternalLink, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CategoryFilters } from '@/components/activa/category-filters';
import { ProximityRadarView } from '@/components/activa/proximity-radar-view';
import { MobileRadarCard } from '@/components/radar/mobile-radar-card';
import { cn, formatLabel } from '@/lib/utils';
import { calculateDistance } from '@/lib/geo-utils';
import { PlaceDetails } from '@/components/activa/place-details';
import { ActivityInfoSheet } from '@/components/activa/activity-info-sheet';
import { CreateActivityDialog } from '@/components/activa/create-activity-dialog';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { getPrimaryIconData, ACTIVITY_EXPIRY_THRESHOLD_MS } from '@/lib/tag-config';
import { usePlanningMode } from '@/contexts/planning-mode-context';
import { useLocation } from '@/contexts/location-context';
import { LocationSearchDialog } from '@/components/common/LocationSearchDialog';

import { DesktopNav } from '@/components/desktop-nav';

const QUARANTINE_THRESHOLD = 3;

export default function ExplorePage() {
    const { user, userProfile } = useAuth();
    const language = useLanguage();
    const { toast } = useToast();
    const router = useRouter();
    const { planningState } = usePlanningMode();

    const [allCards, setAllCards] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activityModalPlace, setActivityModalPlace] = useState<Place | 'custom' | null>(null);
    const animationControls = useAnimation();
    
    const { gateState, isLocating, position, requestLocation } = useLocation();
    const userLocation = useMemo(() => {
      return position ? { lat: position.latitude, lng: position.longitude } : null;
    }, [position]);
    const isLocationLoading = gateState === 'requesting' || gateState === 'checking' || isLocating;
    const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string[]>(['all']);
    const [activeTabId, setActiveTabId] = useState<string>('all');
    const [radiusKm, setRadiusKm] = useState<number | null>(null);
    const [lastSwipedCard, setLastSwipedCard] = useState<Activity | null>(null);
    const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
    const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 640);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const resetFilters = () => {
        setActiveCategory(['all']);
        setActiveTabId('all');
        setRadiusKm(null);
    };

    useEffect(() => {
        if (!db || !user || isLocationLoading) return;

        setIsLoading(true);

        try {
            const collectionRef = collection(db, 'activities');
            const constraints: any[] = [];
            const isCommunityMode = activeCategory.includes('community');

            if (isCommunityMode) {
                constraints.push(where('isCustomActivity', '==', true));
            } else {
                constraints.push(where('status', '==', 'active'));
            }

            const activitiesQuery = query(collectionRef, ...constraints);

            const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
                const now = Date.now();
                const fetchedActivities = snapshot.docs
                    .map(doc => normalizeActivityDocument(doc.data(), doc.id))
                    .filter(act => {
                        if (!act) return false;

                        // Filter out user's own joined activities
                        if (act.participantIds?.includes(user.uid)) return false;

                        // Filter out completed, cancelled, blacklisted status
                        if (act.status === 'completed' || act.status === 'cancelled' || act.status === 'blacklisted') {
                            return false;
                        }

                        // Filter out hosts that the user blocked (soft/hard blacklist)
                        const hostId = act.hostId;
                        if (hostId && userProfile?.blacklist) {
                            const hardBlocked = userProfile.blacklist.hard || [];
                            const softBlocked = userProfile.blacklist.soft || [];
                            if (hardBlocked.includes(hostId) || softBlocked.includes(hostId)) {
                                return false;
                            }
                        }

                        // Filter out past activities
                        if (act.activityEndDate?.toMillis) {
                            if (act.activityEndDate.toMillis() < now) return false;
                        } else if (act.activityDate?.toMillis) {
                            if (act.activityDate.toMillis() + ACTIVITY_EXPIRY_THRESHOLD_MS < now) return false;
                        }

                        // Quarantine threshold
                        if ((act.reportCount || 0) >= QUARANTINE_THRESHOLD) return false;

                        return true;
                    });
                
                fetchedActivities.sort((a, b) => {
                    if (a.isBoosted && !b.isBoosted) return -1;
                    if (!a.isBoosted && b.isBoosted) return 1;
                    
                    if (userLocation && a.lat && a.lon && b.lat && b.lon) {
                      const distA = calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lon);
                      const distB = calculateDistance(userLocation.lat, userLocation.lng, b.lat, b.lon);
                      return distA - distB;
                    }

                    const timeA = a.activityDate?.toMillis() || 0;
                    const timeB = b.activityDate?.toMillis() || 0;
                    return timeA - timeB;
                });

                setAllCards(fetchedActivities.reverse());
                setIsLoading(false);
            }, (error) => {
                console.error("FIRESTORE ERROR:", error.message);
                toast({
                    variant: "destructive",
                    title: language === 'de' ? "Fehler beim Laden" : "Error loading activities",
                    description: language === 'de' ? "Aktivitäten konnten nicht geladen werden." : "Failed to load activities."
                });
                setIsLoading(false);
            });

            return () => unsubscribe();
        } catch (err: any) {
            console.error("Activities listener failed:", err.message);
            setIsLoading(false);
        }
    }, [user, activeCategory, userLocation, userProfile, language, toast]);
    
    const handleCreateActivity = async (
        startDate: Date, 
        endDate: Date | undefined, 
        isTimeFlexible: boolean, 
        customLocationName?: string, 
        maxParticipants?: number, 
        isBoosted?: boolean,
        isPaid?: boolean,
        price?: number,
        category?: ActivityCategory,
        description?: string,
        requirements?: any,
        joinMode?: 'direct' | 'request'
    ): Promise<boolean> => {
        if (!user || !activityModalPlace) return false;
        try {
            await createActivity({
                place: activityModalPlace === 'custom' ? undefined : activityModalPlace as Place,
                customLocationName,
                startDate,
                endDate,
                user,
                isTimeFlexible,
                maxParticipants,
                isBoosted,
                isPaid,
                price,
                category: category || (language === 'de' ? 'Sonstiges' : 'Other') as ActivityCategory,
                description,
                requirements,
                joinMode
            });
            toast({ title: language === 'de' ? "Aktivität erstellt!" : "Activity created!", description: language === 'de' ? "Viel Spaß!" : "Have fun!" });
            setActivityModalPlace(null);
            return true;
        } catch (err: any) {
            toast({ variant: 'destructive', title: language === 'de' ? "Fehler" : "Error", description: err.message });
            return false;
        }
    };

    const visibleCards = useMemo(() => {
        let filtered = allCards;

        if (activeCategory.includes('women_only')) {
             filtered = filtered.filter(activity => {
                 const genders = activity.requirements?.gender;
                 return Array.isArray(genders) && genders.length === 1 && genders[0] === 'female';
             });
        } else if (activeCategory.includes('men_only')) {
             filtered = filtered.filter(activity => {
                 const genders = activity.requirements?.gender;
                 return Array.isArray(genders) && genders.length === 1 && genders[0] === 'male';
             });
        } else if (activeCategory.includes('diverse_only')) {
             filtered = filtered.filter(activity => {
                 const genders = activity.requirements?.gender;
                 return Array.isArray(genders) && genders.length === 1 && genders[0] === 'diverse';
             });
        } else if (activeCategory.includes('custom_gender')) {
             filtered = filtered.filter(activity => {
                 const genders = activity.requirements?.gender;
                 return Array.isArray(genders) && genders.length > 0 && genders.length < 3;
             });
        } else if (activeCategory[0] !== 'all' && activeCategory[0] !== 'favorites') { 
             filtered = filtered.filter(activity => {
                 if (!activity.categories) return false;
                 if (activeCategory.length > 1) {
                     return activity.categories.some(cat => activeCategory.includes(cat));
                 }
                 return activity.categories.includes(activeCategory[0]);
             });
        }

        if (radiusKm !== null && userLocation) {
            filtered = filtered.filter(activity => {
                if (!activity.lat || !activity.lon) return false; 
                const distance = calculateDistance(userLocation.lat, userLocation.lng, activity.lat, activity.lon);
                return distance <= radiusKm;
            });
        }
        
        return filtered.filter(card => !userProfile?.hiddenEntityIds?.includes(card.id!));
    }, [allCards, activeCategory, radiusKm, userLocation, userProfile]);
    
    const [cards, setCards] = useState<Activity[]>([]);
    useEffect(() => {
        const newCards = visibleCards.filter(c => !swipedIds.has(c.id!));
        setCards(newCards);
    }, [visibleCards, swipedIds]);

    const handleSwipe = (direction: 'left' | 'right') => {
        if (cards.length === 0) return;

        const topCard = cards[cards.length - 1];
        if (!topCard || !topCard.id) return;
        const topCardId = topCard.id;

        const exitX = direction === 'left' ? -500 : 500;

        animationControls.start({
            x: exitX,
            rotate: direction === 'left' ? -15 : 15,
            opacity: 0,
            transition: { duration: 0.4, ease: 'easeOut' }
        });

        const removeCard = () => {
             setSwipedIds(prev => new Set(prev).add(topCardId));
             setCards(prev => prev.filter(c => c.id !== topCardId));
        }

        if (direction === 'right') {
             if (!user) {
                router.push('/login');
                return;
            }

            if (topCard.isPaid && topCard.price && topCard.price > 0) {
                router.push(`/checkout/${topCardId}`);
                return;
            }

             joinActivity(topCardId, user, null, null, topCard.joinMode)
                .then((status) => {
                    if (status === 'requested') {
                        toast({ title: language === 'de' ? 'Anfrage gesendet!' : 'Request sent!', description: language === 'de' ? 'Der Host wird benachrichtigt.' : 'The host will be notified.' });
                    } else {
                        toast({ title: language === 'de' ? 'Aktivität beigetreten!' : 'Activity joined!', description: language === 'de' ? 'Du findest sie jetzt in deinen Chats.' : 'You can find it in your chats now.' });
                    }
                    setTimeout(removeCard, 200);
                })
                .catch((error) => {
                    console.error(error);
                    toast({ title: language === 'de' ? 'Fehler' : 'Error', description: error.message || (language === 'de' ? 'Beitritt fehlgeschlagen.' : 'Joining failed.'), variant: 'destructive' });
                    animationControls.start({ x: 0, rotate: 0, opacity: 1, transition: { duration: 0.4 }});
                });
        } else {
            setLastSwipedCard(topCard);
            setTimeout(removeCard, 200);
        }
    };

    const handleUndo = () => {
        if (!lastSwipedCard) return;
        setCards(prev => [...prev, lastSwipedCard]);
        setLastSwipedCard(null);
    };

    const handleJoinFromSheet = async (activityToJoin: Activity) => {
        if (!user) {
            router.push('/login');
            return;
        }
        if (activityToJoin.isPaid && activityToJoin.price && activityToJoin.price > 0) {
            router.push(`/checkout/${activityToJoin.id}`);
            return;
        }
        try {
            const status = await joinActivity(activityToJoin.id!, user, null, null, activityToJoin.joinMode);
            if (status === 'requested') {
                toast({ 
                    title: language === 'de' ? 'Anfrage gesendet!' : 'Request sent!', 
                    description: language === 'de' ? 'Der Host wird benachrichtigt.' : 'The host will be notified.' 
                });
            } else {
                toast({ 
                    title: language === 'de' ? 'Aktivität beigetreten!' : 'Activity joined!', 
                    description: language === 'de' ? 'Du findest sie jetzt in deinen Chats.' : 'You can find it in your chats now.' 
                });
            }
            setSwipedIds(prev => new Set(prev).add(activityToJoin.id!));
            setCards(prev => prev.filter(c => c.id !== activityToJoin.id));
        } catch (error: any) {
            toast({ 
                title: language === 'de' ? 'Fehler' : 'Error', 
                description: error.message || (language === 'de' ? 'Beitritt fehlgeschlagen.' : 'Joining failed.'), 
                variant: 'destructive' 
            });
            throw error;
        }
    };
    
    const onDragEnd = (event: any, info: any) => {
      const { offset } = info;
      const swipeThreshold = 80;
      if (offset.x > swipeThreshold) handleSwipe('right');
      else if (offset.x < -swipeThreshold) handleSwipe('left');
    };

    const [dragX, setDragX] = useState(0);

    return (
        <div className="flex h-full w-full pb-bottom-nav-safe lg:pb-0 flex-col lg:flex-row bg-[#fdfdfd] dark:bg-neutral-950 overflow-hidden font-jakarta">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-[320px] shrink-0 border-r border-slate-100 dark:border-neutral-900 bg-white dark:bg-neutral-900 flex-col overflow-y-auto">
                <div className="p-8 space-y-12">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                            <Compass className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="truncate">{language === 'de' ? 'Erkunden' : 'Explore'}</h1>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="truncate">Activa Radar</h3>
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        </div>
                        <div className="bg-slate-50/50 dark:bg-neutral-800/30 rounded-[2.25rem] p-5 border border-slate-50 dark:border-neutral-800/50">
                            <ProximityRadarView />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="truncate">{language === 'de' ? 'Präferenzen' : 'Preferences'}</h3>
                        <div className="flex flex-col gap-6">
                            <CategoryFilters 
                                activeCategory={activeCategory} 
                                activeTabId={activeTabId}
                                onCategoryChange={(cats, tabId) => {
                                    setActiveCategory(cats);
                                    setActiveTabId(tabId);
                                }} 
                                vertical
                            />
                        </div>
                    </div>
                </div>
            </aside>
            
            <main className="flex-1 flex flex-col min-h-0 relative w-full overflow-hidden">
                {/* Header */}
                <header className="global-viewport-header">
                    <div className="global-header-container">
                        <div className="flex items-center gap-2 min-w-0">
                            <h1 className="truncate">{language === 'de' ? 'Aktivitäten' : 'Activities'}</h1>
                            <Compass className="h-6 w-6 text-orange-500 shrink-0" />
                        </div>
                        <DesktopNav />
                        <div className="flex items-center gap-3 shrink-0">
                            <NotificationBell />
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex flex-col min-h-0 relative px-4 lg:px-0">
                    {/* Mobile Filters Area */}
                    <div className="lg:hidden py-3 space-y-3">
                         <CategoryFilters 
                            activeCategory={activeCategory} 
                            activeTabId={activeTabId}
                            onCategoryChange={(cats, tabId) => {
                                setActiveCategory(cats);
                                setActiveTabId(tabId);
                            }} 
                         />
                         <div className="flex items-center justify-between px-1">
                            <DropdownMenu>
                                <DropdownMenuTrigger className="outline-none">
                                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-neutral-900 rounded-full py-1.5 px-3 active:scale-95 transition-transform">
                                        <MapPin className="h-2.5 w-2.5 text-rose-400" />
                                        <span className="text-[10px] font-extrabold text-slate-600">{radiusKm === null ? (language === 'de' ? 'Überall' : 'Everywhere') : `< ${radiusKm} km`}</span>
                                        <ChevronDown className="h-3 w-3 text-slate-400" />
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 p-4 rounded-3xl border-none shadow-2xl ml-4 z-[9999]">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center"><span className="text-xs font-black uppercase text-slate-400">{language === 'de' ? 'Radius' : 'Radius'}</span><span className="text-sm font-black">{radiusKm === null ? '∞' : `${radiusKm} km`}</span></div>
                                        <input type="range" min="1" max="100" value={radiusKm || 100} onChange={(e) => setRadiusKm(parseInt(e.target.value) === 100 ? null : parseInt(e.target.value))} className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                                        <div className="grid grid-cols-4 gap-2">
                                            {[5, 10, 25, null].map((r) => (
                                                <button key={r === null ? 'all' : r} onClick={() => setRadiusKm(r)} aria-pressed={radiusKm === r} className={cn("py-2 rounded-xl text-[10px] font-black transition-all", radiusKm === r ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}>{r === null ? 'Alle' : `${r}k`}</button>
                                            ))}
                                        </div>
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'de' ? 'Radar aktiv' : 'Radar active'}</span>
                            </div>
                         </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-between relative min-h-0 py-1 sm:py-3 w-full">
                        {userLocation && (
                          <div className="lg:hidden w-full max-w-[400px] mb-2 shrink-0 px-1">
                            <MobileRadarCard />
                          </div>
                        )}
                        {!userLocation ? (
                            isLocationLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <div className="relative w-12 h-12 animate-pulse">
                                        <Image src="/assets/logo-heart.png" alt="Activa" fill sizes="48px" className="object-contain" />
                                    </div>
                                    <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-neutral-400">
                                        {language === 'de' ? 'Standort wird ermittelt...' : 'Determining location...'}
                                    </p>
                                </div>
                            ) : (
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
                                >
                                    <div className="w-24 h-24 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                        <MapPin className="h-10 w-10 text-rose-500" strokeWidth={1.5} />
                                    </div>
                                    <h3 className="text-xl font-black mb-2 text-slate-800 dark:text-neutral-200">
                                        {language === 'de' ? 'Standort erforderlich' : 'Location Required'}
                                    </h3>
                                    <p className="text-sm text-slate-500 dark:text-neutral-400 mb-8 max-w-[260px]">
                                        {language === 'de' 
                                          ? 'Activa benötigt deinen Standort, um spannende Aktivitäten in deiner Nähe anzuzeigen.' 
                                          : 'Activa requires your location to display exciting activities near you.'}
                                    </p>
                                    
                                    <div className="w-full max-w-[240px] space-y-3">
                                        <Button 
                                            onClick={() => setIsLocationSearchOpen(true)}
                                            className="bg-primary hover:bg-primary/95 text-white rounded-full px-8 py-5 h-auto text-sm font-bold shadow-lg shadow-emerald-200/50 w-full"
                                        >
                                            {language === 'de' ? 'Ort manuell suchen' : 'Search location manually'}
                                        </Button>
                                        
                                        <Button 
                                            variant="ghost"
                                            onClick={() => requestLocation({ interactive: true })}
                                            className="w-full h-12 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-neutral-200 font-bold"
                                        >
                                            {language === 'de' ? 'GPS erneut versuchen' : 'Retry GPS'}
                                        </Button>
                                    </div>
                                </motion.div>
                            )
                        ) : (
                            <div className="relative w-full max-w-[320px] xs:max-w-[350px] sm:max-w-[420px] aspect-[3.3/5] max-h-[min(390px,44vh)] sm:max-h-[540px] my-auto">
                              <AnimatePresence mode="popLayout">
                                  {cards.slice(-3).map((card, index) => {
                                      const displayedIndex = cards.length - cards.slice(-3).length + index;
                                      const isTopCard = displayedIndex === cards.length - 1;
                                      const distance = (userLocation && card.lat && card.lon) 
                                        ? calculateDistance(userLocation.lat, userLocation.lng, card.lat, card.lon)
                                        : null;

                                      const primaryStyle = getPrimaryIconData({ 
                                          categories: (card.categories || []).filter(c => c !== 'user_event'), 
                                          name: card.placeName || "",
                                          sourceType: card.sourceType,
                                          isUserEvent: card.isUserEvent,
                                          creationSource: card.creationSource
                                      }, language);
                                      const PrimaryIcon = primaryStyle.icon;

                                      return (
                                          <motion.div
                                              key={card.id}
                                              onClick={() => {
                                                  if (isTopCard && Math.abs(dragX) < 10) {
                                                      setSelectedActivity(card);
                                                  }
                                              }}
                                              className={cn(
                                                "absolute inset-0 bg-white dark:bg-neutral-900 rounded-[2rem] sm:rounded-[2.5rem] elevation-high border-none overflow-hidden flex flex-col transition-shadow duration-300",
                                                isTopCard && "cursor-pointer select-none"
                                              )}
                                              style={{ 
                                                  zIndex: isTopCard ? 5 : (1 + index),
                                                  x: isTopCard ? 0 : (cards.length - 1 - displayedIndex) * 8,
                                                  rotate: isTopCard ? 0 : (cards.length - 1 - displayedIndex) * 2,
                                                  scale: isTopCard ? 1 : 1 - (cards.length - 1 - displayedIndex) * 0.04
                                              }}
                                              initial={{ scale: 0.9, opacity: 0 }}
                                              animate={isTopCard ? { 
                                                  opacity: 1, 
                                                  scale: 1, 
                                                  x: 0, 
                                                  y: 0,
                                                  rotate: 0,
                                                  transition: { duration: 0.2 } 
                                              } : {
                                                  opacity: 1,
                                                  scale: 1 - (cards.length - 1 - displayedIndex) * 0.04,
                                                  y: (cards.length - 1 - displayedIndex) * 15,
                                                  x: (cards.length - 1 - displayedIndex) * (index % 2 === 0 ? 5 : -5),
                                                  rotate: (cards.length - 1 - displayedIndex) * (index % 2 === 0 ? 2 : -2),
                                              }}
                                              whileDrag={{ scale: 1.02, opacity: 1, zIndex: 10 }}
                                              exit={{ x: dragX > 0 ? 1000 : -1000, opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                                              transition={{ type: "spring", stiffness: 400, damping: 40 }}
                                              drag={isTopCard ? "x" : false}
                                              dragConstraints={{ left: 0, right: 0 }}
                                              onDrag={(e, info) => isTopCard && setDragX(info.offset.x)}
                                              onDragEnd={isTopCard ? (e, info) => {
                                                  setDragX(0);
                                                  onDragEnd(e, info);
                                              } : undefined}
                                          >
                                              {/* Swipe Overlays */}
                                              {isTopCard && (
                                                  <>
                                                      <motion.div 
                                                          style={{ opacity: Math.min(dragX / 150, 0.8) }}
                                                          className="absolute inset-0 z-50 pointer-events-none bg-emerald-500/20 flex items-center justify-center"
                                                      >
                                                          <div className="border-8 border-emerald-500 rounded-2xl px-8 py-4 rotate-[-15deg] scale-125">
                                                              <span className="text-5xl font-black text-emerald-500 uppercase tracking-tighter">LIKE</span>
                                                          </div>
                                                      </motion.div>
                                                      <motion.div 
                                                          style={{ opacity: Math.min(-dragX / 150, 0.8) }}
                                                          className="absolute inset-0 z-50 pointer-events-none bg-rose-500/20 flex items-center justify-center"
                                                      >
                                                          <div className="border-8 border-rose-500 rounded-2xl px-8 py-4 rotate-[15deg] scale-125">
                                                              <span className="text-5xl font-black text-rose-500 uppercase tracking-tighter">NOPE</span>
                                                          </div>
                                                      </motion.div>
                                                  </>
                                              )}
                                              <div className={cn("flex-1 flex flex-col bg-white dark:bg-neutral-900", !isTopCard && "pointer-events-none")}>
                                              <div className={cn("h-[62%] w-full relative overflow-hidden bg-slate-200", !isTopCard && "pointer-events-none")}>
                                                      {card.imageUrl ? (
                                                          <img 
                                                              src={card.imageUrl} 
                                                              alt={card.placeName} 
                                                              loading="lazy"
                                                              decoding="async"
                                                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                                          />
                                                      ) : (
                                                          <div className={cn("absolute inset-0 flex items-center justify-center overflow-hidden", primaryStyle.gradientClass || "bg-gradient-to-br from-[#bfc6e8] to-[#9fa9d1]")}>
                                                              <div className="absolute inset-0 opacity-[0.15] flex items-center justify-center transform scale-150">
                                                                  <PrimaryIcon className="w-64 h-64 text-white" />
                                                              </div>
                                                              <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
                                                              <div className="relative z-10 p-5 bg-white/20 backdrop-blur-md rounded-3xl border border-white/30 shadow-xl flex flex-col items-center gap-2 transform -translate-y-4 transition-transform group-hover:scale-105 group-hover:-translate-y-6">
                                                                  <PrimaryIcon className="h-12 w-12 text-white drop-shadow-md" />
                                                                  <span className="text-white font-black text-[10px] tracking-[0.2em] uppercase drop-shadow">{primaryStyle.label}</span>
                                                              </div>
                                                          </div>
                                                      )}

                                                      <div className="absolute top-5 left-5 flex gap-2 z-10">
                                                          <div className="bg-amber-400 text-white text-[10px] font-black px-3 h-7 flex items-center rounded-full shadow-lg">
                                                              <Star className="h-3 w-3 fill-current mr-1" />
                                                              {language === 'de' ? 'Neu' : 'New'}
                                                          </div>
                                                          <div className="bg-white/90 backdrop-blur-md text-neutral-600 text-[10px] font-bold px-3 h-7 flex items-center rounded-full shadow-sm capitalize">
                                                              {formatLabel(card.categories?.[0] || (language === 'de' ? 'Aktivität' : 'Activity'))}
                                                          </div>
                                                      </div>

                                                      {distance !== null && (
                                                          <div className="absolute top-5 right-10 z-10">
                                                              <div className="bg-black/50 backdrop-blur-md text-white text-[10px] font-black px-3 h-7 flex items-center rounded-full">
                                                                  {distance < 1 ? '< 1 km' : `${distance.toFixed(1)} km`}
                                                              </div>
                                                          </div>
                                                      )}

                                                      <div className="absolute inset-x-0 bottom-0 p-6 pb-8 pt-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none">
                                                          <h2 className="text-white font-black drop-shadow-md">{card.title || card.placeName || (language === 'de' ? 'Treffen' : 'Meetup')}</h2>
                                                          <div className="flex items-center gap-2 text-white/90 font-bold mt-1">
                                                              <MapPin className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
                                                              <p className="text-[12px] truncate tracking-wide">{card.placeAddress || (language === 'de' ? 'In deiner Umgebung' : 'In your area')}</p>
                                                          </div>
                                                      </div>
                                                  </div>

                                                  <div className="flex-1 p-6 flex flex-col justify-around bg-white dark:bg-neutral-900">
                                                      <div className="grid grid-cols-3 gap-2 px-1">
                                                           <div className="bg-slate-50 dark:bg-neutral-800/80 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center border border-slate-100 dark:border-neutral-800">
                                                               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{language === 'de' ? 'Wann' : 'When'}</span>
                                                               <span className="text-[11px] font-black text-[#0f172a] dark:text-neutral-200">
                                                                   {format(card.activityDate.toDate(), language === 'de' ? "eee, d. MMM" : "eee, MMM d", { locale: language === 'de' ? de : enUS })}
                                                               </span>
                                                           </div>
                                                           <div className="bg-slate-50 dark:bg-neutral-800/80 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center border border-slate-100 dark:border-neutral-800">
                                                               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{language === 'de' ? 'Uhrzeit' : 'Time'}</span>
                                                               <span className="text-[11px] font-black text-[#0f172a] dark:text-neutral-200">{language === 'de' ? 'Flexibel' : 'Flexible'}</span>
                                                           </div>
                                                           <div className="bg-slate-50 dark:bg-neutral-800/80 rounded-2xl p-2.5 flex flex-col items-center justify-center text-center border border-slate-100 dark:border-neutral-800">
                                                               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{language === 'de' ? 'Plätze' : 'Spots'}</span>
                                                               <span className="text-emerald-600">
                                                                   {(card.maxParticipants || 10) - card.participantIds.length} {language === 'de' ? 'frei' : 'free'}
                                                               </span>
                                                           </div>
                                                      </div>
                                                      <div className="flex justify-center space-x-3 p-0.5 items-center">
                                                              {/* Host Avatar */}
                                                              {(() => {
                                                                  const hostDetails = card.participantDetails?.[card.hostId];
                                                                  return (
                                                                      <ProfileAvatar 
                                                                          className="h-10 w-10 border-2 border-white dark:border-neutral-900 shadow-md"
                                                                          photoURL={card.hostPhotoURL}
                                                                          displayName={card.hostName}
                                                                          isPremium={hostDetails?.isPremium}
                                                                          isCreator={hostDetails?.isCreator}
                                                                          isSupporter={hostDetails?.isSupporter}
                                                                      />
                                                                  )
                                                              })()}
                                                              
                                                              {/* Participant Avatars (max 3 slots) */}
                                                              {[0, 1, 2].map((i) => {
                                                                  const participant = (card.participantsPreview || [])
                                                                      .filter(p => p.uid !== card.hostId)[i];
                                                                  
                                                                  if (participant) {
                                                                      const pDetails = card.participantDetails?.[participant.uid];
                                                                      return (
                                                                          <ProfileAvatar 
                                                                              key={participant.uid} 
                                                                              className="h-10 w-10 border-2 border-white dark:border-neutral-900 shadow-md"
                                                                              photoURL={participant.photoURL}
                                                                              displayName={participant.displayName}
                                                                              isPremium={pDetails?.isPremium}
                                                                              isCreator={pDetails?.isCreator}
                                                                              isSupporter={pDetails?.isSupporter}
                                                                          />
                                                                      );
                                                                  }

                                                                  {/* Placeholder for empty slots */}
                                                                  return (
                                                                      <div key={`empty-${i}`} className="h-10 w-10 rounded-full border-2 border-white dark:border-neutral-900 bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center shadow-sm">
                                                                          <Plus className="h-4 w-4 text-neutral-300" />
                                                                      </div>
                                                                  )
                                                              })}
                                                          </div>
                                                      </div>
                                              </div>
                                          </motion.div>
                                      )
                                  })}
                              </AnimatePresence>

                              {!isLoading && cards.length === 0 && (
                                  <motion.div 
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
                                  >
                                      <div className="w-24 h-24 bg-orange-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                          <PlusCircle className="h-10 w-10 text-orange-500" strokeWidth={1.5} />
                                      </div>
                                      <h3 className="">{language === 'de' ? 'Alles entdeckt!' : 'Everything discovered!'}</h3>
                                      <p className="text-sm text-slate-500 dark:text-neutral-400 mb-8 max-w-[240px]">
                                          {language === 'de' ? 'Aktuell gibt es keine weiteren Aktivitäten in deiner Nähe. Starte doch einfach selbst etwas!' : 'Currently there are no more activities near you. Why not start something yourself!'}
                                      </p>
                                      <Button 
                                          onClick={() => setActivityModalPlace('custom')}
                                          className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-8 py-6 h-auto text-base font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all w-full max-w-[200px]"
                                      >
                                          <Plus className="h-5 w-5 mr-2" />
                                          {language === 'de' ? 'Erstellen' : 'Create'}
                                      </Button>
                                      <button 
                                          onClick={() => {
                                              setSwipedIds(new Set());
                                              resetFilters();
                                          }}
                                          className="mt-4 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300 flex items-center gap-1.5 transition-colors"
                                      >
                                          <RefreshCw className="h-3 w-3" />
                                          {language === 'de' ? 'Liste aktualisieren' : 'Refresh list'}
                                      </button>
                                  </motion.div>
                              )}
                            </div>
                        )}

                        {/* Action Buttons */}
                        {cards.length > 0 && !isLoading && (
                            <div className="w-full shrink-0 pt-1 pb-1 mb-2 sm:mb-3 flex items-center justify-center z-20 pointer-events-none">
                                <motion.div 
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    className="bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl px-5 py-2 rounded-[2.5rem] flex items-center gap-5 shadow-[0_15px_35px_rgba(0,0,0,0.25)] border border-white/20 dark:border-neutral-800 pointer-events-auto"
                                >
                                    <motion.button 
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleSwipe('left')}
                                        aria-label={language === 'de' ? 'Aktivität ablehnen' : 'Reject activity'}
                                        className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 flex items-center justify-center shadow-inner transition-colors hover:bg-rose-100"
                                    >
                                        <X className="h-5 w-5 sm:h-6 sm:w-6 stroke-[3]"/>
                                    </motion.button>

                                    <motion.button 
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => {
                                            const topCard = cards[cards.length - 1];
                                            if (topCard) setSelectedActivity(topCard);
                                        }}
                                        aria-label={language === 'de' ? 'Details anzeigen' : 'Show details'}
                                        className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-400 flex items-center justify-center transition-colors hover:bg-slate-200"
                                    >
                                        <Info className="h-4 w-4 sm:h-5 sm:w-5 stroke-[3]"/>
                                    </motion.button>

                                    <motion.button 
                                        whileHover={{ scale: 1.15 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleSwipe('right')}
                                        aria-label={language === 'de' ? 'Aktivität beitreten' : 'Join activity'}
                                        className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_10px_25px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-600 active:shadow-none"
                                    >
                                        <Check className="h-6 w-6 sm:h-7 sm:w-7 stroke-[3]"/>
                                    </motion.button>
                                </motion.div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Desktop Right Preview Sidebar */}
            <aside className="hidden xl:flex w-[340px] 2xl:w-[380px] shrink-0 border-l border-slate-100 dark:border-neutral-900 bg-white dark:bg-neutral-900 flex-col overflow-y-auto p-6 gap-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-rose-500" />
                        <h3 className="font-black text-slate-900 dark:text-neutral-100 text-sm">
                            {language === 'de' ? 'Vorschau & Ort' : 'Preview & Location'}
                        </h3>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                        {language === 'de' ? 'Top Karte' : 'Top Card'}
                    </span>
                </div>

                {(() => {
                    const topCard = cards[cards.length - 1];
                    if (!topCard) {
                        return (
                            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-neutral-800/30 rounded-3xl border border-slate-100 dark:border-neutral-800/50 gap-3 my-auto">
                                <Compass className="h-10 w-10 text-slate-300 dark:text-neutral-600" />
                                <p className="text-xs font-bold text-slate-400 dark:text-neutral-500">
                                    {language === 'de' ? 'Keine weiteren Karten zum Anzeigen.' : 'No more cards to preview.'}
                                </p>
                            </div>
                        );
                    }

                    const topDistance = (userLocation && topCard.lat && topCard.lon)
                        ? calculateDistance(userLocation.lat, userLocation.lng, topCard.lat, topCard.lon)
                        : null;

                    return (
                        <div className="flex flex-col gap-5">
                            {/* Map Preview Embed */}
                            <div className="relative h-44 w-full rounded-3xl overflow-hidden border border-slate-100 dark:border-neutral-800 bg-slate-100 dark:bg-neutral-800 group shadow-sm">
                                {topCard.lat && topCard.lon ? (
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        loading="lazy"
                                        allowFullScreen
                                        referrerPolicy="no-referrer-when-downgrade"
                                        src={`https://maps.google.com/maps?q=${topCard.lat},${topCard.lon}&z=14&output=embed`}
                                        className="w-full h-full border-0 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-neutral-800 dark:to-neutral-900">
                                        <MapPin className="h-8 w-8 text-slate-400 opacity-50" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(topCard.placeAddress || topCard.placeName || '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute bottom-3 left-3 right-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-3 py-2 rounded-2xl text-xs font-bold text-slate-800 dark:text-neutral-200 flex items-center justify-between shadow-md hover:bg-white dark:hover:bg-neutral-900 transition-all"
                                >
                                    <span className="truncate pr-2">{topCard.placeAddress || topCard.placeName}</span>
                                    <ExternalLink className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                                </a>
                            </div>

                            {/* Card Quick Info */}
                            <div className="bg-slate-50/70 dark:bg-neutral-800/40 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800/60 flex flex-col gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-amber-400 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase">
                                            {formatLabel(topCard.categories?.[0] || (language === 'de' ? 'Aktivität' : 'Activity'))}
                                        </span>
                                        {topDistance !== null && (
                                            <span className="text-[10px] font-extrabold text-slate-400">
                                                {topDistance < 1 ? '< 1 km' : `${topDistance.toFixed(1)} km`}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-black text-base text-slate-900 dark:text-neutral-100 leading-snug">
                                        {topCard.title || topCard.placeName}
                                    </h4>
                                    {topCard.placeAddress && (
                                        <p className="text-xs font-bold text-slate-400 dark:text-neutral-400 truncate mt-0.5">
                                            {topCard.placeAddress}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                                    <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-2xl border border-slate-100 dark:border-neutral-800/80 flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{language === 'de' ? 'Datum' : 'Date'}</span>
                                        <span className="text-slate-800 dark:text-neutral-200 mt-0.5 truncate">
                                            {format(topCard.activityDate.toDate(), language === 'de' ? "eee, d. MMM" : "eee, MMM d", { locale: language === 'de' ? de : enUS })}
                                        </span>
                                    </div>
                                    <div className="bg-white dark:bg-neutral-900 p-2.5 rounded-2xl border border-slate-100 dark:border-neutral-800/80 flex flex-col">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{language === 'de' ? 'Freie Plätze' : 'Free spots'}</span>
                                        <span className="text-emerald-600 mt-0.5 font-black">
                                            {(topCard.maxParticipants || 10) - topCard.participantIds.length} {language === 'de' ? 'frei' : 'free'}
                                        </span>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => setSelectedActivity(topCard)}
                                    className="w-full rounded-2xl bg-slate-900 dark:bg-neutral-100 hover:bg-slate-800 dark:hover:bg-neutral-200 text-white dark:text-slate-900 font-extrabold text-xs py-3.5 h-auto transition-all shadow-md active:scale-95"
                                >
                                    <Info className="h-4 w-4 mr-2" />
                                    {language === 'de' ? 'Details öffnen' : 'Open Details'}
                                </Button>
                            </div>
                        </div>
                    );
                })()}
            </aside>

            {/* Activity Details Overlay */}
            <ActivityInfoSheet
                activity={selectedActivity}
                open={!!selectedActivity}
                onOpenChange={(open) => !open && setSelectedActivity(null)}
                onJoin={handleJoinFromSheet}
            />

            <CreateActivityDialog 
                place={activityModalPlace === 'custom' ? null : activityModalPlace} 
                open={!!activityModalPlace} 
                onOpenChange={(open) => !open && setActivityModalPlace(null)} 
                onCreateActivity={handleCreateActivity} 
            />
            <LocationSearchDialog 
                open={isLocationSearchOpen} 
                onOpenChange={setIsLocationSearchOpen} 
            />
        </div>
    );
}
