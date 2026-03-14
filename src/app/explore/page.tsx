'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/client';
import { joinActivity } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Compass, X, Heart, Home, MapPin, Calendar, Users, RotateCcw, ExternalLink, Sparkles, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CategoryFilters } from '@/components/aktvia/category-filters';
import { ProximityRadarView } from '@/components/aktvia/proximity-radar-view';
import { cn } from '@/lib/utils';
import { calculateDistance } from '@/lib/geo-utils';

const CardSkeleton = () => (
  <div className="w-full max-w-sm h-[70vh] max-h-[600px] bg-card rounded-[2.5rem] shadow-xl border-none overflow-hidden flex flex-col">
    <Skeleton className="flex-1 rounded-none" />
    <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <div className="pt-4 flex justify-between">
            <Skeleton className="h-6 w-24 rounded-full" />
        </div>
    </div>
  </div>
);

const AdCard = () => (
  <div className="w-full h-full bg-primary/5 flex flex-col p-8 items-center justify-center text-center">
    <div className="bg-primary/10 p-4 rounded-full mb-6">
      <Sparkles className="h-12 w-12 text-primary animate-pulse" />
    </div>
    <h2 className="text-2xl font-bold text-primary mb-2">Gesponserter Partner</h2>
    <p className="text-muted-foreground mb-8 text-sm font-medium">Entdecke exklusive Angebote unserer Partner in deiner Region.</p>
    <Button className="rounded-full h-14 px-8 font-black gap-2 shadow-lg shadow-primary/20">
      <ExternalLink className="h-4 w-4" />
      Mehr erfahren
    </Button>
    <span className="mt-6 text-[10px] uppercase tracking-widest text-neutral-400 font-black">Anzeige</span>
  </div>
);

