'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase/client';
import { doc, onSnapshot } from 'firebase/firestore';
import { joinPaidActivity, getPublicProfileClient } from '@/lib/firebase/firestore';
import type { Activity } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CreditCard, ArrowLeft, Loader2, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';

const isValidCoordinate = (lat: any, lng: any) => {
    return (
        typeof lat === "number" &&
        typeof lng === "number" &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
};

export default function CheckoutPage() {
    const params = useParams();
    const router = useRouter();
    const { user, userProfile, loading: authLoading } = useAuth();
    const language = useLanguage();
    const { toast } = useToast();
    const activityId = params.activityId as string;

    const [activity, setActivity] = useState<Activity | null>(null);
    const [hostProfile, setHostProfile] = useState<any>(null);
    const [hostError, setHostError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isDev, setIsDev] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const isEnvDev = process.env.NODE_ENV === 'development';
            setIsDev(isLocal || isEnvDev);
        }
    }, []);

    // 1. Auth & Onboarding Guards
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push(`/login?redirect=/checkout/${activityId}`);
            return;
        }
        if (userProfile && !userProfile.onboardingCompleted) {
            router.push('/onboarding');
            return;
        }
    }, [user, userProfile, authLoading, activityId, router]);

    // 2. Realtime Subscriptions
    useEffect(() => {
        if (!activityId || !db) return;

        const unsubscribe = onSnapshot(doc(db!, 'activities', activityId), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as Activity;
                setActivity(data);
                
                // Fetch the host profile via secure Cloud Function wrapper
                if (data.hostId && !hostProfile && !hostError) {
                    getPublicProfileClient(data.hostId).then((profile) => {
                        if (profile) {
                            setHostProfile(profile);
                        }
                    }).catch((err) => {
                        console.error("Error fetching host profile in checkout:", err);
                        setHostError(true);
                    });
                }
            } else {
                setActivity(null);
            }
            setLoading(false);
        }, (err) => {
            console.error("Error subscribing to activity in checkout:", err);
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Fehler' : 'Error',
                description: language === 'de' ? 'Fehler beim Laden der Aktivität.' : 'Error loading activity.',
            });
            setLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, [activityId, toast, language, hostProfile, hostError]);

    // 3. Payment Handler (with click debouncing)
    const handlePayment = async () => {
        if (!user || !activity) return;
        if (!isDev) return;
        if (isProcessing) return;
        
        setIsProcessing(true);
        
        try {
            // Simulated payment delay (Stripe checkout sandbox mockup)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Server-verified secure join via Cloud Function transaction
            const mockTransactionId = "txn_sandbox_" + Date.now();
            await joinPaidActivity(activity.id!, user, mockTransactionId);
            
            setIsSuccess(true);
            toast({
                title: language === 'de' ? "Zahlung erfolgreich!" : "Payment successful!",
                description: language === 'de' ? "Du wurdest zum Chat hinzugefügt." : "You have been added to the chat.",
            });

            setTimeout(() => {
                router.replace(`/chat/${activity.id}`);
            }, 2000);
        } catch (error: any) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: language === 'de' ? 'Zahlung fehlgeschlagen' : 'Payment Failed',
                description: error.message || (language === 'de' ? 'Ein technischer Fehler ist aufgetreten.' : 'A technical error occurred.'),
            });
        } finally {
            setIsProcessing(false);
        }
    };

    // 4. Loading State Rendering
    if (loading || authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // 5. Activity Existence Guard
    if (!activity) {
        return (
            <div className="p-10 text-center flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] p-8 bg-white text-center">
                    <h1 className="text-xl font-bold mb-2 text-slate-800">
                        {language === 'de' ? 'Aktivität nicht gefunden' : 'Activity Not Found'}
                    </h1>
                    <p className="text-sm text-slate-500 mb-6">
                        {language === 'de' ? 'Diese Aktivität existiert nicht mehr oder ist privat.' : 'This activity no longer exists or is private.'}
                    </p>
                    <Button onClick={() => router.push('/')} className="rounded-xl w-full h-12 font-bold">
                        {language === 'de' ? 'Zurück zum Feed' : 'Back to Feed'}
                    </Button>
                </Card>
            </div>
        );
    }

    // 6. Access Control & Visibility Guards
    const isCancelled = activity.status === 'cancelled';
    const isCompleted = activity.status === 'completed';
    const isGlobalBlacklisted = activity.status === 'blacklisted';

    const dateObj = activity.activityDate && typeof activity.activityDate.toDate === 'function'
      ? activity.activityDate.toDate()
      : null;
    const isPast = dateObj ? dateObj.getTime() < Date.now() : false;
    
    const isFull = activity.maxParticipants ? activity.participantIds.length >= activity.maxParticipants : false;

    // Bidirectional blocklist validation & host status checks (blocked/banned hosts result in hostError)
    const isHostBlockedByUser = userProfile?.blacklist?.hard?.includes(activity.hostId) ||
                                userProfile?.blacklist?.soft?.includes(activity.hostId);
    const isHidden = userProfile?.hiddenEntityIds?.includes(activity.id || '');
    const isHostBanned = hostProfile?.isBanned === true;

    const isHost = user && activity.hostId === user.uid;
    const isParticipant = user && activity.participantIds.includes(user.uid);
    
    const priceValue = activity.price;
    const isInvalidPrice = typeof priceValue !== 'number' || isNaN(priceValue) || priceValue <= 0;
    const isFree = !activity.isPaid || isInvalidPrice;

    const isNotPayable = isCancelled || isCompleted || isGlobalBlacklisted || isPast || isFull || hostError || isHostBlockedByUser || isHidden || isHostBanned;

    // Host booking prevention
    if (isHost) {
        return (
            <div className="p-10 text-center flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] p-8 bg-white text-center">
                    <h1 className="text-xl font-bold mb-2 text-slate-800">
                        {language === 'de' ? 'Kauf nicht möglich' : 'Purchase Not Possible'}
                    </h1>
                    <p className="text-sm text-slate-500 mb-6">
                        {language === 'de' ? 'Als Host kannst du dein eigenes Event nicht buchen.' : 'As a host, you cannot book your own event.'}
                    </p>
                    <Button onClick={() => router.push(`/activities/${activity.id}`)} className="rounded-xl w-full h-12 font-bold">
                        {language === 'de' ? 'Zurück zur Aktivität' : 'Back to Activity'}
                    </Button>
                </Card>
            </div>
        );
    }

    // Double attendance prevention
    if (isParticipant) {
        return (
            <div className="p-10 text-center flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] p-8 bg-white text-center">
                    <h1 className="text-xl font-bold mb-2 text-slate-800">
                        {language === 'de' ? 'Bereits beigetreten' : 'Already Joined'}
                    </h1>
                    <p className="text-sm text-slate-500 mb-6">
                        {language === 'de' ? 'Du nimmst bereits an dieser Aktivität teil.' : 'You are already participating in this activity.'}
                    </p>
                    <Button onClick={() => router.push(`/chat/${activity.id}`)} className="rounded-xl w-full h-12 font-bold">
                        {language === 'de' ? 'Zum Gruppenchat' : 'To Group Chat'}
                    </Button>
                </Card>
            </div>
        );
    }

    // Free event guard (Free events shouldn't use checkout)
    if (isFree) {
        return (
            <div className="p-10 text-center flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] p-8 bg-white text-center">
                    <h1 className="text-xl font-bold mb-2 text-slate-800">
                        {language === 'de' ? 'Kostenlose Aktivität' : 'Free Activity'}
                    </h1>
                    <p className="text-sm text-slate-500 mb-6">
                        {language === 'de' ? 'Kostenlose Aktivitäten erfordern keinen Checkout.' : 'Free activities do not require a checkout.'}
                    </p>
                    <Button onClick={() => router.push(`/activities/${activity.id}`)} className="rounded-xl w-full h-12 font-bold">
                        {language === 'de' ? 'Direkt beitreten' : 'Join Directly'}
                    </Button>
                </Card>
            </div>
        );
    }

    // Unplayable statuses error screen
    if (isNotPayable) {
        let errorTitle = language === 'de' ? 'Buchung nicht möglich' : 'Booking Not Possible';
        let errorDesc = language === 'de' ? 'Diese Aktivität kann derzeit nicht gebucht werden.' : 'This activity cannot be booked at this time.';

        if (isCancelled) {
            errorTitle = language === 'de' ? 'Aktivität abgesagt' : 'Activity Cancelled';
            errorDesc = language === 'de' ? 'Dieses Event wurde storniert.' : 'This event has been cancelled.';
        } else if (isCompleted || isPast) {
            errorTitle = language === 'de' ? 'Aktivität beendet' : 'Activity Ended';
            errorDesc = language === 'de' ? 'Dieses Event ist bereits abgeschlossen.' : 'This event has already ended.';
        } else if (isFull) {
            errorTitle = language === 'de' ? 'Aktivität ausgebucht' : 'Activity Full';
            errorDesc = language === 'de' ? 'Das Teilnehmerlimit wurde bereits erreicht.' : 'The participant limit has been reached.';
        } else if (hostError || isHostBlockedByUser || isHidden || isGlobalBlacklisted || isHostBanned) {
            errorTitle = language === 'de' ? 'Nicht verfügbar' : 'Not Available';
            errorDesc = language === 'de' ? 'Diese Aktivität ist nicht verfügbar.' : 'This activity is not available.';
        }

        return (
            <div className="p-10 text-center flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <Card className="w-full max-w-md border-none shadow-xl rounded-[2rem] p-8 bg-white text-center">
                    <h1 className="text-xl font-bold mb-2 text-slate-800">{errorTitle}</h1>
                    <p className="text-sm text-slate-500 mb-6">{errorDesc}</p>
                    <Button onClick={() => router.push('/')} className="rounded-xl w-full h-12 font-bold">
                        {language === 'de' ? 'Zurück zum Feed' : 'Back to Feed'}
                    </Button>
                </Card>
            </div>
        );
    }

    // Success Screen
    if (isSuccess) {
        return (
            <div className="flex h-screen w-full items-center justify-center p-4 bg-emerald-50">
                <Card className="w-full max-w-md border-none shadow-2xl rounded-[2.5rem] text-center p-8 bg-white">
                    <div className="mx-auto bg-emerald-100 p-4 rounded-full w-fit mb-6 animate-in zoom-in-95 duration-500">
                        <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                    </div>
                    <CardTitle className="text-2xl font-black mb-3">
                        {language === 'de' ? 'Zahlung bestätigt!' : 'Payment Confirmed!'}
                    </CardTitle>
                    <CardDescription className="text-base font-medium text-emerald-800">
                        {language === 'de' ? (
                            <>Vielen Dank für deine Buchung bei <strong>{activity.placeName}</strong>. Du wirst jetzt zum Gruppenchat hinzugefügt.</>
                        ) : (
                            <>Thank you for your booking at <strong>{activity.placeName}</strong>. You are now being added to the group chat.</>
                        )}
                    </CardDescription>
                    <div className="mt-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-emerald-600" />
                    </div>
                </Card>
            </div>
        );
    }

    // 7. Normal Checkout UI
    return (
        <div className="flex h-screen w-full flex-col bg-slate-50 overflow-y-auto">
            <header className="flex h-16 shrink-0 items-center px-4 bg-white border-b border-slate-100 sticky top-0 z-10">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => router.back()} 
                    className="mr-2 rounded-full"
                    aria-label={language === 'de' ? 'Zurück' : 'Back'}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-bold text-slate-800">Checkout</h1>
            </header>

            <main className="flex-1 p-4 sm:p-8 flex flex-col items-center">
                <div className="w-full max-w-md space-y-6">
                    <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
                        <CardHeader className="bg-slate-900 text-white p-6">
                            <CardTitle className="text-xl">
                                {language === 'de' ? 'Zusammenfassung' : 'Summary'}
                            </CardTitle>
                            <CardDescription className="text-slate-400 font-medium">
                                {language === 'de' ? `Aktivität bei ${activity.placeName}` : `Activity at ${activity.placeName}`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4 bg-white">
                            <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">
                                    {language === 'de' ? 'Teilnahmebeitrag' : 'Ticket Price'}
                                </span>
                                <span className="text-lg font-black text-slate-800">€{priceValue?.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-slate-900 font-black">
                                    {language === 'de' ? 'Gesamtbetrag' : 'Total Amount'}
                                </span>
                                <span className="text-2xl font-black text-primary">€{priceValue?.toFixed(2)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm rounded-3xl p-6 space-y-6 bg-white">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-slate-900">
                                <CreditCard className="h-5 w-5 text-primary" />
                                <span className="font-black">
                                    {language === 'de' ? 'Zahlungsmethode' : 'Payment Method'}
                                </span>
                            </div>
                            
                            {!isDev ? (
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-xs text-amber-800">
                                            {language === 'de' ? 'Zahlung derzeit nicht verfügbar' : 'Payment currently unavailable'}
                                        </h4>
                                        <p className="text-[11px] text-amber-700 font-medium leading-relaxed mt-1">
                                            {language === 'de'
                                                ? 'Echte Zahlungen über Stripe sind in dieser Version noch nicht freigeschaltet. Bitte wende dich an den Support oder wähle kostenlose Events.'
                                                : 'Real payments via Stripe are not yet enabled in this release. Please contact support or select free events.'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-primary bg-primary/5 text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-12 bg-slate-200 rounded flex items-center justify-center font-bold text-[10px]">SANDBOX</div>
                                            <span className="font-bold">
                                                {language === 'de' ? 'Simulierte Zahlung' : 'Simulated Payment'}
                                            </span>
                                        </div>
                                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                            <div className="h-2 w-2 rounded-full bg-white" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isDev && (
                            <div className="bg-slate-50 p-4 rounded-2xl flex items-start gap-3">
                                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                    {language === 'de' 
                                        ? 'Deine Zahlung wird in dieser Sandbox-Umgebung sicher simuliert. Bei echten Events wird der Betrag dem Host erst nach Abschluss gutgeschrieben.'
                                        : 'Your payment is safely simulated in this sandbox environment. For real events, the host is only paid after the activity ends.'}
                                </p>
                            </div>
                        )}

                        <Button 
                            onClick={handlePayment} 
                            disabled={isProcessing || !isDev}
                            aria-busy={isProcessing}
                            className="w-full h-16 rounded-2xl text-lg font-black bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-200 transition-transform active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    {language === 'de' ? 'Wird verarbeitet...' : 'Processing...'}
                                </>
                            ) : (
                                !isDev ? (
                                    language === 'de' ? 'Zahlung nicht verfügbar' : 'Payment unavailable'
                                ) : (
                                    language === 'de' 
                                        ? `Jetzt bezahlen (€${priceValue?.toFixed(2)})`
                                        : `Pay Now (€${priceValue?.toFixed(2)})`
                                )
                            )}
                        </Button>
                    </Card>
                </div>
            </main>
        </div>
    );
}
