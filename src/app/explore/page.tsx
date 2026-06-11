'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { joinActivity, createActivity, normalizeActivityDocument } from '@/lib/firebase/firestore';
import type { Activity, Place, ActivityCategory } from '@/lib/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from '@/components/ui/dropdown-menu';
import { Compass, X, Check, Info, MapPin, Star, PlusCircle, Plus, RefreshCw, ChevronDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CategoryFilters } from '@/components/aktiva/category-filters';
import { ProximityRadarView } from '@/components/aktiva/proximity-radar-view';
import { cn, formatLabel } from '@/lib/utils';
import { calculateDistance } from '@/lib/geo-utils';
import { PlaceDetails } from '@/components/aktiva/place-details';
import { CreateActivityDialog } from '@/components/aktiva/create-activity-dialog';
import { ProfileAvatar } from '@/components/ui/profile-avatar';
import { getPrimaryIconData } from '@/lib/tag-config';
import { usePlanningMode } from '@/contexts/planning-mode-context';
import { LocationSearchDialog } from '@/components/common/LocationSearchDialog';

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
    
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isLocationLoading, setIsLocationLoading] = useState(true);
    const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string[]>(['all']);
    const [activeTabId, setActiveTabId] = useState<string>('all');
    const [radiusKm, setRadiusKm] = useState<number | null>(null);
    const [lastSwipedCard, setLastSwipedCard] = useState<Activity | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<Activity | null>(null);
    const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());

    const resetFilters = () => {
        setActiveCategory(['all']);
        setActiveTabId('all');
        setRadiusKm(null);
    };

    // React to manual search destination selection
    useEffect(() => {
        if (planningState.isPlanning && planningState.destination) {
            setUserLocation(planningState.destination);
            setIsLocationLoading(false);
        }
    }, [planningState]);

    useEffect(() => {
        if (userLocation) return;

        // 1. Check cached location for instant boot
        const cached = localStorage.getItem('aktiva_last_location');
        if (cached) {
            try {
                const { lat, lng } = JSON.parse(cached);
                if (typeof lat === 'number' && typeof lng === 'number') {
                    setUserLocation({ lat, lng });
                    setIsLocationLoading(false);
                    return;
                }
            } catch (e) {
                localStorage.removeItem('aktiva_last_location');
            }
        }

        // 2. Fallback to profile location
        if (userProfile?.lastLocation) {
            const { lat, lng } = userProfile.lastLocation;
            if (typeof lat === 'number' && typeof lng === 'number') {
                setUserLocation({ lat, lng });
                setIsLocationLoading(false);
                return;
            }
        }

        // 3. Try Geolocation
        setIsLocationLoading(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const loc = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setUserLocation(loc);
                    localStorage.setItem('aktiva_last_location', JSON.stringify({
                        ...loc,
                        timestamp: Date.now()
                    }));
                    setIsLocationLoading(false);
                },
                (error) => {
                    console.warn('Geolocation error in /explore, no fallback available:', error);
                    setIsLocationLoading(false);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
        } else {
            setIsLocationLoading(false);
        }
    }, [userProfile?.lastLocation, userLocation]);

    useEffect(() => {
        if (!db || !user) return;

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
                            if (act.activityDate.toMillis() + 86400000 < now) return false;
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

        if (activeCategory[0] !== 'all' && activeCategory[0] !== 'favorites') { 
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

             joinActivity(topCardId, user)
                .then(() => {
                    toast({ title: language === 'de' ? 'Aktivität beigetreten!' : 'Activity joined!', description: language === 'de' ? 'Du findest sie jetzt in deinen Chats.' : 'You can find it in your chats now.' });
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
    
    const onDragEnd = (event: any, info: any) => {
      const { offset } = info;
      const swipeThreshold = 80;
      if (offset.x > swipeThreshold) handleSwipe('right');
      else if (offset.x < -swipeThreshold) handleSwipe('left');
    };

    const [dragX, setDragX] = useState(0);

    return (
        <div className="flex h-[100dvh] flex-col lg:flex-row bg-[#fdfdfd] dark:bg-neutral-950 overflow-hidden font-jakarta">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-[320px] shrink-0 border-r border-slate-100 dark:border-neutral-900 bg-white dark:bg-neutral-900 flex-col overflow-y-auto">
                <div className="p-8 space-y-12">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Compass className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="">{language === 'de' ? 'Erkunden' : 'Explore'}</h1>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="">Aktiva Radar</h3>
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        </div>
                        <div className="bg-slate-50/50 dark:bg-neutral-800/30 rounded-[2.25rem] p-5 border border-slate-50 dark:border-neutral-800/50">
                            <ProximityRadarView />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="">{language === 'de' ? 'Präferenzen' : 'Preferences'}</h3>
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
            
            <main className="flex-1 flex flex-col min-h-0 relative">
                {/* Header */}
                <header className="global-viewport-header">
                    <div className="global-header-container">
                        <div className="flex items-center gap-2">
                            <h1 className="">{language === 'de' ? 'Aktivitäten' : 'Activities'}</h1>
                            <Compass className="h-6 w-6 text-orange-500" />
                        </div>
                        <div className="flex items-center gap-3">
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

                    <div className="flex-1 flex flex-col items-center justify-start relative min-h-0 pt-4 pb-36 w-full">
                        {!userLocation ? (
                            isLocationLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
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
                                          ? 'Aktiva benötigt deinen Standort, um spannende Aktivitäten in deiner Nähe anzuzeigen.' 
                                          : 'Aktiva requires your location to display exciting activities near you.'}
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
                                            onClick={() => {
                                                setIsLocationLoading(true);
                                                if (navigator.geolocation) {
                                                    navigator.geolocation.getCurrentPosition(
                                                        (position) => {
                                                            const loc = {
                                                                lat: position.coords.latitude,
                                                                lng: position.coords.longitude,
                                                            };
                                                            setUserLocation(loc);
                                                            localStorage.setItem('aktiva_last_location', JSON.stringify({
                                                                ...loc,
                                                                timestamp: Date.now()
                                                            }));
                                                            setIsLocationLoading(false);
                                                        },
                                                        (error) => {
                                                            console.warn('Geolocation retry error:', error);
                                                            setIsLocationLoading(false);
                                                            toast({
                                                                variant: "destructive",
                                                                title: language === 'de' ? "Standort blockiert" : "Location blocked",
                                                                description: language === 'de' 
                                                                  ? "Bitte aktiviere den Standortzugriff in deinen Einstellungen." 
                                                                  : "Please enable location access in your settings."
                                                            });
                                                        },
                                                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
                                                    );
                                                } else {
                                                    setIsLocationLoading(false);
                                                }
                                            }}
                                            className="w-full h-12 rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-neutral-200 font-bold"
                                        >
                                            {language === 'de' ? 'GPS erneut versuchen' : 'Retry GPS'}
                                        </Button>
                                    </div>
                                </motion.div>
                            )
                        ) : (
                            <div className="relative w-full max-w-[400px] aspect-[3.6/5] max-h-[540px]">
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
                                              className={cn(
                                                "absolute inset-0 bg-white dark:bg-neutral-900 rounded-[2rem] sm:rounded-[2.5rem] elevation-high border-none overflow-hidden flex flex-col transition-shadow duration-300"
                                              )}
                                              style={{ 
                                                  zIndex: isTopCard ? 100 : (10 + index),
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
                                              whileDrag={{ scale: 1.02, opacity: 1, zIndex: 200 }}
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
                                                          <h2 className="text-white font-black drop-shadow-md">{card.placeName}</h2>
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
                                                               <span className="text-[11px] font-black text-emerald-600">
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
                                          {language === 'de' ? 'Aktivität erstellen' : 'Create activity'}
                                      </Button>
                                      <button 
                                          onClick={() => window.location.reload()}
                                          className="mt-6 text-xs font-bold text-slate-400 flex items-center gap-2 hover:text-slate-600 transition-colors"
                                      >
                                          <RefreshCw className="h-3 w-3" />
                                          {language === 'de' ? 'Liste aktualisieren' : 'Refresh list'}
                                      </button>
                                  </motion.div>
                              )}
                            </div>
                        )}
                    </div>

                    {/* Floating Action Buttons */}
                    {cards.length > 0 && !isLoading && (
                        <div className="absolute bottom-[calc(76px+env(safe-area-inset-bottom,0px)+1.25rem)] left-0 right-0 z-[150] flex items-center justify-center gap-6 pointer-events-none">
                            <motion.div 
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl px-6 py-3 rounded-[2.5rem] flex items-center gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 pointer-events-auto"
                            >
                                <motion.button 
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleSwipe('left')}
                                    aria-label={language === 'de' ? 'Aktivität ablehnen' : 'Reject activity'}
                                    className="h-14 w-14 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-500 flex items-center justify-center shadow-inner transition-colors hover:bg-rose-100"
                                >
                                    <X className="h-6 w-6 stroke-[3]"/>
                                </motion.button>

                                <motion.button 
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => {
                                        const topCard = cards[cards.length - 1];
                                        if (topCard) setSelectedPlace(topCard);
                                    }}
                                    aria-label={language === 'de' ? 'Details anzeigen' : 'Show details'}
                                    className="h-12 w-12 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-400 flex items-center justify-center transition-colors hover:bg-slate-200"
                                >
                                    <Info className="h-5 w-5 stroke-[3]"/>
                                </motion.button>

                                <motion.button 
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleSwipe('right')}
                                    aria-label={language === 'de' ? 'Aktivität beitreten' : 'Join activity'}
                                    className="h-14 w-14 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_10px_25px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-600 active:shadow-none"
                                >
                                    <Check className="h-7 w-7 stroke-[3]"/>
                                </motion.button>
                            </motion.div>
                        </div>
                    )}
                </div>
            </main>

            {/* Place Details Overlay */}
            {selectedPlace && (
                <PlaceDetails
                    place={selectedPlace as any}
                    onClose={() => setSelectedPlace(null)}
                    onCreateActivity={() => {
                        setActivityModalPlace(selectedPlace as any);
                        setSelectedPlace(null);
                    }}
                />
            )}

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
