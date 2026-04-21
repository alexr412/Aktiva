'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { joinActivity, createActivity } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Compass, X, Check, Info, MapPin, Star, Building2, ArrowLeft, ArrowRight, PlusCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CategoryFilters } from '@/components/aktvia/category-filters';
import { ProximityRadarView } from '@/components/aktvia/proximity-radar-view';
import { cn } from '@/lib/utils';
import { calculateDistance } from '@/lib/geo-utils';
import { PlaceDetails } from '@/components/aktvia/place-details';
import { CreateActivityDialog } from '@/components/aktvia/create-activity-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const QUARANTINE_THRESHOLD = 3;

export default function ExplorePage() {
    const { user, userProfile } = useAuth();
    const language = useLanguage();
    const { toast } = useToast();
    const router = useRouter();

    const [allCards, setAllCards] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activityModalPlace, setActivityModalPlace] = useState<Place | 'custom' | null>(null);
    const animationControls = useAnimation();
    
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [activeCategory, setActiveCategory] = useState<string[]>(['all']);
    const [radiusKm, setRadiusKm] = useState<number | null>(null);
    const [lastSwipedCard, setLastSwipedCard] = useState<Activity | null>(null);
    const [selectedPlace, setSelectedPlace] = useState<Activity | null>(null);
    const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());

    const resetFilters = () => {
        setActiveCategory(['all']);
        setRadiusKm(null);
    };

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (error) => {
                    console.error('Geolocation error:', error);
                }
            );
        }
    }, []);

    useEffect(() => {
        if (!db || !user) return;

        setIsLoading(true);

        try {
            const collectionRef = collection(db, 'activities');
            const constraints: any[] = [];
            const isCommunityMode = activeCategory.includes('user_event');

            if (isCommunityMode) {
                constraints.push(where('isCustomActivity', '==', true));
            } else {
                constraints.push(where('status', '==', 'active'));
            }

            const activitiesQuery = query(collectionRef, ...constraints);

            const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
                const fetchedActivities = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
                    .filter(act => 
                      !act.participantIds.includes(user.uid) && 
                      act.status !== 'completed' && 
                      act.status !== 'cancelled' &&
                      (act.reportCount || 0) < QUARANTINE_THRESHOLD
                    );
                
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
                setIsLoading(false);
            });

            return () => unsubscribe();
        } catch (err: any) {
            console.error("Activities listener failed:", err.message);
            setIsLoading(false);
        }
    }, [user, activeCategory, userLocation]);
    
    const handleCreateActivity = async (
        startDate: Date, 
        endDate: Date | undefined, 
        isTimeFlexible: boolean, 
        customLocationName?: string, 
        maxParticipants?: number, 
        isBoosted?: boolean,
        isPaid?: boolean,
        price?: number,
        category?: ActivityCategory
    ) => {
        if (!user) return false;
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
                category: category || (language === 'de' ? 'Sonstiges' : 'Other')
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

    return (
        <div className="flex h-[100dvh] flex-col lg:flex-row bg-[#fdfdfd] dark:bg-neutral-950 overflow-hidden font-jakarta">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex w-[320px] shrink-0 border-r border-slate-100 dark:border-neutral-900 bg-white dark:bg-neutral-900 flex-col overflow-y-auto">
                <div className="p-8 space-y-12">
                     <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <Compass className="h-6 w-6 text-white" />
                        </div>
                        <h1 className="text-[24px] font-black tracking-tighter text-[#0f172a] dark:text-neutral-50 leading-none">Aktvia</h1>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Aktvia Radar</h3>
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        </div>
                        <div className="bg-slate-50/50 dark:bg-neutral-800/30 rounded-[2.25rem] p-5 border border-slate-50 dark:border-neutral-800/50">
                            <ProximityRadarView />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 px-2">{language === 'de' ? 'Präferenzen' : 'Preferences'}</h3>
                        <div className="flex flex-col gap-6">
                            <CategoryFilters activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
                        </div>
                    </div>
                </div>
            </aside>
            
            <main className="flex-1 flex flex-col min-h-0 relative">
                {/* Header */}
                <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between border-b border-slate-50 dark:border-neutral-900">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-extrabold tracking-tight text-[#0f172a] dark:text-neutral-50 italic">{language === 'de' ? 'Aktivitäten' : 'Activities'}</h1>
                        <Compass className="h-5 w-5 text-orange-400" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 flex items-center justify-center rounded-full bg-slate-50 dark:bg-neutral-900">
                           <NotificationBell />
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex flex-col min-h-0 relative px-4 lg:px-0">
                    {/* Mobile Filters Area */}
                    <div className="lg:hidden py-3 space-y-3">
                         <CategoryFilters activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
                         <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-neutral-900 rounded-full py-1.5 px-3">
                                <MapPin className="h-2.5 w-2.5 text-rose-400" />
                                <span className="text-[10px] font-extrabold text-slate-600">{language === 'de' ? 'Überall' : 'Everywhere'}</span>
                                <ChevronDown className="h-3 w-3 text-slate-400" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language === 'de' ? 'Radar aktiv' : 'Radar active'}</span>
                            </div>
                         </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center relative min-h-0 py-2 sm:py-6">
                          <div className="relative w-full max-w-[400px] aspect-[3.6/5] max-h-[580px]">
                            <AnimatePresence mode="popLayout">
                                {cards.slice(-3).map((card, index) => {
                                    const displayedIndex = cards.length - cards.slice(-3).length + index;
                                    const isTopCard = displayedIndex === cards.length - 1;
                                    const distance = (userLocation && card.lat && card.lon) 
                                      ? calculateDistance(userLocation.lat, userLocation.lng, card.lat, card.lon)
                                      : null;

                                    return (
                                        <motion.div
                                            key={card.id}
                                            className={cn(
                                              "absolute inset-0 bg-white dark:bg-neutral-900 rounded-[3rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] border-none overflow-hidden flex flex-col"
                                            )}
                                            style={{ zIndex: isTopCard ? 100 : (10 + index), perspective: 1000 }}
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={isTopCard ? { 
                                                opacity: 1, 
                                                scale: 1, 
                                                x: 0, 
                                                y: 0,
                                                transition: { duration: 0.2 } 
                                            } : {
                                                scale: 1 - (cards.length - 1 - displayedIndex) * 0.05,
                                                y: (cards.length - 1 - displayedIndex) * 12,
                                                opacity: 0.05,
                                            }}
                                            whileDrag={{ scale: 1.02, opacity: 1, zIndex: 200 }}
                                            exit={{ x: 500, opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                            drag={isTopCard ? "x" : false}
                                            dragConstraints={{ left: 0, right: 0 }}
                                            onDragEnd={isTopCard ? onDragEnd : undefined}
                                        >
                                            <div className={cn("flex-1 flex flex-col bg-white dark:bg-neutral-900", !isTopCard && "pointer-events-none")}>
                                                <div className="h-[55%] w-full relative overflow-hidden bg-gradient-to-br from-[#bfc6e8] to-[#9fa9d1]">
                                                    <div className="absolute top-5 left-5 flex gap-2 z-10">
                                                        <div className="bg-amber-100 text-amber-700 text-[9px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                                                            <Star className="h-2.5 w-2.5 fill-current" />
                                                            {language === 'de' ? 'NEU' : 'NEW'}
                                                        </div>
                                                        <div className="bg-white/80 backdrop-blur-md text-[#6e7ee5] text-[9px] font-bold px-3 py-1.5 rounded-full">
                                                            {card.categories?.[0] || (language === 'de' ? 'Aktivität' : 'Activity')}
                                                        </div>
                                                    </div>

                                                    {distance !== null && (
                                                        <div className="absolute top-5 right-5 z-10">
                                                            <div className="bg-black/20 backdrop-blur-md text-white text-[9px] font-bold px-3 py-1.5 rounded-full">
                                                                {distance < 1 ? '< 1 km' : `${distance.toFixed(1)} km`}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <Building2 className="h-24 w-24 text-white/50" strokeWidth={1}/>
                                                    </div>

                                                    <div className="absolute bottom-0 left-0 w-full p-6 pt-16 bg-gradient-to-t from-black/60 to-transparent">
                                                        <h2 className="text-2xl font-extrabold text-white leading-tight mb-1.5 tracking-tight">{card.placeName}</h2>
                                                        <div className="flex items-center gap-2 text-white/80">
                                                            <MapPin className="h-3 w-3 text-rose-400" />
                                                            <p className="text-[11px] font-bold truncate tracking-wide">{card.placeAddress || (language === 'de' ? 'In deiner Umgebung' : 'In your area')}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1 p-6 flex flex-col justify-around bg-white dark:bg-neutral-900">
                                                    <div className="grid grid-cols-3 gap-2">
                                                         <div className="bg-orange-50/50 dark:bg-neutral-800/50 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                                                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">{language === 'de' ? 'WANN' : 'WHEN'}</span>
                                                             <span className="text-[10px] font-extrabold text-[#0f172a] dark:text-neutral-200">
                                                                 {format(card.activityDate.toDate(), language === 'de' ? "eee, d. MMM" : "eee, MMM d", { locale: language === 'de' ? de : enUS })}
                                                             </span>
                                                         </div>
                                                         <div className="bg-orange-50/50 dark:bg-neutral-800/50 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                                                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">{language === 'de' ? 'UHRZEIT' : 'TIME'}</span>
                                                             <span className="text-[10px] font-extrabold text-[#0f172a] dark:text-neutral-200">{language === 'de' ? 'Flexibel' : 'Flexible'}</span>
                                                         </div>
                                                         <div className="bg-orange-50/50 dark:bg-neutral-800/50 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
                                                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">{language === 'de' ? 'PLÄTZE' : 'SPOTS'}</span>
                                                             <span className="text-[10px] font-extrabold text-emerald-600">
                                                                 {(card.maxParticipants || 10) - card.participantIds.length} {language === 'de' ? 'frei' : 'free'}
                                                             </span>
                                                         </div>
                                                     </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="flex -space-x-2.5 overflow-hidden p-0.5 items-center">
                                                            <Avatar className="h-9 w-9 border-2 border-white dark:border-neutral-900 shadow-sm ring-1 ring-black/10 z-10">
                                                                <AvatarImage src={card.hostPhotoURL || undefined} alt={card.hostName || 'Host'} />
                                                                <AvatarFallback className="bg-orange-100 text-orange-700 text-[10px] font-bold">
                                                                    {card.hostName?.charAt(0) || 'H'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            
                                                            {(card.participantsPreview || [])
                                                                .filter(p => p.uid !== card.hostId)
                                                                .slice(0, 3)
                                                                .map((p, pidx) => (
                                                                <Avatar key={p.uid} className="h-8 w-8 border-2 border-white dark:border-neutral-900 shadow-sm">
                                                                    <AvatarImage src={p.photoURL || undefined} alt={p.displayName || 'Participant'} />
                                                                    <AvatarFallback className={cn(
                                                                        "text-[9px] font-bold text-white",
                                                                        pidx === 0 ? "bg-indigo-400" : pidx === 1 ? "bg-emerald-500" : "bg-purple-500"
                                                                    )}>
                                                                        {p.displayName?.charAt(0) || '?'}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            ))}
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-[10px] font-bold text-slate-500 leading-none">
                                                                <span className="text-[#0f172a] dark:text-neutral-200">{language === 'de' ? 'v.' : 'by'} {card.hostName?.split(' ')[0] || 'Explorer'}</span> 
                                                                {card.participantIds.length > 1 && (
                                                                    <span className="text-slate-400"> & {card.participantIds.length - 1} {language === 'de' ? 'weitere' : 'more'}</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
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
                                    <h3 className="text-xl font-extrabold text-[#0f172a] dark:text-neutral-100 mb-2">{language === 'de' ? 'Alles entdeckt!' : 'Everything discovered!'}</h3>
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
                    </div>

                    {/* Action Buttons */}
                    {cards.length > 0 && !isLoading && (
                        <div className="pb-12 flex items-center justify-center gap-8">
                            <div className="flex flex-col items-center gap-2">
                                <Button 
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    asChild
                                >
                                    <motion.button 
                                        onClick={() => handleSwipe('left')}
                                        className="h-16 w-16 rounded-full bg-white dark:bg-neutral-900 border-2 border-slate-50 dark:border-neutral-800 text-rose-500 shadow-sm flex items-center justify-center"
                                    >
                                        <X className="h-7 w-7 stroke-[3]"/>
                                    </motion.button>
                                </Button>
                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest tracking-widest">{language === 'de' ? 'Überspringen' : 'Skip'}</span>

                            </div>

                            <div className="flex flex-col items-center gap-2 translate-y-1">
                                <Button 
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    asChild
                                >
                                    <motion.button 
                                        onClick={() => {
                                            const topCard = cards[cards.length - 1];
                                            if (topCard) setSelectedPlace(topCard);
                                        }}
                                        className="h-12 w-12 rounded-full bg-slate-50 dark:bg-neutral-800 border-none text-blue-500 flex items-center justify-center"
                                    >
                                        <Info className="h-6 w-6 stroke-[3] fill-blue-500/10"/>
                                    </motion.button>
                                </Button>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{language === 'de' ? 'Info' : 'Info'}</span>

                            </div>

                            <div className="flex flex-col items-center gap-2">
                                <Button 
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    asChild
                                >
                                    <motion.button 
                                        onClick={() => handleSwipe('right')}
                                        className="h-16 w-16 rounded-full bg-emerald-100/50 dark:bg-emerald-900/30 border-none text-emerald-600 flex items-center justify-center"
                                    >
                                        <Check className="h-8 w-8 stroke-[3]"/>
                                    </motion.button>
                                </Button>
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{language === 'de' ? 'Beitreten' : 'Join'}</span>

                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Place Details Overlay */}
            {selectedPlace && (
                <PlaceDetails
                    place={selectedPlace as any}
                    onClose={() => setSelectedPlace(null)}
                    onJoinActivity={() => {
                        handleSwipe('right');
                        setSelectedPlace(null);
                    }}
                    userLocation={userLocation}
                />
            )}

            <CreateActivityDialog 
                place={activityModalPlace === 'custom' ? null : activityModalPlace} 
                open={!!activityModalPlace} 
                onOpenChange={(open) => !open && setActivityModalPlace(null)} 
                onCreateActivity={handleCreateActivity} 
            />
        </div>
    );
}