export default function ExplorePage() {
    const { user, userProfile } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [allCards, setAllCards] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const animationControls = useAnimation();
    
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [activeCategory, setActiveCategory] = useState<string[]>(['all']);
    const [radiusKm, setRadiusKm] = useState<number | null>(null);
    const [lastSwipedCard, setLastSwipedCard] = useState<Activity | null>(null);

    const resetFilters = () => {
        setActiveCategory(['all']);
        setRadiusKm(null);
    };

    const EmptyState = () => (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center h-full">
            <div className="bg-primary/10 p-6 rounded-[2.5rem]">
                <Compass className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-xl font-black text-[#0f172a]">Keine Aktivitäten gefunden</h2>
            <p className="text-neutral-500 font-medium max-w-xs">
                Passe deine Filter an oder schau später wieder vorbei.
            </p>
            <Button onClick={resetFilters} variant="outline" className="rounded-2xl h-12 font-bold px-6 border-neutral-200 mt-2">
                <RotateCcw className="mr-2 h-4 w-4" />
                Filter zurücksetzen
            </Button>
        </div>
    );

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
                    toast({
                        title: 'Standortfehler',
                        description: 'Konnte deinen Standort nicht ermitteln.',
                    });
                }
            );
        }
    }, [toast]);


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
                // --- ARCHITEKTUR UPDATE: FEED FILTER FÜR EXPLORE ---
                const fetchedActivities = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
                    .filter(act => 
                      !act.participantIds.includes(user.uid) && 
                      act.status !== 'completed' && 
                      act.status !== 'cancelled'
                    );
                
                // Clientseitige Sortierung: 1. Booster, 2. Distanz (Modul 6), 3. Erstellungsdatum
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

                setAllCards(fetchedActivities);
                setIsLoading(false);
            }, (error) => {
                console.error("FIRESTORE ERROR:", error.message);
                toast({ 
                    title: "Fehler", 
                    description: "Aktivitäten konnten nicht geladen werden.", 
                    variant: 'destructive'
                });
                setIsLoading(false);
            });

            return () => unsubscribe();
        } catch (err: any) {
            console.error("Activities listener failed:", err.message);
            setIsLoading(false);
        }
    }, [toast, user, activeCategory, userLocation]);
    
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
        setCards(visibleCards);
    }, [visibleCards]);


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
             setCards(prev => prev.filter(c => c.id !== topCardId));
        }

        if (direction === 'right') {
             if (!user) {
                toast({ title: 'Login erforderlich', description: 'Du musst angemeldet sein.' });
                router.push('/login');
                animationControls.start({ x: 0, rotate: 0, opacity: 1, transition: { duration: 0.4 }});
                return;
            }

            // Payment Interception
            if (topCard.isPaid && topCard.price && topCard.price > 0) {
                router.push(`/checkout/${topCardId}`);
                return;
            }

             joinActivity(topCardId, user)
                .then(() => {
                    toast({ title: 'Aktivität beigetreten!', description: 'Du findest sie jetzt in deinen Chats.' });
                    setTimeout(removeCard, 200);
                    setLastSwipedCard(null);
                })
                .catch((error) => {
                    console.error(error);
                    toast({ title: 'Fehler', description: error.message || 'Beitritt fehlgeschlagen.', variant: 'destructive' });
                    animationControls.start({ x: 0, rotate: 0, opacity: 1, transition: { duration: 0.4 }});
                });
        } else {
            setLastSwipedCard(topCard);
            setTimeout(removeCard, 200);
        }
    };

    const handleUndo = () => {
        if (!lastSwipedCard) return;

        animationControls.start({
            x: 0,
            rotate: 0,
            opacity: 1,
            transition: { duration: 0.2, ease: "easeIn" }
        });
        
        setCards(prev => [...prev, lastSwipedCard]);
        
        setLastSwipedCard(null);
    };
    
    const onDragEnd = (event: any, info: any) => {
      const { offset } = info;
      const swipeThreshold = 80;

      if (offset.x > swipeThreshold) {
        handleSwipe('right');
      } else if (offset.x < -swipeThreshold) {
        handleSwipe('left');
      }
    };
    
    const renderDate = (activity: Activity) => {
        if (!activity.activityDate) return "Kein Datum";
        if (activity.activityEndDate) {
            return `${format(activity.activityDate.toDate(), "eee, d. MMM")} - ${format(activity.activityEndDate.toDate(), "eee, d. MMM")}`;
        }
        if (activity.isTimeFlexible) {
            return `${format(activity.activityDate.toDate(), "eee, d. MMM")} (Flexible Zeit)`;
        }
        return format(activity.activityDate.toDate(), "eee, d. MMM 'um' p");
    };

    return (
        <div className="flex h-full flex-col bg-secondary/30">
            <header className="sticky top-0 z-10 w-full border-b border-neutral-100 bg-white/80 backdrop-blur-md shrink-0 px-4 py-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-black tracking-tight text-[#0f172a]">Aktivitäten</h1>
                    <NotificationBell />
                </div>
                <div className="space-y-4">
                  <CategoryFilters activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
                  <div className="flex gap-2">
                      <Select 
                          onValueChange={(value) => setRadiusKm(value === 'all' ? null : Number(value))}
                          disabled={!userLocation}
                      >
                          <SelectTrigger className="w-full rounded-2xl h-12 bg-neutral-50 border-none focus:ring-0 font-bold text-neutral-600">
                              <SelectValue placeholder="In der Umgebung..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-xl font-bold">
                              <SelectItem value="all">Überall</SelectItem>
                              <SelectItem value="5">Bis 5 km</SelectItem>
                              <SelectItem value="10">Bis 10 km</SelectItem>
                              <SelectItem value="25">Bis 25 km</SelectItem>
                              <SelectItem value="50">Bis 50 km</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                </div>
              <ProximityRadarView />
            </header>
            
            <main className="flex-1 flex flex-col min-h-0">
                {isLoading && (
                    <div className="flex-1 flex items-center justify-center">
                        <CardSkeleton />
                    </div>
                )}

                {!isLoading && cards.length === 0 && (
                     <div className="flex-1">
                        <EmptyState />
                    </div>
                )}
                
                {!isLoading && cards.length > 0 &&
                    <>
                        <div className="flex-1 min-h-0 relative flex items-center justify-center p-4">
                            {cards.map((card, index) => {
                                const isTopCard = index === cards.length - 1;
                                const showAd = !userProfile?.isPremium && (index % 10 === 0 && index !== 0);
                                const isPaidEvent = card.isPaid && card.price && card.price > 0;
                                const distance = (userLocation && card.lat && card.lon) 
                                  ? calculateDistance(userLocation.lat, userLocation.lng, card.lat, card.lon)
                                  : null;

                                return (
                                    <motion.div
                                        key={card.id || index}
                                        className={cn(
                                          "absolute w-full max-w-sm h-[70vh] max-h-[600px] bg-white rounded-[2.5rem] shadow-xl border-none overflow-hidden flex flex-col",
                                          card.isBoosted && "ring-4 ring-orange-500/20"
                                        )}
                                        style={{
                                            zIndex: index,
                                        }}
                                        initial={isTopCard ? { scale: 1, y: 0, opacity: 1 } : {}}
                                        animate={isTopCard ? animationControls : {
                                            scale: 1 - (cards.length - 1 - index) * 0.05,
                                            y: (cards.length - 1 - index) * 10,
                                            opacity: 1 - (cards.length - 1 - index) * 0.2,
                                        }}
                                        drag={isTopCard ? "x" : false}
                                        dragConstraints={{ left: 0, right: 0 }}
                                        onDragEnd={isTopCard ? onDragEnd : undefined}
                                        whileDrag={{ cursor: 'grabbing' }}
                                    >
                                        {showAd ? (
                                          <AdCard />
                                        ) : (
                                          <>
                                            <div className={cn(
                                              "flex-1 flex items-center justify-center relative",
                                              card.isBoosted ? "bg-gradient-to-br from-orange-400 to-amber-500" : "bg-gradient-to-br from-indigo-400 via-purple-400 to-pink-400"
                                            )}>
                                                {card.isBoosted && (
                                                  <div className="absolute top-6 left-6 bg-white/20 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-lg">
                                                    <Sparkles className="h-3 w-3" />
                                                    Featured
                                                  </div>
                                                )}
                                                
                                                {distance !== null && (
                                                  <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/30 backdrop-blur-md text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-lg border border-white/10">
                                                    <MapPin className="h-2.5 w-2.5" />
                                                    {distance < 1 ? '< 1 km' : `${distance.toFixed(1)} km`}
                                                  </div>
                                                )}

                                                {isPaidEvent && (
                                                  <div className="absolute top-6 right-6 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1 shadow-lg">
                                                    <CreditCard className="h-3 w-3" />
                                                    €{card.price!.toFixed(2)}
                                                  </div>
                                                )}

                                                {card.isCustomActivity ? (
                                                  <Home className="h-24 w-24 text-white/30 drop-shadow-lg"/>
                                                ) : (
                                                  <MapPin className="h-24 w-24 text-white/30 drop-shadow-lg"/>
                                                )}
                                                <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent p-6 flex flex-col justify-end">
                                                    <h2 className="text-2xl font-black text-white shadow-lg leading-tight mb-1">{card.placeName}</h2>
                                                    <p className="text-sm text-white/80 font-bold shadow-md truncate">{card.placeAddress}</p>
                                                </div>
                                            </div>
                                            <div className="p-6 flex flex-col gap-3">
                                                <div className="flex items-center gap-3 bg-emerald-50 text-emerald-700 p-4 rounded-2xl transition-colors">
                                                    <Calendar className="h-5 w-5 opacity-70"/>
                                                    <span className="font-black text-sm">{renderDate(card)}</span>
                                                </div>
                                                <div className="flex items-center gap-3 bg-blue-50 text-blue-700 p-4 rounded-2xl transition-colors">
                                                    <Users className="h-5 w-5 opacity-70"/>
                                                    <span className="font-black text-sm">
                                                      {card.participantIds.length} Teilnehmer &bull; von {card.creatorName?.split(' ')[0]}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center justify-between mt-3 pt-4 border-t border-neutral-50">
                                                    <div className="rounded-full bg-orange-50 text-orange-600 font-black px-4 py-1.5 text-[10px] uppercase tracking-wider border-none">
                                                        {card.isCustomActivity ? "Community" : "Location"}
                                                    </div>
                                                </div>
                                            </div>
                                          </>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </div>
                        
                        <div className="shrink-0 flex items-center justify-center gap-6 pt-4 pb-24 z-20">
                            <Button 
                              onClick={() => handleSwipe('left')} 
                              variant="outline" 
                              size="icon" 
                              className="h-16 w-16 rounded-full bg-red-50 border-none shadow-sm text-red-500 hover:bg-red-100 hover:scale-105 active:scale-90 transition-all"
                            >
                                <X className="h-8 w-8 stroke-[2.5]"/>
                            </Button>
                             <Button 
                                onClick={handleUndo} 
                                variant="outline" 
                                size="icon" 
                                className="h-12 w-12 rounded-full bg-slate-50 border-none shadow-sm text-slate-500 hover:bg-slate-100 hover:scale-105 active:scale-90 transition-all disabled:opacity-30"
                                disabled={!lastSwipedCard}
                            >
                                <RotateCcw className="h-5 w-5 stroke-[2.5]"/>
                            </Button>
                             <Button 
                              onClick={() => handleSwipe('right')} 
                              variant="outline" 
                              size="icon" 
                              className={cn(
                                "h-16 w-16 rounded-full border-none shadow-sm transition-all hover:scale-105 active:scale-90",
                                cards[cards.length-1]?.isPaid 
                                    ? "bg-slate-900 text-white hover:bg-black" 
                                    : "bg-emerald-50 text-emerald-500 hover:bg-emerald-100"
                              )}
                            >
                                <Heart className={cn("h-8 w-8 stroke-[2.5]", !cards[cards.length-1]?.isPaid && "fill-emerald-500/10")}/>
                            </Button>
                        </div>
                    </>
                }
            </main>
        </div>
    );
}
