'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/client';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
    Sheet, 
    SheetContent, 
    SheetHeader, 
    SheetTitle, 
    SheetDescription,
    SheetFooter
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    Plus, 
    Users, 
    MessageSquare, 
    Loader2, 
    ArrowRight,
    MapPin,
    Calendar,
    Sparkles,
    Check
} from 'lucide-react';
import { de, enUS } from 'date-fns/locale';
import { useLanguage } from '@/hooks/use-language';
import type { Place, Activity } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { joinActivity } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getPrimaryIconData } from '@/lib/tag-config';

interface SpotActionSheetProps {
    place: Place | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreateNew: (place: Place) => void;
}

export function SpotActionSheet({ place, open, onOpenChange, onCreateNew }: SpotActionSheetProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const { user } = useAuth();
    const language = useLanguage();
    const router = useRouter();
    const { toast } = useToast();

    useEffect(() => {
        if (!place?.id || !open) return;

        setLoading(true);
        const q = query(
            collection(db, 'activities'),
            where('placeId', '==', place.id),
            where('status', '==', 'active')
        );

        const unsub = onSnapshot(q, (snap) => {
            const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
            setActivities(fetched);
            setLoading(false);
        });

        return () => unsub();
    }, [place?.id, open]);

    const handleJoin = async (activity: Activity) => {
        if (!user) {
            router.push('/login');
            return;
        }

        if (activity.participantIds.includes(user.uid)) {
            router.push(`/chat/${activity.id}`);
            return;
        }

        if (activity.isPaid && activity.price && activity.price > 0) {
            router.push(`/checkout/${activity.id}`);
            return;
        }

        setJoiningId(activity.id!);
        try {
            await joinActivity(activity.id!, user);
            toast({ title: language === 'de' ? 'Erfolgreich beigetreten!' : 'Successfully joined!' });
            router.push(`/chat/${activity.id}`);
        } catch (error: any) {
            toast({ variant: 'destructive', title: language === 'de' ? 'Fehler' : 'Error', description: error.message });
        } finally {
            setJoiningId(null);
        }
    };

    if (!place) return null;

    const primaryStyle = getPrimaryIconData(place, language);
    const PrimaryIcon = primaryStyle.icon;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-[2.5rem] border-none bg-white dark:bg-neutral-900 px-6 pb-10 sm:max-w-xl mx-auto h-[80vh] flex flex-col gap-0 shadow-2xl">
                <div className="w-12 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full mx-auto mb-6 flex-shrink-0" />
                
                <SheetHeader className="text-left mb-6 flex-shrink-0">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", primaryStyle.gradientClass)}>
                            <PrimaryIcon className="h-8 w-8" style={{ color: primaryStyle.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <SheetTitle className="text-2xl font-black truncate text-neutral-900 dark:text-white leading-tight">
                                {place.name}
                            </SheetTitle>
                            <SheetDescription className="flex items-center gap-1 font-bold text-neutral-400 uppercase text-[10px] tracking-widest mt-0.5">
                                <MapPin className="h-3 w-3" />
                                {place.address.split(',')[0]}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex items-center justify-between mb-4 flex-shrink-0 px-1">
                        <h3 className="text-sm font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            {language === 'de' ? 'Aktive Räume' : 'Active Rooms'}
                        </h3>
                        <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary font-black border-none text-[10px]">
                            {activities.length} {language === 'de' ? 'Aktiv' : 'Active'}
                        </Badge>
                    </div>

                    <ScrollArea className="flex-1 -mx-2 px-2">
                        <div className="flex flex-col gap-3 py-1">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
                                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{language === 'de' ? 'Aktivitäten werden gesucht...' : 'Searching activities...'}</p>
                                </div>
                            ) : activities.length === 0 ? (
                                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-[2rem] p-8 text-center border-2 border-dashed border-neutral-100 dark:border-neutral-800">
                                    <div className="bg-white dark:bg-neutral-800 p-4 rounded-full w-fit mx-auto mb-4 shadow-sm">
                                        <Calendar className="h-8 w-8 text-neutral-300" />
                                    </div>
                                    <p className="text-sm font-bold text-neutral-500 mb-2">{language === 'de' ? 'Hier ist noch nichts los.' : 'Nothing going on here yet.'}</p>
                                    <p className="text-xs text-neutral-400 font-medium max-w-[200px] mx-auto leading-relaxed">{language === 'de' ? 'Sei der Erste und starte jetzt eine neue Aktivität an diesem Spot!' : 'Be the first and start a new activity at this spot now!'}</p>
                                </div>
                            ) : (
                                activities.map((activity) => (
                                    <div 
                                        key={activity.id}
                                        onClick={() => handleJoin(activity)}
                                        className="group bg-neutral-50 dark:bg-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 p-4 rounded-3xl transition-all cursor-pointer border border-transparent hover:border-primary/20 relative overflow-hidden"
                                    >
                                        <div className="flex items-center justify-between gap-4 relative z-10">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-black text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
                                                        {activity.isTimeFlexible 
                                                            ? `${format(activity.activityDate.toDate(), 'eee', { locale: language === 'de' ? de : enUS })}, ${language === 'de' ? 'Zeit flexibel' : 'Time flexible'}`
                                                            : format(activity.activityDate.toDate(), language === 'de' ? 'eee, HH:mm' : 'eee, h:mm a', { locale: language === 'de' ? de : enUS })}
                                                    </span>
                                                    {activity.isBoosted && (
                                                        <Badge className="bg-amber-100 text-amber-700 text-[8px] font-black uppercase px-2 py-0 border-none rounded-full">{language === 'de' ? 'Highlight' : 'Highlight'}</Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-neutral-500 dark:text-neutral-400 text-xs font-bold">
                                                    <div className="flex items-center gap-1.5">
                                                        <Users className="h-3.5 w-3.5 text-primary" />
                                                        <span>{activity.participantIds.length} {language === 'de' ? 'Teilnehmer' : 'Participants'}</span>
                                                    </div>
                                                    <div className="w-1 h-1 bg-neutral-300 rounded-full" />
                                                    <p className="truncate">Host: {activity.hostName?.split(' ')[0]}</p>
                                                </div>
                                            </div>
                                            <Button 
                                                size="icon" 
                                                className="h-12 w-12 rounded-2xl bg-white dark:bg-neutral-700 text-primary shadow-sm group-hover:bg-primary group-hover:text-white transition-all shadow-primary/5 border-none"
                                            >
                                                {joiningId === activity.id ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : activity.participantIds.includes(user?.uid || '') ? (
                                                    <MessageSquare className="h-5 w-5" />
                                                ) : (
                                                    <ArrowRight className="h-5 w-5" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <SheetFooter className="mt-8 flex-shrink-0 pt-6 border-t border-neutral-100 dark:border-neutral-800 sm:flex-col gap-3">
                    <Button 
                        onClick={() => { onCreateNew(place); onOpenChange(false); }}
                        className="w-full h-16 rounded-3xl bg-primary hover:bg-primary/90 text-white font-black text-base shadow-xl shadow-primary/20 flex items-center justify-center gap-3 transition-transform active:scale-95 border-none"
                    >
                        <div className="bg-white/10 p-2 rounded-xl">
                            <Plus className="h-5 w-5 text-white" strokeWidth={3} />
                        </div>
                        {language === 'de' ? 'Neue Aktivität planen' : 'Plan new activity'}
                    </Button>
                    <p className="text-[10px] text-center font-bold text-neutral-400 uppercase tracking-[0.2em] pt-2">
                        Aktvia • Community Driven
                    </p>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
