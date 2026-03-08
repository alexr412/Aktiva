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
import { Compass, X, Heart, Home, MapPin, Calendar, Users, RotateCcw, ExternalLink, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CategoryFilters } from '@/components/aktvia/category-filters';
import { ProximityRadarView } from '@/components/aktvia/proximity-radar-view';

const CardSkeleton = () => (
  <div className="w-full max-w-sm h-[70vh] max-h-[600px] bg-card rounded-3xl shadow-xl border border-border overflow-hidden flex flex-col items-center justify-center">
    <Skeleton className="h-full w-full" />
  </div>
);

const AdCard = () => (
  <div className="w-full h-full bg-primary/5 flex flex-col p-8 items-center justify-center text-center">
    <div className="bg-primary/10 p-4 rounded-full mb-6">
      <Sparkles className="h-12 w-12 text-primary animate-pulse" />
    </div>
    <h2 className="text-2xl font-bold text-primary mb-2">Gesponserter Partner</h2>
    <p className="text-muted-foreground mb-8">Entdecke exklusive Angebote unserer Partner in deiner Region.</p>
    <Button className="rounded-full h-12 px-8 font-bold gap-2">
      <ExternalLink className="h-4 w-4" />
      Mehr erfahren
    </Button>
    <span className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Anzeige</span>
  </div>
);

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; 
    return d;
}


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
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center h-full">
            <div className="bg-primary/10 p-4 rounded-full">
                <Compass className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Keine Aktivitäten gefunden</h2>
            <p className="text-muted-foreground">
                Passe deine Filter an oder schau später wieder vorbei.
            </p>
            <Button onClick={resetFilters} variant="outline">
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
                        title: 'Location Error',
                        description: 'Could not get your location. Distance filter is disabled.',
                    });
                }
            );
        }
    }, [toast]);


    useEffect(() => {
        if (!db || !user) return;

        const activitiesQuery = query(
            collection(db, 'activities'),
            where('activityDate', '>=', Timestamp.now()),
            orderBy('activityDate', 'asc')
        );

        const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
            const fetchedActivities = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Activity))
                .filter(act => !act.participantIds.includes(user.uid));
            setAllCards(fetchedActivities);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching activities: ", error);
            toast({ title: "Error", description: "Could not load upcoming activities.", variant: 'destructive'});
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [toast, user]);
    
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
                const distance = getDistance(userLocation.lat, userLocation.lng, activity.lat, activity.lon);
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
                toast({ title: 'Login Required', description: 'You must be logged in to join an activity.' });
                router.push('/login');
                animationControls.start({ x: 0, rotate: 0, opacity: 1, transition: { duration: 0.4 }});
                return;
            }
             joinActivity(topCardId, user)
                .then(() => {
                    toast({ title: 'Activity Joined!', description: 'You can now find it in your chats.' });
                    setTimeout(removeCard, 200);
                    setLastSwipedCard(null);
                })
                .catch((error) => {
                    console.error(error);
                    toast({ title: 'Error', description: error.message || 'Failed to join activity.', variant: 'destructive' });
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
        if (!activity.activityDate) return "No date";
        if (activity.activityEndDate) {
            return `${format(activity.activityDate.toDate(), "eee, MMM d")} - ${format(activity.activityEndDate.toDate(), "eee, MMM d")}`;
        }
        if (activity.isTimeFlexible) {
            return `${format(activity.activityDate.toDate(), "eee, MMM d")} (Flexible Time)`;
        }
        return format(activity.activityDate.toDate(), "eee, MMM d 'at' p");
    };

    return (
        <div className="flex h-full flex-col bg-secondary">
            <header className="sticky top-0 z-10 w-full border-b bg-background/80 backdrop-blur-sm shrink-0">
              <div className="px-4 py-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold tracking-tight">Explore Activities</h1>
                    <NotificationBell />
                </div>
                <div className="space-y-4">
                  <CategoryFilters activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
                  <div className="flex gap-2">
                      <Select 
                          onValueChange={(value) => setRadiusKm(value === 'all' ? null : Number(value))}
                          disabled={!userLocation}
                      >
                          <SelectTrigger className="w-full rounded-full h-10 bg-muted border-none focus:ring-0">
                              <SelectValue placeholder="Filter by distance..." />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Any Distance</SelectItem>
                              <SelectItem value="5">Under 5 km</SelectItem>
                              <SelectItem value="10">Under 10 km</SelectItem>
                              <SelectItem value="25">Under 25 km</SelectItem>
                              <SelectItem value="50">Under 50 km</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
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

                                return (
                                    <motion.div
                                        key={card.id || index}
                                        className="absolute w-full max-w-sm h-[70vh] max-h-[600px] bg-card rounded-3xl shadow-xl border border-border overflow-hidden flex flex-col"
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
                                            <div className="flex-1 bg-muted flex items-center justify-center relative">
                                                {card.isCustomActivity ? <Home className="h-24 w-24 text-muted-foreground/30"/> : <MapPin className="h-24 w-24 text-muted-foreground/30"/>}
                                                <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/60 to-transparent p-4 flex flex-col justify-end">
                                                    <h2 className="text-2xl font-bold text-white shadow-lg">{card.placeName}</h2>
                                                    <p className="text-sm text-white/90 font-medium shadow-md">{card.placeAddress}</p>
                                                </div>
                                            </div>
                                            <div className="p-6 flex flex-col gap-4">
                                                <div className="flex items-center gap-3 bg-muted p-3 rounded-xl">
                                                    <Calendar className="h-5 w-5 text-primary"/>
                                                    <span className="font-semibold text-sm">{renderDate(card)}</span>
                                                </div>
                                                <div className="flex items-center gap-3 bg-muted p-3 rounded-xl">
                                                    <Users className="h-5 w-5 text-primary"/>
                                                    <span className="font-semibold text-sm">{card.participantIds.length} Participants &bull; by {card.creatorName}</span>
                                                </div>
                                                
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                                                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-1 rounded">
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
                        <div className="shrink-0 flex items-center justify-center gap-8 pt-4 pb-24 z-20">
                            <Button onClick={() => handleSwipe('left')} variant="outline" size="icon" className="h-20 w-20 rounded-full shadow-lg border-2 border-destructive/50 hover:bg-destructive/10">
                                <X className="h-10 w-10 text-destructive"/>
                            </Button>
                             <Button 
                                onClick={handleUndo} 
                                variant="outline" 
                                size="icon" 
                                className="h-16 w-16 rounded-full shadow-md border-2 border-gray-400/50 hover:bg-gray-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!lastSwipedCard}
                            >
                                <RotateCcw className="h-8 w-8 text-gray-500"/>
                            </Button>
                             <Button onClick={() => handleSwipe('right')} variant="outline" size="icon" className="h-20 w-20 rounded-full shadow-lg border-2 border-primary/50 hover:bg-primary/10">
                                <Heart className="h-10 w-10 text-primary"/>
                            </Button>
                        </div>
                    </>
                }
            </main>
        </div>
    );
}
